import Ember from 'ember';
import Tooltip from 'ui/mixins/tooltip';
import { resolveTooltipContentComponent } from 'ui/utils/tooltip-content-component';

export default Ember.Component.extend(Tooltip, {
  needs   : ['application'],
  model   : Ember.computed.alias('tooltipService.tooltipOpts.model'),
  display : null,

  contentComponent: function() {
    var template = this.get('tooltipService.tooltipOpts.template');

    return resolveTooltipContentComponent(template, 'tooltip-basic');
  }.property('tooltipService.tooltipOpts.template')

});
