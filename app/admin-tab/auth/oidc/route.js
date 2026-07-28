import Ember from 'ember';

const DEFAULTS = {
  displayName: 'OpenID Connect',
  scopes: 'openid',
  usernameClaim: 'preferred_username',
  displayNameClaim: 'name',
  emailClaim: 'email',
  groupsClaim: 'groups',
  usePkce: true,
};

export default Ember.Route.extend({
  access: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  model: function() {
    let configPromise = this.get('authStore').find('config', null, {forceReload: true}).then((config) => {
      let current = config.get('oidcConfig') || {};
      let oidcConfig = this.get('authStore').createRecord(current, {type: 'oidcconfig'});
      let schema = this.get('authStore').getById('schema', 'oidcconfig');
      let fields = schema ? schema.get('resourceFields') : {};

      Object.keys(fields || {}).forEach((key) => {
        let field = fields[key];
        if ( field && typeof field.default !== 'undefined' &&
             (typeof oidcConfig.get(key) === 'undefined' || oidcConfig.get(key) === null) ) {
          oidcConfig.set(key, field.default);
        }
      });

      Object.keys(DEFAULTS).forEach((key) => {
        if ( typeof oidcConfig.get(key) === 'undefined' || oidcConfig.get(key) === null ) {
          oidcConfig.set(key, DEFAULTS[key]);
        }
      });

      config.set('oidcConfig', oidcConfig);
      return config;
    });

    let localRecoveryPromise = Ember.RSVP.resolve(null);
    if ( this.get('access.enabled') && this.get('access.provider') === 'localauthconfig' ) {
      localRecoveryPromise = this.get('userStore').find('localauthconfig', null, {forceReload: true}).then((collection) => {
        return collection.get('firstObject');
      });
    }

    return Ember.RSVP.hash({
      config: configPromise,
      localRecoveryConfig: localRecoveryPromise,
    });
  },

  setupController: function(controller, result) {
    let model = result.config;
    this._super(controller, model);

    controller.setProperties({
      advancedOpen: false,
      confirmDisable: false,
      errors: null,
      activating: false,
      preparedFingerprint: null,
      preparedModel: null,
      preparedToken: null,
      recoveryEnabled: !!this.get('access.enabled'),
      recoveryLocalModel: result.localRecoveryConfig ? result.localRecoveryConfig.clone() : null,
      recoveryModel: model.clone(),
      recoveryProvider: this.get('access.provider') || model.get('provider'),
      saving: false,
      saved: false,
      testedFingerprint: null,
      testedIdentity: null,
      testing: false,
    });
  },
});
