import Ember from 'ember';

export default Ember.Component.extend({
  intl: Ember.inject.service(),
  service           : null,

  lbConfig: Ember.computed.alias('service.lbConfig'),

  lbCookie         : null,
  stickiness       : 'none',
  isNone           : Ember.computed.equal('stickiness','none'),
  isCookie         : Ember.computed.equal('stickiness','cookie'),

  modeChoices: Ember.computed('intl._locale', function() {
    return [
      {value: 'rewrite', label: this.get('intl').t('formStickiness.modeChoices.rewrite')},
      {value: 'insert',  label: this.get('intl').t('formStickiness.modeChoices.insert')},
      {value: 'prefix',  label: this.get('intl').t('formStickiness.modeChoices.prefix')},
    ];
  }),

  init() {
    this._super(...arguments);

    var policy  = this.get('lbConfig.stickinessPolicy');
    var stickiness = 'none';

    if ( policy )
    {
      stickiness = 'cookie';
    }

    if ( !policy )
    {
      policy = this.get('store').createRecord({
        type: 'loadBalancerCookieStickinessPolicy'
      });
    }

    this.setProperties({
      policy: policy,
      stickiness: stickiness,
    });
  },

  stickinessDidChange: function() {
    var stickiness = this.get('stickiness');
    if ( !this.get('lbConfig.canSticky') || stickiness === 'none' )
    {
      this.set('lbConfig.stickinessPolicy', null);
    }
    else if ( stickiness === 'cookie' )
    {
      this.set('lbConfig.stickinessPolicy', this.get('policy'));
    }
  }.observes('stickiness','lbConfig.canSticky'),
});
