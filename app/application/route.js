import Ember from 'ember';
import C from 'ui/utils/constants';

export default Ember.Route.extend({
  access         : Ember.inject.service(),
  cookies        : Ember.inject.service(),
  github         : Ember.inject.service(),
  language       : Ember.inject.service('user-language'),
  modal          : Ember.inject.service(),
  oidc           : Ember.inject.service(),
  settings       : Ember.inject.service(),

  previousParams : null,
  previousRoute  : null,
  loadingShown   : false,
  loadingId      : 0,
  hideTimer      : null,
  loadingWatchdog: null,
  loadingTimeout : 30000,
  previousLang   : null,

  init() {
    this._super(...arguments);
    this.registerShortcuts();
  },

  willDestroy() {
    Ember.run.cancel(this.get('hideTimer'));
    Ember.run.cancel(this.get('loadingWatchdog'));
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

      if ( err && err.status && [401,403].indexOf(err.status) >= 0 )
      {
        this.send('logout',transition,true);
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
      let session = this.get('session');
      let access = this.get('access');

      access.clearToken().finally(() => {
        session.set(C.SESSION.ACCOUNT_ID,null);

        this.get('tab-session').clear();

        access.clearSessionKeys();

        if ( transition && !session.get(C.SESSION.BACK_TO) ) {
          session.set(C.SESSION.BACK_TO, window.location.href);
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
      });
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
    Ember.run.cancel(this.get('hideTimer'));
    Ember.run.cancel(this.get('loadingWatchdog'));
    this.setProperties({
      hideTimer      : null,
      loadingShown   : true,
      loadingWatchdog: Ember.run.later(this, function() {
        this.hideLoadingOverlay(id);
      }, this.get('loadingTimeout')),
    });

    // Stop both layers independently.  The previous nested fade callback
    // could re-show the overlay after a newer transition had already hidden
    // it, leaving the application permanently blocked.
    Ember.$('#loading-underlay, #loading-overlay')
      .stop(true, true)
      .css('opacity', 1)
      .show();
  },

  scheduleLoadingOverlayHide(id) {
    if ( id !== this.get('loadingId') ) {
      return;
    }

    Ember.run.cancel(this.get('hideTimer'));
    this.set('hideTimer', Ember.run.scheduleOnce('afterRender', this, function() {
      this.hideLoadingOverlay(id);
    }));
  },

  hideLoadingOverlay(expectedId) {
    if ( expectedId !== undefined && expectedId !== this.get('loadingId') ) {
      return;
    }

    Ember.run.cancel(this.get('hideTimer'));
    Ember.run.cancel(this.get('loadingWatchdog'));
    this.setProperties({
      hideTimer      : null,
      loadingShown   : false,
      loadingWatchdog: null,
    });

    Ember.$('#loading-overlay, #loading-underlay').stop(true, true).hide();
  },

  finishLogin() {
    let session = this.get('session');

    let backTo = session.get(C.SESSION.BACK_TO);
    session.set(C.SESSION.BACK_TO, undefined);

    if ( backTo ) {
      console.log('Going back to', backTo);
      window.location.href = backTo;
    } else {
      this.get('router').replaceWith('authenticated');
    }
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
      let path = params.redirectTo;
      if ( path.substr(0,1) === '/' ) {
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
        return Ember.RSVP.reject('oidcTest');
      }

      let oidcCode;
      try {
        oidcCode = this.get('oidc').consumeAuthorization({
          code: params.code,
          error: params.oidcError,
          errorDescription: params.error_description,
          state: params.state,
        });
      } catch (err) {
        transition.abort();
        this.get('router').transitionTo('login', {queryParams: {errorMsg: err.message}});
        return Ember.RSVP.reject(err);
      }

      return languagePromise.then(() => this.get('access').login(oidcCode)).then((xhr) => {
        transition.abort();
        if ( xhr.body && xhr.body.mfaRequired ) {
          this.get('router').transitionTo('login');
        } else {
          this.finishLogin();
        }
      }).catch((err) => {
        transition.abort();
        this.get('router').transitionTo('login', {queryParams: {errorMsg: err.message}});
      });
    } else if ( !isOidcCallback && params.isTest ) {
      if ( github.stateMatches(params.state) ) {
        reply(params.error_description, params.code);
      } else {
        reply(stateMsg);
      }

      transition.abort();

      return Ember.RSVP.reject('isTest');

    } else if ( !isOidcCallback && params.code ) {

      if ( github.stateMatches(params.state) ) {
        return languagePromise.then(() => this.get('access').login(params.code)).then((xhr) => {
          // Abort the orignial transition that was coming in here since
          // we'll redirect the user manually in finishLogin
          // if we dont then model hook runs twice to finish the transition itself
          transition.abort();
          // Can't call this.send() here because the initial transition isn't done yet
          if ( xhr.body && xhr.body.mfaRequired ) {
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

        return Ember.RSVP.reject(obj);
      }
    }

    return languagePromise;

    function reply(err,code) {
      try {
        window.opener.window.onGithubTest(err,code);
        setTimeout(function() {
          window.close();
        },250);
        return new Ember.RSVP.promise();
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
