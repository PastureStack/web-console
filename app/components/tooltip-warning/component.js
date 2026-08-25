import { service } from '@ember/service';
import Component from '@ember/component';
import Tooltip from 'ui/mixins/tooltip';
import C from 'ui/utils/constants';

export default Component.extend(Tooltip, {
  prefs: service(),
  classNames: ['tooltip-warning-container'],
  actions: {
    hideAccessWarning: function() {
      this.set(`prefs.${C.PREFS.ACCESS_WARNING}`, false);
      this.destroyTooltip();
    },

  }
});
