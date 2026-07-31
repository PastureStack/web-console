import { computed, observer } from '@ember/object';
import { alias, equal } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  intl: service(),
  service           : null,

  lbConfig: alias('service.lbConfig'),

  lbCookie         : null,
  stickiness       : 'none',
  isNone           : equal('stickiness','none'),
  isCookie         : equal('stickiness','cookie'),

  modeChoices: computed('intl._locale', function() {
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

  stickinessDidChange: observer('stickiness', 'lbConfig.canSticky', function() {
    var stickiness = this.get('stickiness');
    if ( !this.get('lbConfig.canSticky') || stickiness === 'none' )
    {
      this.set('lbConfig.stickinessPolicy', null);
    }
    else if ( stickiness === 'cookie' )
    {
      this.set('lbConfig.stickinessPolicy', this.get('policy'));
    }
  }),
});
