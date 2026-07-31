import { observer } from '@ember/object';
import $ from 'jquery';
import { service } from '@ember/service';
import Component from '@ember/component';
import { isMore } from 'ui/utils/platform';

import { on } from '@ember/object/evented';

export default Component.extend({
  resourceActions : service('resource-actions'),
  tooltipService  : service('tooltip'),
  model           : null,
  tagName         : 'span',
  type            : 'tooltip-action-menu',
  template        : null,

  click(event) {
    this.details(event);
    this.get('tooltipService').hide();
  },

  details(/*event*/) {

    var route = 'container';
    if ( this.get('model.isVm') )
      {
        route = 'virtualmachine';
      }

      this.get('router').transitionTo(route, this.get('model.id'));
  },

  contextMenu(event) {
    if ( isMore(event) ) {
      return;
    }

    event.preventDefault();

    if (this.get('type') === 'tooltip-action-menu') {

      this.get('resourceActions').set('open', true);
      this.get('tooltipService').set('openedViaContextClick', true);
      $('.container-tooltip .more-actions').trigger('click');
    } else {

      this.get('resourceActions').show(this.get('model'), this.$());
    }
  },

  resourceActionsObserver: on('init', observer('resourceActions.open', function() {

    if (this.get('tooltipService.openedViaContextClick')) {

      this.get('tooltipService').set('openedViaContextClick', false);
    }

  })),
});
