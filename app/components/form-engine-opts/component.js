import Ember from 'ember';
import C from 'ui/utils/constants';

export default Ember.Component.extend({
  machine: null,
  settings: Ember.inject.service(),
  intl: Ember.inject.service(),
  showEngineUrl: null,

  didReceiveAttrs() {
    if ( this.get('machine.engineInstallUrl') === undefined && this.get('showEngineUrl') )
    {
      this.set('machine.engineInstallUrl', this.get(`settings.${C.SETTING.ENGINE_URL}`) || '');
    }
  },

  engineUrlChoices: function() {
    let def = this.get(`settings.${C.SETTING.ENGINE_URL}`);
    let out = [
      {label: this.get('intl').t('formEngineOpts.engineInstallUrl.recommended'), value: def},
      // Do not offer unreviewed legacy remote-install scripts. Operators can
      // still enter an explicitly reviewed URL in the text field.
      {label: this.get('intl').t('formEngineOpts.engineInstallUrl.latest'), value: 'https://get.docker.com'},
    ];

    return out;
  }.property('intl._locale',`settings.${C.SETTING.ENGINE_URL}`),

  actions: {
    setEngine(url) {
      this.set('machine.engineInstallUrl', url);
    }
  }
});
