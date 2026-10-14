import { later, cancel, join } from '@ember/runloop';
import $ from 'jquery';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';

const DELAY = 100;

export default Component.extend({
  classNameBindings : ['inlineBlock:inline-block','clip:clip'],
  tooltipService   : service('tooltip'),
  inlineBlock      : true,
  clip             : false,
  model            : null,
  size             : 'default',
  ariaRole         : ['tooltip'],
  textChangedEvent : null,
  tooltipFor       : null,

  showTimer        : null,

  didInsertElement() {
    this._super(...arguments);
    // Ember 5 no longer delegates these non-bubbling DOM events. Own the
    // listeners locally instead of changing the application's event map.
    this._tooltipEnter = (event) => join(this, this.mouseEnter, event);
    this._tooltipLeave = () => join(this, this.mouseLeave);
    this.element.addEventListener('mouseenter', this._tooltipEnter);
    this.element.addEventListener('mouseleave', this._tooltipLeave);
  },

  textChanged: observer('textChangedEvent', function() {
    this.show(this.get('textChangedEvent'));
  }),

  mouseEnter(evt) {
    if ( !this.get('tooltipService.requireClick') )
      {
        let tgt = $(evt.currentTarget);

        if (this.get('tooltipService.tooltipOpts')) {
          this.set('tooltipService.tooltipOpts', null);
        }

        // Wait for a little bit of time so that the mouse can pass through
        // another tooltip-element on the way to the dropdown trigger of a
        // tooltip-action-menu without changing the tooltip.
        this.set('showTimer', later(() => {
          this.show(tgt);
        }, DELAY));
      }
  },

  show(node) {
    if ( this.isDestroyed || this.isDestroying ) {
      return;
    }

    let svc = this.get('tooltipService');

    this.set('showTimer', null);
    svc.cancelTimer();

    let out = {
      type          : this.get('type'),
      baseClass     : this.get('baseClass'),
      eventPosition : node.offset(),
      originalNode  : node,
      model         : this.get('model'),
      template      : this.get('tooltipTemplate'),
      tooltipFor    : this.get('tooltipFor'),
    };

    if ( this.get('isCopyTo') ) {
      out.isCopyTo = true;
    }

    svc.set('tooltipOpts', out);
  },

  mouseLeave: function() {
    if (!this.get('tooltipService.openedViaContextClick')) {
      if ( this.get('showTimer') ) {
        cancel(this.get('showTimer'));
      }
      else {
        this.get('tooltipService').leave();
      }
    }
  },

  modelObserver: observer('model', 'textChangedEvent', function() {
    let opts = this.get('tooltipService.tooltipOpts');
    if ((opts) && this.get('tooltipFor') === opts.tooltipFor ) {
      // Many copy controls share the same tooltip name. Only its actual
      // trigger may update the active hint when locale or feedback changes.
      if (this.get('isCopyTo') && (!opts.originalNode || !this.element ||
        !this.element.contains(opts.originalNode[0]))) {
        return;
      }
      this.set('tooltipService.tooltipOpts.model', this.get('model'));
    }
  }),

  willDestroyElement() {
    this.element.removeEventListener('mouseenter', this._tooltipEnter);
    this.element.removeEventListener('mouseleave', this._tooltipLeave);
    cancel(this.get('showTimer'));
    const opts = this.get('tooltipService.tooltipOpts');
    if (this.get('isCopyTo') && opts && opts.originalNode && this.element &&
      this.element.contains(opts.originalNode[0])) {
      this.set('tooltipService.tooltipOpts', null);
    }
    this._super(...arguments);
  },
});
