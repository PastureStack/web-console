import Component from '@ember/component';
import { service } from '@ember/service';
import { scheduleOnce, cancel } from '@ember/runloop';
import { scopeKey } from 'ui/utils/api-key-owner-capabilities';
import C from 'ui/utils/constants';
import {readField, scopeType, typeKey, isPlatformScope, hasStackParent, namedOptions, sameReadableNameFields,
  projectResources, stackParent, stackParentEvidence, resourcesInStack, collectionLink, collectionItems} from 'ui/utils/api-key-scope-selection';

function schemaFields(schema) {
  let get = (name) => typeof schema.get === 'function' ? schema.get(name) : schema[name];
  return {_id: get('_id'), id: get('id'), baseType: get('baseType'), collectionMethods: get('collectionMethods'),
    resourceMethods: get('resourceMethods'), resourceActions: get('resourceActions'), resourceLinks: get('resourceLinks')};
}

export default Component.extend({
  classNames: ['api-key-scope-target'],
  store: service(),
  userStore: service('user-store'),
  projects: service(),
  session: service(),
  access: service(),
  intl: service(),
  candidates: null,
  projectOptions: null,
  stackOptions: null,
  selectedProject: null,
  selectedStack: null,
  selectedTarget: null,
  selectionStatus: 'chooseResource',
  missingNames: 0,
  ambiguous: 0,
  loadError: false,
  loading: false,

  needsProject: function() { return !!scopeType(this.get('scope')) && !isPlatformScope(scopeType(this.get('scope'))); }.property('scope.kind', 'scope.resourceType'),
  needsStack: function() { return hasStackParent(scopeType(this.get('scope'))); }.property('scope.kind', 'scope.resourceType'),
  stackDisabled: function() { return this.get('disabled') || this.get('loading') || !this.get('selectedProject'); }.property('disabled', 'loading', 'selectedProject'),
  targetDisabled: function() {
    return this.get('disabled') || this.get('loading') || !scopeType(this.get('scope')) || this.get('needsProject') && !this.get('selectedProject') ||
      this.get('needsStack') && !this.get('selectedStack');
  }.property('disabled', 'loading', 'scope.kind', 'scope.resourceType', 'needsProject', 'needsStack', 'selectedProject', 'selectedStack'),

  didReceiveAttrs() {
    this._super(...arguments);
    this.loadContext();
  },

  contextChanged: function() { this.loadContext(); }
    .observes('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration',
      'store.generation', 'userStore.generation', 'access.identity.id', `session.${C.SESSION.ACCOUNT_ID}`, 'intl._locale'),

  contextKey(type, scope) {
    return [type, this.get('projects.current.id'), this.get('projects.schemaProjectId'),
      this.get('projects.schemaLoadGeneration'), this.get('store.generation'), this.get('userStore.generation'),
      this.get('access.identity.id'), this.get(`session.${C.SESSION.ACCOUNT_ID}`),
      this.get('intl._locale'), this._selectedProjectId, this._selectedStackId, scopeKey(scope)].join(':');
  },

  async readCollection(schemas, type, generation) {
    let url = collectionLink(schemas, type), seen = new Set(), items = [];
    if ( !url ) { throw new Error('CollectionNotAdvertised'); }
    while ( url ) {
      if ( seen.has(url) || seen.size >= 100 ) { throw new Error('IncompleteCollection'); }
      seen.add(url);
      let response = await this.get('userStore').rawRequest({url, method: 'GET'});
      if ( !this.current(generation) ) { return []; }
      if ( !Array.isArray(response.body?.data) ) { throw new Error('UnverifiedCollection'); }
      items = items.concat(response.body.data);
      url = response.body.pagination?.next;
    }
    return items;
  },

  async readSchemas(projectId, generation) {
    let response = await this.get('userStore').rawRequest({url: projectId ? `projects/${encodeURIComponent(projectId)}/schema` : 'schema', method: 'GET'});
    if ( !this.current(generation) ) { return null; }
    let schemas = response.body?.data;
    if ( !Array.isArray(schemas) || response.body.pagination?.next ) { throw new Error('IncompleteSchema'); }
    return schemas;
  },

  async recoverParent(type, resourceId, projects, generation) {
    // Only fresh user-visible collections can recover a saved stable reference.
    // Never resolve it through the shared current-project store or a guessed URL.
    let schemas = await this.readSchemas(null, generation);
    if ( !this.current(generation) ) { return null; }
    if ( collectionLink(schemas, type) ) {
      let items = await this.readCollection(schemas, type, generation);
      if ( !this.current(generation) ) { return null; }
      let matches = items.filter((item) => readField(item, 'id') === resourceId &&
        projects.some((project) => project.id === readField(item, 'accountId')));
      if ( matches.length > 1 ) { throw new Error('UnverifiedParent'); }
      if ( matches.length === 1 ) { return {projectId: readField(matches[0], 'accountId')}; }
    }
    // Account schemas may not advertise project-scoped types. Use each visible
    // context's advertised alias-aware collection, matching ID AND accountId.
    for ( let project of projects ) {
      schemas = await this.readSchemas(project.id, generation);
      if ( !this.current(generation) ) { return null; }
      if ( !collectionLink(schemas, type) ) { continue; }
      let items = projectResources(await this.readCollection(schemas, type, generation), project.id);
      if ( !this.current(generation) ) { return null; }
      let matches = items.filter((item) => readField(item, 'id') === resourceId);
      if ( matches.length > 1 ) { throw new Error('UnverifiedParent'); }
      if ( matches.length === 1 ) { return {projectId: project.id, schemas, items}; }
    }
    return null;
  },

  selectionResult(scope, status, evidence = {}) {
    this._evidenceContext = this.contextKey(scopeType(scope), scope);
    this.set('selectionStatus', status);
    this.publish(Object.assign({scopeKey: scopeKey(scope), selectionValid: false, selectionStatus: status,
      contextVerified: false, complete: false}, evidence));
  },

  async loadContext() {
    if ( this.isDestroying || this.isDestroyed ) { return; }
    let scope = this.get('scope') || {};
    let type = scopeType(scope);
    if ( this._scopeType !== type ) {
      this._selectedStackId = null;
      if ( isPlatformScope(type) ) { this._selectedProjectId = null; }
      this._scopeType = type;
    }
    let evidenceContext = this.contextKey(type, scope);
    if ( evidenceContext === this._evidenceContext ) { return; }
    this._evidenceContext = evidenceContext;
    let generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.publish({scopeKey: scopeKey(scope), selectionValid: false, selectionStatus: 'loading', contextVerified: false, complete: false});
    this.setProperties({candidates: [], projectOptions: [], stackOptions: [], selectedProject: null,
      selectedStack: null, selectedTarget: null, missingNames: 0, ambiguous: 0, loadError: false, loading: true,
      selectionStatus: 'loading'});
    if ( !type || type === 'global' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(type) ) {
      this.setProperties({candidates: [], loading: false, loadError: false});
      if ( type !== 'global' ) { this.selectionResult(scope, 'chooseType'); }
      return;
    }
    try {
      let projectItems = [];
      if ( !isPlatformScope(type) || typeKey(type) === 'project' ) {
        // find() returns THIS GET's collection; findAll() returns the whole store
        // cache and can retain removed memberships even with forceReload.
        projectItems = await this.get('userStore').find('project', null, {forceReload: true, depaginate: true});
        if ( !this.current(generation) ) { return; }
        let projects = namedOptions(projectItems);
        this.set('projectOptions', projects.options);
        if ( !projects.options.length ) {
          this.selectionResult(scope, scope.resourceId ? 'unavailable' : projects.ambiguous ? 'ambiguous' : projects.missingNames ? 'unnamed' : 'empty');
          return;
        }
      }
      let recovered;
      if ( !isPlatformScope(type) && scope.resourceId && !this._selectedProjectId ) {
        recovered = await this.recoverParent(type, scope.resourceId, this.get('projectOptions'), generation);
        if ( !this.current(generation) ) { return; }
        this._selectedProjectId = recovered?.projectId;
      }
      let selectedProject = (this.get('projectOptions') || []).find((item) => item.id === this._selectedProjectId);
      this.set('selectedProject', selectedProject || null);
      if ( !isPlatformScope(type) && !selectedProject ) {
        this.selectionResult(scope, scope.resourceId ? 'unavailable' : 'chooseProject'); return;
      }
      let projectId = !isPlatformScope(type) ? selectedProject.id : typeKey(type) === 'project' ? scope.resourceId : null;
      let schemas = recovered?.schemas || await this.readSchemas(projectId, generation);
      if ( !this.current(generation) ) { return; }
      let items = typeKey(type) === 'project' ? collectionItems(projectItems) : recovered?.items || await this.readCollection(schemas, type, generation);
      if ( !this.current(generation) ) { return; }
      if ( !isPlatformScope(type) ) { items = projectResources(items, projectId); }
      let prefix = selectedProject?.label || '';
      let parentServices = [];
      if ( hasStackParent(type) ) {
        let stacks = projectResources(collectionLink(schemas, 'stack') ? await this.readCollection(schemas, 'stack', generation) : [], projectId);
        if ( !this.current(generation) ) { return; }
        let services = typeKey(type) === 'container' ? projectResources(collectionLink(schemas, 'service') ? await this.readCollection(schemas, 'service', generation) : [], projectId) : items;
        parentServices = services;
        if ( !this.current(generation) ) { return; }
        let stackOptions = namedOptions(stacks, {prefix, typeLabel: this.get('intl').t('apiKeyAccess.selector.types.stack')}).options;
        let unparented = items.filter((item) => !stackOptions.some((option) => option.id === stackParent(item, services)));
        if ( unparented.length ) {
          let label = `${prefix} / ${this.get('intl').t('apiKeyAccess.selector.environmentResources')}`;
          stackOptions.push({id: '__environment_resources__', label, searchText: label});
        }
        if ( scope.resourceId && !stackOptions.some((option) => option.id === this._selectedStackId) ) {
          let saved = items.find((item) => readField(item, 'id') === scope.resourceId);
          if ( saved ) {
            let parent = stackParent(saved, services);
            this._selectedStackId = stackOptions.some((option) => option.id === parent) ? parent : '__environment_resources__';
          }
        }
        let selectedStack = stackOptions.find((item) => item.id === this._selectedStackId);
        this.setProperties({stackOptions, selectedStack: selectedStack || null});
        if ( !selectedStack ) { this.selectionResult(scope, scope.resourceId ? 'unavailable' : 'chooseStack'); return; }
        items = selectedStack.id === '__environment_resources__' ? unparented : resourcesInStack(items, selectedStack.id, services);
        prefix = selectedStack.label;
      }
      let result = namedOptions(items, {prefix, typeLabel: this.get('intl').t(`apiKeyAccess.selector.types.${type}`)});
      this.setProperties({candidates: result.options, missingNames: result.missingNames, ambiguous: result.ambiguous});
      let selected = result.options.find((item) => item.id === scope.resourceId);
      if ( !selected ) {
        this.selectionResult(scope, scope.resourceId ? 'unavailable' : result.ambiguous ? 'ambiguous' :
          result.missingNames ? 'unnamed' : result.options.length ? 'chooseResource' : 'empty'); return;
      }
      let self = readField(selected.resource, 'links')?.self;
      if ( typeof self !== 'string' ) { throw new Error('SelfNotAdvertised'); }
      let detail = (await this.get('userStore').rawRequest({url: self, method: 'GET'})).body;
      if ( !this.current(generation) ) { return; }
      if ( readField(detail, 'id') !== scope.resourceId || readField(detail, 'removed') ||
        ['removed', 'purged'].includes(readField(detail, 'state')) ||
        !isPlatformScope(type) && readField(detail, 'accountId') !== projectId ||
        !sameReadableNameFields(detail, selected.resource) ||
        readField(detail, 'stackId') !== readField(selected.resource, 'stackId') ||
        readField(detail, 'serviceId') !== readField(selected.resource, 'serviceId') ||
        JSON.stringify(readField(detail, 'serviceIds') || []) !== JSON.stringify(readField(selected.resource, 'serviceIds') || []) ) { throw new Error('UnverifiedTarget'); }
      this.set('selectedTarget', selected);
      let resource = {id: readField(detail, 'id'), type: readField(detail, 'type'), accountId: readField(detail, 'accountId'),
        stackId: readField(detail, 'stackId'), serviceId: readField(detail, 'serviceId'), serviceIds: readField(detail, 'serviceIds'),
        actionLinks: readField(detail, 'actionLinks'), links: readField(detail, 'links')};
      let parentEvidence = stackParentEvidence(detail, parentServices);
      this.selectionResult(scope, 'ready', {selectionValid: true, selectionLabel: selected.label,
        contextVerified: true, complete: true, projectId,
        stackId: typeKey(type) === 'stack' ? resource.id : parentEvidence.stackId,
        stackContextStatus: parentEvidence.status,
        resource, schemas: schemas.map(schemaFields)});
    } catch (_) {
      if ( this.current(generation) ) {
        this.setProperties({candidates: [], selectedTarget: null, loadError: true});
        this.selectionResult(scope, scope.resourceId ? 'unavailable' : 'loadError');
      }
    } finally {
      if ( this.current(generation) ) { this.set('loading', false); }
    }
  },

  clearTarget() {
    this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.setProperties({scope: Object.assign({}, this.get('scope'), {resourceId: ''}), candidates: [], selectedTarget: null});
    this._evidenceContext = null;
    this.get('onSelect')({target: {value: ''}});
  },

  current(generation) { return generation === this._loadGeneration && !this.isDestroyed && !this.isDestroying; },
  publish(evidence) {
    // didReceiveAttrs runs while the parent rules are being rendered. Never
    // dirty that consumed computation; retain only the latest context/result.
    this._pendingEvidence = {generation: this._loadGeneration, evidence};
    this._publishTimer = scheduleOnce('afterRender', this, this.publishPending);
  },
  publishPending() {
    this._publishTimer = null;
    let pending = this._pendingEvidence;
    this._pendingEvidence = null;
    if ( pending && this.current(pending.generation) && typeof this.get('onCapabilities') === 'function' ) {
      this.get('onCapabilities')(pending.evidence);
    }
  },
  willDestroyElement() {
    this._loadGeneration = (this._loadGeneration || 0) + 1;
    if ( this._publishTimer ) { cancel(this._publishTimer); this._publishTimer = null; }
    this._pendingEvidence = null;
    this._candidateResources = null;
    this._super(...arguments);
  },

  actions: {
    selectProject(option) {
      if ( this.get('disabled') || this.get('loading') || !(this.get('projectOptions') || []).includes(option) ) { return; }
      this._selectedProjectId = option.id;
      this._selectedStackId = null;
      this.setProperties({selectedProject: option, selectedStack: null, stackOptions: []});
      this.clearTarget(); this.loadContext();
    },
    selectStack(option) {
      if ( this.get('stackDisabled') || !(this.get('stackOptions') || []).includes(option) ) { return; }
      this._selectedStackId = option.id;
      this.set('selectedStack', option);
      this.clearTarget(); this.loadContext();
    },
    select(option) {
      if ( this.get('targetDisabled') || !(this.get('candidates') || []).includes(option) ) { return; }
      this.get('onSelect')({target: {value: option.id}});
    },
    retry() { this._evidenceContext = null; this.loadContext(); },
  },
});
