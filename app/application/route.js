import { Promise, reject } from 'rsvp';
import $ from 'jquery';
import { cancel, later, scheduleOnce } from '@ember/runloop';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';
import { isAuthenticationPath, safeInternalTarget } from 'ui/utils/auth-navigation';

export default Route.extend({
  access         : service(),
  cookies        : service(),
  github         : service(),
  intl           : service(),
  language       : service('user-language'),
  modal          : service(),
  oidc           : service(),
  settings       : service(),

  previousParams : null,
  previousRoute  : null,
  loadingShown   : false,
  loadingId      : 0,
  hideTimer      : null,
  loadingWatchdog: null,
  loadingTimeout : 30000,
  previousLang   : null,
  sessionSyncPromise: null,
  syncingGeneration: null,
  lastSyncedGeneration: null,
  pendingSyncGeneration: null,

  init() {
    this._super(...arguments);
    this.registerShortcuts();
  },

  willDestroy() {
    cancel(this.get('hideTimer'));
    cancel(this.get('loadingWatchdog'));
    this.hideLoadingOverlay();
    this.unregisterShortcuts();
    this._super(...arguments);
  },

  registerShortcuts() {
    let manager = this.get('shortcutManager');
    if (manager && typeof manager.register === 'function') {
      manager.register(this, this.get('shortcuts'));
    }
  },

  unregisterShortcuts() {
    let manager = this.get('shortcutManager');
    if (manager && typeof manager.unregister === 'function') {
      manager.unregister(this);
    }
  },

  actions: {
    didTransition() {
      // The initial loading overlay is visible in the static HTML.  A fast
      // route can complete without entering the loading substate, so always
      // reconcile the overlay after the first successful render.
      this.scheduleLoadingOverlayHide(this.get('loadingId'));
      return true;
    },

    loading(transition) {
      if ( transition && !transition.authGeneration ) {
        transition.authGeneration = this.get('access').captureGeneration();
      }
      this.incrementProperty('loadingId');
      let id = this.get('loadingId');
      this.showLoadingOverlay(id);

      let settled = () => this.scheduleLoadingOverlayHide(id);
      if ( transition && typeof transition.then === 'function' ) {
        // Handle both fulfilled and rejected/aborted transitions.  Supplying
        // both callbacks also prevents an ignored finally() promise from
        // becoming an unhandled rejection in modern Ember.
        transition.then(settled, settled);
      } else {
        settled();
      }

      return true;
    },

    error(err, transition) {
      this.hideLoadingOverlay();

      /*if we dont abort the transition we'll call the model calls again and fail transition correctly*/
      transition.abort();

      if ( Errors.status(err) === 401 )
      {
        this.send('sessionInvalid', transition, true, null,
          transition && transition.authGeneration, 401);
        return;
      }

      this.controllerFor('application').set('error',err);
      this.get('router').transitionTo('failWhale');

      console.log('Application Error', (err ? err.stack : undefined));
    },

    goToPrevious(def) {
      this.goToPrevious(def);
    },

    finishLogin() {
      this.finishLogin();
    },

    logout(transition, timedOut, errorMsg) {
      return this.get('access').explicitLogout().then((outcome) => {
        if ( outcome && outcome.status === 'stale' ) {
          this.reloadForSession();
          return;
        }
        this.transitionToLogin(transition, timedOut, errorMsg);
      }).catch((error) => {
        this.controllerFor('application').set('error', error);
        this.get('router').transitionTo('failWhale');
      });
    },

    sessionInvalid(transition, timedOut, errorMsg, generation, status=401) {
      generation = generation || (transition && transition.authGeneration) ||
        this.get('access').captureGeneration();
      return this.get('access').handlePassiveFailure(generation, status).then((outcome) => {
        if ( outcome.status === 'adopted' || outcome.status === 'stale' ) {
          this.reloadForSession();
        } else if ( outcome.status === 'active' && transition ) {
          // A pre-fix tab can still remove the shared JavaScript cookie after
          // its protected DELETE is rejected by the server.  If this tab
          // restored its own in-memory token snapshot, the failed transition
          // was already aborted and must be resumed without another login.
          this.reloadForSession();
        } else if ( outcome.status === 'invalid' ) {
          this.transitionToLogin(transition, timedOut, errorMsg);
        } else if ( outcome.status === 'forbidden' ) {
          this.get('router').replaceWith('authenticated');
        }
      }).catch((error) => {
        this.controllerFor('application').set('error', error);
        this.get('router').transitionTo('failWhale');
      });
    },

    authSessionChanged(change) {
      let generation = change && change.newRecord && change.newRecord.generation;
      if ( generation && generation === this.get('lastSyncedGeneration') ) {
        return this.get('sessionSyncPromise');
      }
      if ( this.get('sessionSyncPromise') ) {
        if ( generation && generation === this.get('syncingGeneration') ) {
          return this.get('sessionSyncPromise');
        }
        this.set('pendingSyncGeneration', generation || 'removed');
        return this.get('sessionSyncPromise');
      }

      this.set('syncingGeneration', generation || 'removed');
      let promise = this.get('access').adoptSharedSession().then((outcome) => {
        if ( outcome.status === 'adopted' ) {
          this.set('lastSyncedGeneration', outcome.generation);
          this.reloadForSession();
        } else if ( outcome.status === 'invalid' ) {
          this.transitionToLogin(null, true);
        }
        return outcome;
      }).finally(() => {
        this.setProperties({
          sessionSyncPromise: null,
          syncingGeneration : null,
        });
        if ( this.get('pendingSyncGeneration') ) {
          this.set('pendingSyncGeneration', null);
          scheduleOnce('actions', this, function() {
            this.send('authSessionChanged', {
              newRecord: this.get('access.authSession').readShared(),
            });
          });
        }
      });
      this.set('sessionSyncPromise', promise);
      return promise;
    },

    langToggle() {
      let svc = this.get('language');
      let cur = svc.getLocale();
      if ( cur === 'none' ) {
        svc.sideLoadLanguage(this.get('previousLang')||'en-us');
      } else {
        this.set('previousLang', cur);
        svc.sideLoadLanguage('none');
      }
    }
  },

  shortcuts: {
    'shift+l': 'langToggle',
  },

  showLoadingOverlay(id) {
    cancel(this.get('hideTimer'));
    cancel(this.get('loadingWatchdog'));
    this.setProperties({
      hideTimer      : null,
      loadingShown   : true,
      loadingWatchdog: later(this, function() {
        this.hideLoadingOverlay(id);
      }, this.get('loadingTimeout')),
    });

    // Stop both layers independently.  The previous nested fade callback
    // could re-show the overlay after a newer transition had already hidden
    // it, leaving the application permanently blocked.
    $('#loading-underlay, #loading-overlay')
      .stop(true, true)
      .css('opacity', 1)
      .show();
  },

  scheduleLoadingOverlayHide(id) {
    if ( id !== this.get('loadingId') ) {
      return;
    }

    cancel(this.get('hideTimer'));
    this.set('hideTimer', scheduleOnce('afterRender', this, function() {
      this.hideLoadingOverlay(id);
    }));
  },

  hideLoadingOverlay(expectedId) {
    if ( expectedId !== undefined && expectedId !== this.get('loadingId') ) {
      return;
    }

    cancel(this.get('hideTimer'));
    cancel(this.get('loadingWatchdog'));
    this.setProperties({
      hideTimer      : null,
      loadingShown   : false,
      loadingWatchdog: null,
    });

    $('#loading-overlay, #loading-underlay').stop(true, true).hide();
  },

  finishLogin() {
    let session = this.get('session');

    let backTo = session.get(C.SESSION.BACK_TO);
    session.set(C.SESSION.BACK_TO, undefined);

    let target = safeInternalTarget(backTo);
    if ( target ) {
      window.location.replace(target);
    } else {
      this.get('router').replaceWith('authenticated');
    }
  },

  transitionToLogin(transition, timedOut, errorMsg) {
    let session = this.get('session');
    session.set(C.SESSION.ACCOUNT_ID, null);
    this.get('tab-session').clear();

    if ( transition && !session.get(C.SESSION.BACK_TO) ) {
      let returnTo = safeInternalTarget(window.location.href);
      if ( returnTo && !isAuthenticationPath(returnTo) ) {
        session.set(C.SESSION.BACK_TO, returnTo);
      }
    }

    if ( this.get('modal.modalVisible') ) {
      this.get('modal').toggleModal();
    }

    let params = {queryParams: {}};
    if ( timedOut ) {
      params.queryParams.timedOut = true;
    }
    if ( errorMsg ) {
      params.queryParams.errorMsg = errorMsg;
    }
    this.get('router').transitionTo('login', params);
  },

  reloadForSession() {
    let current = safeInternalTarget(window.location.href);
    let backTo = safeInternalTarget(this.get(`session.${C.SESSION.BACK_TO}`));
    let target = current && !isAuthenticationPath(current) ? current : backTo;
    if ( !target || isAuthenticationPath(target) ) {
      this.get('router').replaceWith('authenticated');
      return;
    }
    window.location.replace(target);
  },

  model(params, transition) {
    let github   = this.get('github');
    let stateMsg = 'Authorization state did not match, please try again.';
    let isOidcCallback = transition.targetName === 'login.oidc-auth';

    let languagePromise = this.get('language').initLanguage();

    transition.finally(() => {
      this.controllerFor('application').setProperties({
        state: null,
        code: null,
        error_description: null,
        oidcError: null,
        redirectTo: null,
      });
    });

    if ( params.redirectTo ) {
      let path = safeInternalTarget(params.redirectTo);
      if ( path ) {
        this.get('session').set(C.SESSION.BACK_TO, path);
      }
    }

    if (params.isPopup) {
      this.controllerFor('application').set('isPopup', true);
    }

    if ( isOidcCallback && (params.code || params.oidcError) ) {
      if ( window.opener && !window.opener.closed && typeof window.opener.onOidcTest === 'function' ) {
        window.opener.onOidcTest(params.oidcError, params.error_description, params.code, params.state);
        transition.abort();
        setTimeout(function() {
          window.close();
        }, 250);
        return reject('oidcTest');
      }

      let oidcLogin;
      try {
        oidcLogin = this.get('oidc').consumeLoginAuthorization({
          code: params.code,
          error: params.oidcError,
          errorDescription: params.error_description,
          state: params.state,
        });
      } catch (err) {
        transition.abort();
        this.get('router').transitionTo('login', {queryParams: {
          errorMsg: Errors.stringify(err) || this.get('intl').t('loginOidc.error.generic'),
        }});
        return reject(err);
      }

      return languagePromise.then(() => this.get('access').login(
        oidcLogin.code, undefined, undefined, oidcLogin.authSessionAttempt
      )).then((xhr) => {
        transition.abort();
        if ( xhr.authSessionSuperseded ) {
          this.reloadForSession();
        } else if ( xhr.body && xhr.body.mfaRequired ) {
          this.get('router').transitionTo('login');
        } else {
          this.finishLogin();
        }
      }).catch((err) => {
        transition.abort();
        this.get('router').transitionTo('login', {queryParams: {
          errorMsg: Errors.stringify(err) || this.get('intl').t('loginOidc.error.generic'),
        }});
      });
    } else if ( !isOidcCallback && params.isTest ) {
      if ( github.stateMatches(params.state) ) {
        reply(params.error_description, params.code);
      } else {
        reply(stateMsg);
      }

      transition.abort();

      return reject('isTest');

    } else if ( !isOidcCallback && params.code ) {

      if ( github.stateMatches(params.state) ) {
        return languagePromise.then(() => this.get('access').login(params.code)).then((xhr) => {
          // Abort the orignial transition that was coming in here since
          // we'll redirect the user manually in finishLogin
          // if we dont then model hook runs twice to finish the transition itself
          transition.abort();
          // Can't call this.send() here because the initial transition isn't done yet
          if ( xhr.authSessionSuperseded ) {
            this.reloadForSession();
          } else if ( xhr.body && xhr.body.mfaRequired ) {
            this.get('router').transitionTo('login');
          } else {
            this.finishLogin();
          }
        }).catch((err) => {
          transition.abort();
          this.get('router').transitionTo('login', {queryParams: { errorMsg: err.message}});
        }).finally(() => {
          this.controllerFor('application').setProperties({
            state: null,
            code: null,
          });
        });

      } else {

        let obj = {message: stateMsg, code: 'StateMismatch'};

        this.controllerFor('application').set('error', obj);

        return reject(obj);
      }
    }

    return languagePromise;

    function reply(err,code) {
      try {
        window.opener.window.onGithubTest(err,code);
        setTimeout(function() {
          window.close();
        },250);
        return new Promise(() => {});
      } catch(e) {
        window.close();
      }
    }
  },

  updateWindowTitle: function() {
    document.title = this.get('settings.appName');
  }.observes('settings.appName'),

  beforeModel() {
    this.updateWindowTitle();

    let agent = window.navigator.userAgent.toLowerCase();

    if ( agent.indexOf('msie ') >= 0 || agent.indexOf('trident/') >= 0 ) {
      this.get('router').replaceWith('ie');
      return;
    }

    // Find out if auth is enabled
    return this.get('access').detect();
  },
});
