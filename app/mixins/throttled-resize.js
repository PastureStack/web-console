import { next, throttle, cancel } from '@ember/runloop';
import Mixin from '@ember/object/mixin';

import { on } from '@ember/object/evented';

export default Mixin.create({
  boundResize: null,
  throttleTimer: null,
  resizeInterval: 200,

  setup: on('init', function() {

    this.set('boundResize', this.triggerResize.bind(this));
    $(window).on('resize', this.get('boundResize'));
    $(window).on('focus', this.get('boundResize'));
    next(this,'onResize');
  }),

  triggerResize: function() {
    var timer = throttle(this, 'onResize', this.get('resizeInterval'), false);
    this.set('throttleTimer', timer);
  },

  onResize: function() {
    // Override me with resize logic
  },

  willDestroyElement: function() {
    cancel(this.get('throttleTimer'));
    $(window).off('resize', this.get('boundResize'));
    $(window).off('focus', this.get('boundResize'));
  },
});
