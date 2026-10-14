import $ from 'jquery';
import { scheduleOnce, join } from '@ember/runloop';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import Mixin from '@ember/object/mixin';
import ThrottledResize from 'ui/mixins/throttled-resize';

export default Mixin.create(ThrottledResize, {
  tooltipContent : null,
  originalNode   : null,
  router         : service("-routing"),
  currentRoute   : null,

  tooltipService: service('tooltip'),

  didInsertElement() {
    this._super(...arguments);
    // Resolve the existing virtual methods at event time so action-menu
    // overrides retain their open/inTooltip ownership behavior.
    this._tooltipContentEnter = () => join(this, this.mouseEnter);
    this._tooltipContentLeave = () => join(this, this.mouseLeave);
    this.element.addEventListener('mouseenter', this._tooltipContentEnter);
    this.element.addEventListener('mouseleave', this._tooltipContentLeave);
  },

  willDestroyElement() {
    this.element.removeEventListener('mouseenter', this._tooltipContentEnter);
    this.element.removeEventListener('mouseleave', this._tooltipContentLeave);
    this._super(...arguments);
  },

  mouseEnter: function() {
    this.get('tooltipService').cancelTimer();
  },
  mouseLeave: function() {
    this.destroyTooltip();
  },

  routeObserver: observer('router.currentRouteName', function() {
    // On init
    if (!this.get('currentRoute')) {
      this.set('currentRoute', this.get('router.currentRouteName'));
    }

    // if we change routes tear down the tooltip
    if (this.get('currentRoute') !== this.get('router.currentRouteName')) {
      this.destroyTooltip();
    }
  }).on('init'),

  tooltipConstructor: function() {
    scheduleOnce('afterRender', this, function() {
      if (this.get('tooltipService.tooltipOpts')) {
        this.constructTooltip();
      }
    });
  }.observes('tooltipService.tooltipOpts', 'tooltipService.tooltipOpts.model').on('init'),

  constructTooltip: function() {
    let tts           = this.get('tooltipService');
    let node          = $(this.element);
    let eventPosition = tts.get('tooltipOpts.eventPosition');
    if (tts.get('tooltipOpts.isCopyTo')) {
      const trigger = tts.get('tooltipOpts.originalNode');
      if (!trigger || !trigger[0] || !trigger[0].isConnected) {
        return;
      }
      // A copy hint is text, not a trigger-width menu. Measure after applying
      // its own width and use viewport coordinates for this fixed element.
      node.addClass('copy-clipboard').css({width: 'max-content', maxWidth: `${Math.max(1, Math.min(320, window.innerWidth - 16))}px`});
      const rect = trigger[0].getBoundingClientRect();
      const width = node.outerWidth(), height = node.outerHeight();
      const above = rect.top - height - 7;
      const placement = above >= 8 ? 'top' : 'bottom';
      const top = placement === 'top' ? above : rect.bottom + 7;
      node.removeClass('top bottom left right').addClass(placement).css({
        left: Math.max(8, Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
        visibility: 'visible',
      });
      return;
    }
    // tooltip-basic can be reused for non-copy content without unmounting.
    node.removeClass('copy-clipboard top bottom left right').css({width: '', maxWidth: ''});
    let position      = this.positionTooltip(node, eventPosition);
    let css           = {visibility: 'visible'};

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
