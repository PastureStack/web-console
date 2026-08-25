import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import Tooltip from 'ui/mixins/tooltip';
import { resolveTooltipContentComponent } from 'ui/utils/tooltip-content-component';

export default Component.extend(Tooltip, {
  needs   : ['application'],
  model   : alias('tooltipService.tooltipOpts.model'),
  display : null,

  contentComponent: function() {
    var template = this.get('tooltipService.tooltipOpts.template');

    return resolveTooltipContentComponent(template, 'tooltip-basic');
  }.property('tooltipService.tooltipOpts.template')

});
