import $ from 'jquery';
import EmberObject from '@ember/object';
import { later, scheduleOnce, cancel } from '@ember/runloop';
import { reject, Promise, resolve } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';
import Subscribe from 'ui/mixins/subscribe';
import { xhrConcur } from 'ui/utils/platform';
import PromiseToCb from 'ui/mixins/promise-to-cb';
import Errors from 'ui/utils/errors';

const CHECK_AUTH_TIMER = 60*10*1000;

export function projectIdFromTransition(transition) {
  // Ember 7 keeps the public destination parameters on the RouteInfo tree.
  // `transition.params` was an internal/legacy shape and is no longer exposed,
  // so relying on it silently discarded a project ID from a directly opened
  // /env/:project_id URL and fell back to the user's saved Default project.
  let routeInfo = transition && transition.to;

  while ( routeInfo ) {
    if ( routeInfo.name === 'authenticated.project' &&
      routeInfo.params && routeInfo.params.project_id ) {
      return routeInfo.params.project_id;
    }

    routeInfo = routeInfo.parent;
  }

  // Keep compatibility with the transition stub used by older addons and
  // downstream builds without making it the primary source of truth.
  let legacy = transition && transition.params &&
    transition.params['authenticated.project'];

  return legacy && legacy.project_id || null;
}

export default Route.extend(Subscribe, PromiseToCb, {
  catalog   : service(),
  prefs     : service(),
  projects  : service(),
  settings  : service(),
  access    : service(),
  userTheme : service('user-theme'),
  language  : service('user-language'),
  storeReset: service(),
  modalService: service('modal'),

  testTimer: null,

  beforeModel(transition) {
    this._super.apply(this,arguments);

    if ( this.get('access.enabled') ) {
      if ( this.get('access.isLoggedIn') ) {
        return this.get('access').ensureSession().then(() => {
          this.testAuthToken();
        }, (error) => {
          let generation = this.get('access').captureGeneration();
          transition.send('sessionInvalid', transition, true, null, generation,
            Errors.status(error) || 401);
          return reject(error);
        });
      } else {
        transition.send('sessionInvalid', transition, false, null,
          this.get('access').captureGeneration(), 401);
        return reject('Not logged in');
      }
    }
  },

  testAuthToken: function() {
    let generation = this.get('access').captureGeneration();
    let timer = later(() => {
      this.checkAuthToken(generation);
    }, CHECK_AUTH_TIMER);

    this.set('testTimer', timer);
  },

  checkAuthToken(generation) {
    if ( generation !== this.get('access').captureGeneration() ) {
      this.testAuthToken();
      return resolve({status: 'stale'});
    }
    return this.get('access').testAuth(generation).then((result) => {
      if ( result && result.status === 'stale' ) {
        this.send('sessionInvalid', null, false, null, generation, 401);
      } else {
        this.testAuthToken();
      }
      return result;
    }, (err) => {
      let status = Errors.status(err);
      if ( status === 401 ) {
        this.send('sessionInvalid', null, true, null, generation, status);
      } else {
        // A permission denial or transient network failure is not proof that
        // the browser session expired.  Keep the session and try later.
        this.testAuthToken();
      }
      return {status: status === 403 ? 'forbidden' : 'error'};
    });
  },

  model(params, transition) {
    transition.authGeneration = transition.authGeneration ||
      this.get('access').captureGeneration();
    let requestGeneration = transition.authGeneration;
    // Save whether the user is admin
    let type = this.get(`session.${C.SESSION.USER_TYPE}`);
    let isAdmin = (type === C.USER.TYPE_ADMIN) || !this.get('access.enabled');
    this.set('access.admin', isAdmin);

    this.get('session').set(C.SESSION.BACK_TO, undefined);

    let promise = new Promise((resolve, reject) => {
      let tasks = {
        userSchemas:                                    this.toCb('loadUserSchemas'),
        projects:                                       this.toCb('loadProjects'),
        preferences:                                    this.toCb('loadPreferences'),
        settings:                                       this.toCb('loadPublicSettings'),
        regions:            ['userSchemas',             this.toCb('loadRegions')],
        project:            ['projects', 'preferences', this.toCb('selectProject',transition)],
        projectSchemas:     ['project',                 this.toCb('loadProjectSchemas')],
        catalogs:           ['project',                 this.toCb('loadCatalogs')],
        orchestrationState: ['projectSchemas',          this.toCb('updateOrchestration')],
        instances:          ['projectSchemas',          this.cbFind('instance')],
        services:           ['projectSchemas',          this.cbFind('service')],
        hosts:              ['projectSchemas',          this.cbFind('host')],
        stacks:             ['projectSchemas',          this.cbFind('stack')],
        mounts:             ['projectSchemas',          this.cbFind('mount', 'store', {filter: {state_ne: 'inactive'}})],
        storagePools:       ['projectSchemas',          this.cbFind('storagepool')],
        volumes:            ['projectSchemas',          this.cbFind('volume')],
        certificate:        ['projectSchemas',          this.cbFind('certificate')],
        secret:             ['projectSchemas',          this.toCb('loadSecrets')],
        identities:         ['userSchemas',             this.cbFind('identity', 'userStore')],
      };

      async.auto(tasks, xhrConcur, function(err, res) {
        if ( err ) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    }, 'Load all the things');

    return promise.then((hash) => {
      return EmberObject.create(hash);
    }).catch((err) => {
      return this.loadingError(err, transition, undefined, requestGeneration);
    });
  },

  activate() {
    let app = this.controllerFor('application');

    this._super();
    if ( !this.controllerFor('application').get('isPopup') && this.get('projects.current') )
    {
      this.connectSubscribe();
    }

    if ( this.get('settings.isRancher') && !app.get('isPopup') )
    {
      let form = this.get(`settings.${C.SETTING.FEEDBACK_FORM}`);

      if ( form && !this.get(`prefs.${C.PREFS.FEEDBACK}`) )
      {
        scheduleOnce('afterRender', this, function() {
          this.get('modalService').toggleModal('modal-feedback');
        });
      }
    }
  },

  deactivate() {
    this._super();
    this.disconnectSubscribe();
    cancel(this.get('testTimer'));

    // Forget all the things
    this.get('storeReset').reset();
  },

  loadingError(err, transition, ret, generation) {
    console.log('Loading Error:', err);
    if ( Errors.status(err) === 401 ) {
      this.set('access.enabled', true);
      let target = transition && typeof transition.send === 'function' ? transition : this;
      target.send('sessionInvalid', transition,
        (transition.targetName !== 'authenticated.index'), null,
        generation || transition.authGeneration, 401);
      return;
    }

    // A valid session must not be destroyed because an unrelated schema,
    // project, or network request failed during application initialization.
    // Re-throw so the normal error route shows the actual failure.
    return reject(err);
  },

  cbFind(type, store='store', opt=null) {
    return this.toCb(() => this.get(store).find(type,null,opt));
  },

  loadPreferences() {
    return this.get('userStore').find('userpreference', null, {url: 'userpreferences', forceReload: true}).then((res) => {
      // Save the account ID from the response headers into session
      if ( res )
      {
        this.set(`session.${C.SESSION.ACCOUNT_ID}`, res.xhr.headers.get(C.HEADER.ACCOUNT_ID));
      }

      this.get('language').initLanguage(true);
      this.get('userTheme').setupTheme();

      if (this.get(`prefs.${C.PREFS.I_HATE_SPINNERS}`)) {
        $('BODY').addClass('i-hate-spinners');
      }

      return res;
    });
  },

  loadProjectSchemas() {
    var store = this.get('store');
    store.resetType('schema');
    return store.rawRequest({url:'schema', dataType: 'json'}).then((xhr) => {
      store._bulkAdd('schema', xhr.body.data);
    });
  },

  loadUserSchemas() {
    // @TODO Inline me into releases
    let userStore = this.get('userStore');
    return userStore.rawRequest({url:'schema', dataType: 'json'}).then((xhr) => {
      userStore._bulkAdd('schema', xhr.body.data);
    });
  },

  loadProjects() {
    let svc = this.get('projects');
    return svc.getAll().then((all) => {
      svc.set('all', all);
      return all;
    });
  },

  loadCatalogs() {
    return this.get('catalog').fetchCatalogs();
  },

  loadRegions() {
    if (this.get('userStore').getById('schema', 'region')) {
      return this.get('userStore').find('region');
    } else {
      return resolve();
    }
  },

  updateOrchestration() {
    return this.get('projects').updateOrchestrationState();
  },

  loadPublicSettings() {
    return this.get('userStore').find('setting', null, {url: 'setting', forceReload: true, filter: {all: 'false'}});
  },

  loadSecrets() {
    if ( this.get('store').getById('schema','secret') ) {
      return this.get('store').find('secret');
    } else {
      return resolve();
    }
  },

  selectProject(transition) {
    // Make sure a valid project is selected
    return this.get('projects').selectDefault(projectIdFromTransition(transition));
  },

  actions: {
    error(err,transition) {
      // Unauthorized error, send back to login screen
      if ( Errors.status(err) === 401 )
      {
        let target = transition && typeof transition.send === 'function' ? transition : this;
        target.send('sessionInvalid', transition, true, null,
          transition && transition.authGeneration, 401);
        return false;
      }
      else
      {
        // Bubble up
        return true;
      }
    },

    showAbout() {
      this.controllerFor('application').set('showAbout', true);
    },

    switchProject(projectId, transition=true) {
      console.log('Switch to ' + projectId);
      this.disconnectSubscribe(() => {
        console.log('Switch is disconnected');
        this.send('finishSwitchProject', projectId, transition);
      });
    },

    finishSwitchProject(projectId, transition) {
      console.log('Switch finishing');
      this.get('storeReset').reset();
      if ( transition ) {
        this.intermediateTransitionTo('authenticated');
      }
      this.set(`tab-session.${C.TABSESSION.PROJECT}`, projectId);
      this.refresh();
      console.log('Switch finished');
    },
  },
});
