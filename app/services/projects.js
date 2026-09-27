import { once } from '@ember/runloop';
import { reject, resolve, all } from 'rsvp';
import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';

let ACTIVEISH = ['active','upgrading','updating-active'];

export default Service.extend({
  access: service(),
  'tab-session': service('tab-session'),
  prefs: service(),
  k8sSvc: service('k8s'),
  swarmSvc: service('swarm'),
  mesosSvc: service('mesos'),
  userStore: service('user-store'),
  store: service(),

  current: null,
  all: null,
  schemaProjectId: null,
  schemaLoadGeneration: 0,

  canCreateResource(type) {
    let projectId = this.get('current.id');
    // ember-api-store caches schema IDs in lowercase, but does not normalize
    // the ID passed to canCreate(). API resource names can be mixed-case.
    return Boolean(projectId && this.get('schemaProjectId') === projectId &&
      typeof type === 'string' && this.get('store').canCreate(type.toLowerCase()));
  },

  active: function() {
    return this.get('all').filter((project) => {
      return ACTIVEISH.includes(project.get('state'));
    });
  }.property('all.@each.state'),

  getAll: function() {
    var opt = {
      url: 'projects',  // This is called in authenticated/route before schemas are loaded
      forceReload: true,
    };

    // Site administrators may manage projects without being project members.
    // The API only includes those projects when the caller requests all=true.
    if ( !this.get('access.enabled') || this.get('access.admin') )
    {
      opt.filter = {all: 'true'};
    }

    return this.get('userStore').find('project', null, opt);
  },

  refreshAll: function() {
    return this.getAll().then((all) => {
      this.set('all', all);
      return this.selectDefault();
    });
  },

  selectDefault: function(desired) {
    var self = this;
    var tabSession = this.get('tab-session');
    var candidates = [
      () => desired,
      () => tabSession.get(C.TABSESSION.PROJECT),
      () => this.get('prefs').get(C.PREFS.PROJECT_DEFAULT),
    ];

    return tryCandidate(0);

    function tryCandidate(index) {
      if ( index >= candidates.length ) {
        return selectFirstActive();
      }

      return self._activeProjectFromId(candidates[index]()).then(select, (err) => {
        let status = Errors.status(err);
        if ( status === 403 || status === 404 ) {
          return tryCandidate(index + 1);
        }
        throw err;
      });
    }

    function selectFirstActive() {
      var project = self.get('active.firstObject');
      if ( project ) {
        return select(project, true);
      }
      if ( self.get('access.admin') ) {
        return self.getAll().then((all) => {
          var firstActive = all.find((item) => ACTIVEISH.includes(item.get('state')));
          return firstActive ? select(firstActive, true) : fail();
        });
      }
      return fail();
    }

    function select(project, overwriteDefault) {
      if ( project )
      {
        tabSession.set(C.TABSESSION.PROJECT, project.get('id'));

        // If there is no default project, set it
        var def = self.get('prefs').get(C.PREFS.PROJECT_DEFAULT);
        if ( !def || overwriteDefault === true )
        {
          self.get('prefs').set(C.PREFS.PROJECT_DEFAULT, project.get('id'));
        }

        return self.setCurrent(project);
      }
      else
      {
        tabSession.set(C.TABSESSION.PROJECT, undefined);
        return self.setCurrent(null);
      }
    }

    function fail() {
      // An authenticated account can legitimately have no active environment.
      // Clear stale tab state and continue into the explicit empty-state route
      // instead of turning the absence of a project into a loading failure.
      return select(null);
    }
  },

  setCurrent: function(project) {
    this.incrementProperty('schemaLoadGeneration');
    this.set('schemaProjectId', null);
    this.set('current', project);
    if ( project ) {
      this.set('store.baseUrl', `${this.get('app.apiEndpoint')}/projects/${project.get('id')}`);
    } else {
      this.set('store.baseUrl', this.get('app.apiEndpoint'));
    }
    return resolve(project);
  },

  _activeProjectFromId: function(projectId) {
    if ( !projectId ) {
      return reject({status: 404});
    }

    return this.get('userStore').find('project', projectId, {
      url: 'projects/'+encodeURIComponent(projectId),
      forceReload: true,
    }).then((project) => {
      return ACTIVEISH.includes(project.get('state')) ? project : reject({status: 404});
    });
  },

  orchestrationState: null,
  updateOrchestrationState() {
    let hash = {
      hasKubernetes: false,
      hasSwarm: false,
      hasMesos: false,
      kubernetesReady: false,
      swarmReady: false,
      mesosReady: false,
    };

    let promises = [];

    if ( this.get('current') )
    {
      let orch = this.get('current.orchestration');
      if ( orch === 'kubernetes' )
      {
        hash.hasKubernetes = true;
        promises.push(this.get('k8sSvc').isReady().then((ready) => {
          hash.kubernetesReady = ready;
        }));
      }

      if ( orch === 'swarm' )
      {
        hash.hasSwarm = true;
        promises.push(this.get('swarmSvc').isReady().then((ready) => {
          hash.swarmReady = ready;
        }));
      }

      if ( orch === 'mesos' )
      {
        hash.hasMesos = true;
        promises.push(this.get('mesosSvc').isReady().then((ready) => {
          hash.mesosReady = ready;
        }));
      }
    }

    return all(promises).then(() => {
      this.set('orchestrationState', hash);
      return resolve(hash);
    }).catch((e) => {
      return reject(e);
    });
  },

  orchestrationStateShouldChange: function() {
    once(this, 'updateOrchestrationState', true);
  }.observes('current.{id,orchestration}'),

  isReady: function() {
    var state = this.get('orchestrationState');

    if ( !state )
    {
      return false;
    }

    return (
      (!state.hasKubernetes || state.kubernetesReady) &&
      (!state.hasSwarm || state.swarmReady) &&
      (!state.hasMesos || state.mesosReady)
    );
  }.property('orchestrationState'), // The state object is always completely replaced, so this is ok
});
