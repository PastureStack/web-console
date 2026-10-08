import { alias } from '@ember/object/computed';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import Controller, { inject as controller } from '@ember/controller';
import C from 'ui/utils/constants';
import Util from 'ui/utils/util';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  queryParams: ['targetKey'],
  targetKey: null,
  access: service(),
  'tab-session': service(),

  sortBy: 'name',
  sorts: {
    state:        ['stateSort','name','id'],
    name:         ['name','id'],
    description:  ['description','name','id'],
    publicValue:  ['publicValue','id'],
    created:      ['created','name','id'],
  },

  application: controller(),
  cookies: service(),
  projects: service(),
  growl: service(),
  project: alias('projects.current'),
  endpointService: service('endpoint'),
  modalService: service('modal'),

  policySupported: function() {
    let store = this.get('userStore');
    let schema = typeof store.getById === 'function' && store.getById('schema', 'apikey');
    return !!(schema && schema.get('resourceFields.apiKeyPolicy'));
  }.property('model.account.[]'),

  auditViewerChanged: observer('access.identity.id', 'project.id', function() {
    this.set('targetKey', null);
  }),

  canCreateAccountKey: function() {
    return Boolean(this.get('userStore').canCreate('apikey'));
  }.property('model.account'),

  canCreateEnvironmentKey: function() {
    return this.get('projects').canCreateResource('apikey');
  }.property('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration'),

  accountArranged: function() {
    var me = this.get(`session.${C.SESSION.ACCOUNT_ID}`);
    let sort = this.get('sorts')[this.get('sortBy')];

    let seen = new Set();
    // Store.all returns a live Ember ArrayProxy, not an ES iterable. Map both
    // collections into plain arrays without losing their live dependencies.
    let out = this.get('model.account').map((row) => row)
      .concat((this.get('model.accountRestricted') || []).map((row) => row)).filter((row) => {
      let id = row.get('id');
      if ( seen.has(id) || row.get('accountId') !== me ) { return false; }
      seen.add(id);
      return true;
    }).sortBy(...sort);

    if ( this.get('descending') ) {
      out = out.reverse();
    }

    return out;
  }.property('model.account.@each.{accountId,name,createdTs}', 'model.accountRestricted.@each.{accountId,name,createdTs}',
    `session.${C.SESSION.ACCOUNT_ID}`, 'sortBy','descending'),

  environmentArranged: function() {
    var project = this.get('project.id');
    let sort = this.get('sorts')[this.get('sortBy')];

    let out = this.get('model.environment').filter((row) => {
      return row.get('accountId') === project;
    }).sortBy(...sort);

    if ( this.get('descending') ) {
      out = out.reverse();
    }

    return out;
  }.property('model.environment.@each.{accountId,name,createdTs}','sortBy','descending'),

  actions: {
    newApikey: function(kind) {
      var cred;
      if ( kind === 'account' || (kind === 'environment' && this.get('policySupported')) )
      {
        if ( !this.get('canCreateAccountKey') ) {
          return;
        }
        cred = this.get('userStore').createRecord({
          type: 'apikey',
          accountId: this.get(`session.${C.SESSION.ACCOUNT_ID}`),
        });
      }
      else
      {
        if ( kind !== 'environment' || !this.get('canCreateEnvironmentKey') ) {
          return;
        }
        cred = this.get('store').createRecord({
          type: 'apikey',
          accountId: this.get('projects.current.id'),
        });
      }

      this.get('modalService').toggleModal('edit-apikey', cred);
    },
    auditKey(key) { this.set('targetKey', key.get('id')); },
    closeAudit() { this.set('targetKey', null); },
  },

  endpoint: function() {
    // Strip trailing slash off of the absoluteEndpoint
    var base = this.get('endpointService.absolute').replace(/\/+$/,'');
    // Add a single slash
    base += '/';

    var current = this.get('app.apiEndpoint').replace(/^\/+/,'');
    var legacy = this.get('app.legacyApiEndpoint').replace(/^\/+/,'');

    // Go to the project-specific version
    var projectId = this.get('tab-session').get(C.TABSESSION.PROJECT);
    var project = '';
    if ( projectId )
    {
      project = '/projects/' + projectId;
    }

    // For local development where API doesn't match origin, add basic auth token
    var authBase = base;
    if ( base.indexOf(window.location.origin) !== 0 )
    {
      var token = this.get('cookies').get(C.COOKIE.TOKEN);
      if ( token ) {
        authBase = Util.addAuthorization(base, C.USER.BASIC_BEARER, token);
      }
    }

    return {
      auth: {
        account: {
          current: authBase + current,
          legacy:  authBase + legacy
        },
        environment: {
          current: authBase + current + project,
          legacy:  authBase + legacy + project
        }
      },
      display: {
        account: {
          current: base + current,
          legacy:  base + legacy
        },
        environment: {
          current: base + current + project,
          legacy:  base + legacy + project
        }
      },
    };
  }.property('endpointService.absolute', 'app.{apiEndpoint,legacyApiEndpoint}', `tab-session.${C.TABSESSION.PROJECT}`),
});
