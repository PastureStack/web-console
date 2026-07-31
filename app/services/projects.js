import { once } from '@ember/runloop';
import { reject, resolve, Promise, all } from 'rsvp';
import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';

import { computed, observer } from '@ember/object';

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

  active: computed('all.@each.state', function() {
    return this.get('all').filter((project) => {
      return ACTIVEISH.includes(project.get('state'));
    });
  }),

  getAll: function() {
    var opt = {
      url: 'projects',  // This is called in authenticated/route before schemas are loaded
      forceReload: true,
    };

    if ( !this.get('access.enabled') )
    {
      opt.filter = {all: 'true'};
    }

    return this.get('userStore').find('project', null, opt);
  },

  refreshAll: function() {
    this.getAll().then((all) => {
      this.set('all', all);
      this.selectDefault();
    });
  },

  selectDefault: function(desired) {
    var self = this;
    var tabSession = this.get('tab-session');

    // The one specifically asked for
    return this._activeProjectFromId(desired).then(select)
    .catch(() => {
      // Try the project ID in the session
      return this._activeProjectFromId(tabSession.get(C.TABSESSION.PROJECT)).then(select)
      .catch(() => {
        // Then the default project ID from the prefs
        return this._activeProjectFromId(this.get('prefs').get(C.PREFS.PROJECT_DEFAULT)).then(select)
        .catch(() => {
          // Then the first active project you're a member of
          var project = this.get('active.firstObject');
          if ( project )
          {
            return select(project, true);
          }
          else if ( this.get('access.admin') )
          {
            // Then if you're an admin the first active of any kind
            return this.getAll().then((all) => {
              var firstActive = all.find((project) => {
                return ACTIVEISH.includes(project.get('state'));
              });

              if ( firstActive )
              {
                return select(firstActive, true);
              }
              else
              {
                return fail();
              }
            }).catch(() => {
              return fail();
            });
          }
          else
          {
            return fail();
          }
        });
      });
    });

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
      // Then cry
      select(null);
      return reject();
    }
  },

  setCurrent: function(project) {
    this.set('current', project);
    if ( project ) {
      this.set('store.baseUrl', `${this.get('app.apiEndpoint')}/projects/${project.get('id')}`);
    } else {
      this.set('store.baseUrl', this.get('app.apiEndpoint'));
    }
    return resolve(project);
  },

  _activeProjectFromId: function(projectId) {
    return new Promise((resolve, reject) => {
      if ( !projectId )
      {
        reject();
        return;
      }

      this.get('userStore').find('project', projectId, {url: 'projects/'+encodeURIComponent(projectId)}).then((project) => {
        if ( ACTIVEISH.includes(project.get('state')) )
        {
          resolve(project);
        }
        else
        {
          reject();
        }
      }).catch(() => {
        reject();
      });
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

  orchestrationStateShouldChange: observer('current.{id,orchestration}', function() {
    once(this, 'updateOrchestrationState', true);
  }),

  isReady: computed('orchestrationState', function() {
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
  }), // The state object is always completely replaced, so this is ok
});
