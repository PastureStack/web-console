import { get } from '@ember/object';
import $ from 'jquery';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import { isAlternate } from 'ui/utils/platform';

export default Component.extend({
  model           : null,
  size            : 'xs',
  showPrimary     : true,
  inTooltip       : false,

  resourceActions : service('resource-actions'),

  tagName         : 'div',
  classNames      : ['btn-group','resource-actions','action-menu'],
  tooltipService  : service('tooltip'),

  primaryAction   : alias('model.primaryAction'),

  click(e) {
    var tgt = $(e.target);
    var more = tgt.closest('.more-actions');
    if ( more && more.length ) {
      e.preventDefault();
      e.stopPropagation();

      if (this.get('inTooltip')) {
        this.get('resourceActions').set('tooltipActions', true);
      } else {
        this.get('resourceActions').set('tooltipActions', false);
      }

      this.get('resourceActions').show(this.get('model'), more, this.$());
    } else {
      let idx = parseInt(tgt.closest('BUTTON').data('primary'),10);
      if ( !isNaN(idx) ) {
        var action = this.get('model.primaryAction');
        if ( action ) {
          e.preventDefault();
          e.stopPropagation();

          if ( isAlternate(e) && get(action,'altAction') ) {
            this.sendToModel(get(action,'altAction'));
          } else {
            this.sendToModel(get(action,'action'));
          }
        }
      }
    }
  },

  sendToModel(action) {
    this.get('tooltipService').leave();
    this.get('model').send(action);
  },
});
