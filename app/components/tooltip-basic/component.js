import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import Tooltip from 'ui/mixins/tooltip';

import { computed } from '@ember/object';

export default Component.extend(Tooltip, {
  needs   : ['application'],
  model   : alias('tooltipService.tooltipOpts.model'),
  display : null,

  selectPartial: computed('tooltipService.tooltipOpts.template', function() {
    var template = this.get('tooltipService.tooltipOpts.template');
    var out      = template;

    if (!template) {
      out = 'tooltip-basic';
    }

    return out;
  })

});
