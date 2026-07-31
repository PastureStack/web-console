import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Component.extend({
  machine: null,
  settings: service(),
  intl: service(),
  showEngineUrl: null,

  didReceiveAttrs() {
    if ( this.get('machine.engineInstallUrl') === undefined && this.get('showEngineUrl') )
    {
      this.set('machine.engineInstallUrl', this.get(`settings.${C.SETTING.ENGINE_URL}`) || '');
    }
  },

  engineUrlChoices: computed('intl._locale', `settings.${C.SETTING.ENGINE_URL}`, function() {
    let def = this.get(`settings.${C.SETTING.ENGINE_URL}`);
    let out = [
      {label: this.get('intl').t('formEngineOpts.engineInstallUrl.recommended'), value: def},
      // Do not offer unreviewed legacy remote-install scripts. Operators can
      // still enter an explicitly reviewed URL in the text field.
      {label: this.get('intl').t('formEngineOpts.engineInstallUrl.latest'), value: 'https://get.docker.com'},
    ];

    return out;
  }),

  actions: {
    setEngine(url) {
      this.set('machine.engineInstallUrl', url);
    }
  }
});
