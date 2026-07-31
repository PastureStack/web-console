import $ from 'jquery';
import { scheduleOnce } from '@ember/runloop';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import Mixin from '@ember/object/mixin';
import ThrottledResize from 'ui/mixins/throttled-resize';

import { on } from '@ember/object/evented';

export default Mixin.create(ThrottledResize, {
  tooltipContent : null,
  originalNode   : null,
  router         : service("-routing"),
  currentRoute   : null,

  tooltipService: service('tooltip'),

  mouseEnter: function() {
    this.get('tooltipService').cancelTimer();
  },
  mouseLeave: function() {
    this.destroyTooltip();
  },

  routeObserver: on('init', observer('router.currentRouteName', function() {
    // On init
    if (!this.get('currentRoute')) {
      this.set('currentRoute', this.get('router.currentRouteName'));
    }

    // if we change routes tear down the tooltip
    if (this.get('currentRoute') !== this.get('router.currentRouteName')) {
      this.destroyTooltip();
    }
  })),

  tooltipConstructor: on('init', observer('tooltipService.tooltipOpts', function() {
    scheduleOnce('afterRender', this, function() {
      if (this.get('tooltipService.tooltipOpts')) {
        this.constructTooltip();
      }
    });
  })),

  constructTooltip: function() {
    let tts           = this.get('tooltipService');
    let node          = $(this.element);
    let eventPosition = tts.get('tooltipOpts.eventPosition');
    let position      = this.positionTooltip(node, eventPosition);
    let css           = {visibility: 'visible'};

    if ( tts.get('tooltipOpts.isCopyTo') ) {
      css.width = position.width + 1;
    }

    node.offset(position).addClass(`${position.placement} ${tts.tooltipOpts.baseClass}`).css(css);
  },

  destroyTooltip: function() {
    this.get('tooltipService').startTimer();
  },

  positionTooltip: function(node, position) {

    let windowWidth        = window.innerWidth;
    let originalNodeWidth  = this.get('tooltipService.tooltipOpts.originalNode').outerWidth();
    let originalNodeHeight = this.get('tooltipService.tooltipOpts.originalNode').outerHeight();
    let nodeHeight         = node.outerHeight();
    let nodeWidth          = node.outerWidth();

    if (nodeWidth >= position.left) {
      position.placement = 'left';
      position.top       = position.top + (originalNodeHeight/2) - (nodeHeight/2);
      position.left      = position.left + originalNodeWidth + 7;

    } else if (nodeWidth >= (windowWidth - position.left)) {
      position.placement = 'right';
      position.left      = position.left - nodeWidth - 7;
      position.top       = position.top + (originalNodeHeight/2) - (nodeHeight/2);

    } else if (nodeHeight >= position.top) {
      position.placement = 'bottom';
      position.top       = position.top +  originalNodeHeight + 7;
      position.left      = position.left + (originalNodeWidth/2) - (nodeWidth/2);

    } else {
      position.placement = 'top';
      position.top       = position.top -  (nodeHeight + 7);
      position.left      = position.left + (originalNodeWidth/2) - (nodeWidth/2);

    }

    position.width = nodeWidth;

    return position;
  },
});
