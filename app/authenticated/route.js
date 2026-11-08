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
  authSession: service('auth-session'),
  cookies: service(),
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
    const selectionGuard = this.modelSelectionGuard(transition);
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
        project:            ['projects', 'preferences', this.toCb('selectProject',transition,selectionGuard)],
        projectSchemas:     ['project',                 this.toCb('loadProjectSchemas',selectionGuard)],
        catalogs:           ['project',                 this.toCb('loadCatalogs')],
        orchestrationState: ['projectSchemas',          this.toCb('updateOrchestration')],
        instances:          ['projectSchemas',          this.cbFindProject('instance')],
        services:           ['projectSchemas',          this.cbFindProject('service')],
        hosts:              ['projectSchemas',          this.cbFindProject('host')],
        stacks:             ['projectSchemas',          this.cbFindProject('stack')],
        mounts:             ['projectSchemas',          this.cbFindProject('mount', 'store', {filter: {state_ne: 'inactive'}})],
        storagePools:       ['projectSchemas',          this.cbFindProject('storagepool')],
        volumes:            ['projectSchemas',          this.cbFindProject('volume')],
        certificate:        ['projectSchemas',          this.cbFindProject('certificate')],
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
      if (!selectionGuard.isCurrent()) {
        if (!transition.isAborted && typeof transition.abort === 'function') { transition.abort(); }
        return reject(err);
      }
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

  cbFindProject(type, store='store', opt=null) {
    return this.toCb(() => {
      if ( !this.get('projects.current') ) {
        return resolve([]);
      }

      return this.get(store).find(type,null,opt);
    });
  },

  loadPreferences() {
    return this.get('userStore').find('userpreference', null, {url: 'userpreferences', forceReload: true}).then((res) => {
      // Save the account ID from the response headers into session
      if ( res )
      {
        this.set(`session.${C.SESSION.ACCOUNT_ID}`, res.xhr.headers.get(C.HEADER.ACCOUNT_ID));
      }

      let languagePromise = this.get('language').initLanguage(true);
      this.get('userTheme').setupTheme();

      if (this.get(`prefs.${C.PREFS.I_HATE_SPINNERS}`)) {
        $('BODY').addClass('i-hate-spinners');
      }

      return languagePromise.then(() => res);
    });
  },

  async loadProjectSchemas(assertHandoff) {
    const store = this.get('store'), projects = this.get('projects');
    let schemaLoadGeneration, projectId;
    const initialize = () => {
      if (typeof assertHandoff === 'function') { assertHandoff(); }
      else if (assertHandoff && typeof assertHandoff.assertCurrent === 'function') { assertHandoff.assertCurrent(); }
      schemaLoadGeneration = projects.incrementProperty('schemaLoadGeneration');
      projects.set('schemaProjectId', null);
      store.resetType('schema');
      projectId = projects.get('current.id');
    };
    if (assertHandoff && typeof assertHandoff.commit === 'function') { await assertHandoff.commit(initialize); }
    else { initialize(); }
    if ( !projectId ) {
      return resolve();
    }

    return store.rawRequest({url:'schema', dataType: 'json'}).then((xhr) => {
      const apply = () => {
        if ( projects.get('current.id') === projectId &&
          projects.get('schemaLoadGeneration') === schemaLoadGeneration ) {
          if (typeof assertHandoff === 'function') { assertHandoff(); }
          else if (assertHandoff && typeof assertHandoff.assertCurrent === 'function') { assertHandoff.assertCurrent(); }
          store._bulkAdd('schema', xhr.body.data);
          projects.set('schemaProjectId', projectId);
        }
      };
      return assertHandoff && typeof assertHandoff.commit === 'function' ? assertHandoff.commit(apply) : apply();
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
    if ( !this.get('projects.current') ) {
      return resolve([]);
    }

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
    if ( !this.get('projects.current') ) {
      return resolve([]);
    }

    if ( this.get('store').getById('schema','secret') ) {
      return this.get('store').find('secret');
    } else {
      return resolve();
    }
  },

  selectProject(transition, assertHandoff) {
    // Make sure a valid project is selected
    const options = typeof assertHandoff === 'function' ? {assertSelection: assertHandoff, preserveDefault: true} :
      assertHandoff && typeof assertHandoff.assertSelection === 'function' ? {assertSelection: assertHandoff.assertSelection,
        preserveDefault: assertHandoff.preserveDefault, commitSelection: assertHandoff.commit} : {};
    return this.get('projects').selectDefault(projectIdFromTransition(transition), options);
  },

  // Every model owns a selection generation, including ordinary UI refreshes.
  // The optional AI handoff adds exact target checks; it is not the session authority.
  selectionSessionGuard(generation) {
    const enabled = !!this.get('access.enabled'), auth = this.get('authSession');
    const actor = auth && auth.get('accountId'), token = auth && auth.get('tokenSnapshot');
    const isCurrent = () => {
      if (!!this.get('access.enabled') !== enabled) { return false; }
      if (!enabled) { return true; }
      const shared = auth.readShared();
      return !!(generation && actor && token && auth.capture() === generation && auth.get('accountId') === actor &&
        auth.get('tokenSnapshot') === token && this.get('cookies').get(C.COOKIE.TOKEN) === token && shared &&
        shared.generation === generation && shared.accountId === actor);
    };
    return {isCurrent, commit: (action) => {
      const apply = () => { if (!isCurrent()) { throw new Error('Route selection context changed'); } action(); };
      return enabled ? auth.runPassiveSynchronous(apply) : resolve().then(apply);
    }};
  },

  modelSelectionGuard(transition) {
    const session = this.selectionSessionGuard(transition.authGeneration);
    const handoff = this.environmentHandoffGuard(transition);
    if (transition.isAborted || !session.isCurrent()) {
      if (!transition.isAborted && typeof transition.abort === 'function') { transition.abort(); }
      throw new Error('Route selection context changed');
    }
    const revision = this._routeSelectionGeneration = (this._routeSelectionGeneration || 0) + 1;
    const isCurrent = () => {
      if (this._routeSelectionGeneration !== revision || transition.isAborted || !session.isCurrent()) { return false; }
      try { if (handoff) { handoff(); } return true; } catch (error) { return false; }
    };
    const assertCurrent = () => {
      if (!isCurrent()) {
        if (!transition.isAborted && typeof transition.abort === 'function') { transition.abort(); }
        throw new Error('Route selection context changed');
      }
    };
    return {isCurrent, assertCurrent, preserveDefault: !!handoff,
      assertSelection: (project) => { assertCurrent(); if (handoff) { handoff(project); } },
      commit: (action) => session.commit(() => { assertCurrent(); action(); })};
  },

  // Optional guard belongs only to the exact human handoff which owns this transition.
  environmentHandoffGuard(transition) {
    const handoff = this._browserEnvironmentHandoff;
    if (!handoff || handoff.transition && handoff.transition !== transition) { return null; }
    handoff.transition = transition;
    return (project) => {
      if (this._browserEnvironmentHandoff !== handoff || transition.isAborted) { throw new Error('Environment handoff replaced'); }
      handoff.assertSession();
      if (project !== undefined && (!project || project.get('id') !== handoff.target.id || project.get('uuid') !== handoff.target.uuid || project.get('name') !== handoff.target.name)) {
        throw new Error('Selected environment changed');
      }
    };
  },

  // Browser-only human handoff. Existing UI actions keep their original behavior.
  async switchProjectExact(target, assertBeforeCommit, commit, assertSession) {
    assertBeforeCommit();
    const requested = this._routeSelectionGeneration = (this._routeSelectionGeneration || 0) + 1;
    const currentIntent = () => {
      assertBeforeCommit();
      if (this._routeSelectionGeneration !== requested) { throw new Error('Environment handoff replaced'); }
    };
    await new Promise((done) => this.disconnectSubscribe(done));
    currentIntent();
    let transition;
    const handoff = {target, assertSession};
    try {
      await commit(() => {
        currentIntent();
        this._routeSelectionGeneration = (this._routeSelectionGeneration || 0) + 1;
        this.get('projects').incrementProperty('schemaLoadGeneration');
        this.get('projects').set('schemaProjectId', null);
        this.get('storeReset').reset();
        this.intermediateTransitionTo('authenticated');
        this.set(`tab-session.${C.TABSESSION.PROJECT}`, target.id);
        this._browserEnvironmentHandoff = handoff;
        transition = this.refresh(); handoff.transition = transition;
      });
      await transition; assertSession();
      const projects = this.get('projects'), current = projects.get('current');
      if (this._browserEnvironmentHandoff !== handoff || !current || current.get('id') !== target.id || current.get('uuid') !== target.uuid ||
        current.get('name') !== target.name || projects.get('schemaProjectId') !== target.id) {
        throw new Error('Selected environment did not settle');
      }
      return current;
    } finally {
      if (this._browserEnvironmentHandoff === handoff) { this._browserEnvironmentHandoff = null; }
    }
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
      const session = this.selectionSessionGuard(this.get('access').captureGeneration());
      if (!session.isCurrent()) { return resolve({status: 'stale'}); }
      this._browserEnvironmentHandoff = null;
      const revision = this._routeSelectionGeneration = (this._routeSelectionGeneration || 0) + 1;
      const current = () => this._routeSelectionGeneration === revision && session.isCurrent();
      return new Promise((done, failed) => this.disconnectSubscribe(() => {
        if (!current()) { done({status: 'stale'}); return; }
        let submitted = false;
        session.commit(() => {
          if (!current()) { return; }
          submitted = true;
          this.send('finishSwitchProject', projectId, transition, {isCurrent: current});
        }).then(() => done({status: submitted ? 'accepted' : 'stale'}), (error) => {
          if (!submitted && !current()) { done({status: 'stale'}); }
          else { failed(error); }
        });
      }));
    },

    finishSwitchProject(projectId, transition, intent) {
      if (intent && !intent.isCurrent()) { return; }
      this._browserEnvironmentHandoff = null;
      this._routeSelectionGeneration = (this._routeSelectionGeneration || 0) + 1;
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
