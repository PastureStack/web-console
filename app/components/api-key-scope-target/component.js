import Component from '@ember/component';
import { service } from '@ember/service';
import { scopeKey } from 'ui/utils/api-key-owner-capabilities';
import C from 'ui/utils/constants';
const PLATFORM_TYPES = ['project', 'setting', 'userpreference', 'apikey', 'apikeyrestricted', 'account', 'auditlog'];

function schemaFields(schema) {
  let get = (name) => typeof schema.get === 'function' ? schema.get(name) : schema[name];
  return {_id: get('_id'), id: get('id'), baseType: get('baseType'), collectionMethods: get('collectionMethods'),
    resourceMethods: get('resourceMethods'), resourceActions: get('resourceActions'), resourceLinks: get('resourceLinks')};
}

export default Component.extend({
  store: service(),
  userStore: service('user-store'),
  projects: service(),
  session: service(),
  access: service(),
  candidates: null,
  loadError: false,
  loading: false,

  didReceiveAttrs() {
    this._super(...arguments);
    this.loadContext();
  },

  contextChanged: function() { this.loadContext(); }
    .observes('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration',
      'store.generation', 'userStore.generation', 'access.identity.id', `session.${C.SESSION.ACCOUNT_ID}`),

  loadContext() {
    if ( this.isDestroying || this.isDestroyed ) { return; }
    let scope = this.get('scope') || {};
    let type = scope.kind === 'resource' ? scope.resourceType : scope.kind;
    let context = [type, this.get('projects.current.id'), this.get('projects.schemaProjectId'),
      this.get('projects.schemaLoadGeneration'), this.get('store.generation'), this.get('userStore.generation'),
      this.get('access.identity.id'), this.get(`session.${C.SESSION.ACCOUNT_ID}`)].join(':');
    let evidenceContext = `${context}:${scopeKey(scope)}`;
    if ( evidenceContext === this._evidenceContext ) { return; }
    this._evidenceContext = evidenceContext;
    let generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.publish({scopeKey: scopeKey(scope), contextVerified: false, complete: false});
    if ( !type || type === 'global' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(type) ) {
      this.setProperties({candidates: [], loading: false, loadError: false});
      return;
    }
    // ember-api-store normalizes schema IDs to lowercase.
    let store = PLATFORM_TYPES.includes(type.toLowerCase()) || !this.get('store').getById('schema', type.toLowerCase()) ? this.get('userStore') : this.get('store');
    if ( !store.getById('schema', type.toLowerCase()) ) {
      this.setProperties({candidates: [], loading: false, loadError: true});
      return;
    }
    let candidates = context === this._candidateContext && this._candidateResources;
    this.setProperties({candidates: candidates ? this.get('candidates') : [], loadError: false, loading: true});
    let request = candidates ? Promise.resolve(candidates) : store.findAll(type, null, {forceReload: true, removeMissing: true});
    request.then((items) => {
      if ( !this.current(generation) ) { return; }
      this._candidateContext = context;
      this._candidateResources = items;
      this.set('candidates', items.map((item) => ({id: item.get('id'), name: item.get('displayName') || item.get('name') || item.get('id')})));
      if ( !scope.resourceId ) { return; }
      return store.find(type, scope.resourceId, {forceReload: true}).then((item) => {
        if ( !this.current(generation) || item.get('id') !== scope.resourceId ) { return; }
        let resource = {id: item.get('id'), type: item.get('type'), accountId: item.get('accountId'),
          actionLinks: item.get('actionLinks'), links: item.get('links')};
        if ( store === this.get('store') && resource.accountId !== this.get('projects.current.id') ) { return; }
        let projectId = scope.kind === 'project' ? scope.resourceId : scope.kind === 'stack' ? resource.accountId :
          store === this.get('store') ? this.get('projects.current.id') : null;
        // Read the selected context without rebasing the application's store.
        let url = projectId ? `projects/${encodeURIComponent(projectId)}/schema` : 'schema';
        return this.get('userStore').rawRequest({url, method: 'GET'}).then((response) => {
          if ( !this.current(generation) ) { return; }
          let body = response.body;
          let schemas = body && body.data;
          let complete = Array.isArray(schemas) && !(body.pagination && body.pagination.next);
          this.publish({scopeKey: scopeKey(scope), contextVerified: true, complete, projectId,
            resource, schemas: complete ? schemas.map(schemaFields) : []});
        });
      });
    }).catch(() => {
      if ( this.current(generation) ) {
        this.setProperties({candidates: [], loadError: true});
        this.publish({scopeKey: scopeKey(scope), contextVerified: false, complete: false});
      }
    }).finally(() => {
      if ( this.current(generation) ) { this.set('loading', false); }
    });
  },

  current(generation) { return generation === this._loadGeneration && !this.isDestroyed && !this.isDestroying; },
  publish(evidence) { if ( typeof this.get('onCapabilities') === 'function' ) { this.get('onCapabilities')(evidence); } },
  willDestroyElement() { this._loadGeneration = (this._loadGeneration || 0) + 1; this._candidateResources = null; this._super(...arguments); },

  actions: {
    select(event) { this.get('onSelect')(event); },
  },
});
