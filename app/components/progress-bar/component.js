import Component from '@ember/component';

import { computed, observer } from '@ember/object';

export default Component.extend({
  tagName: 'div',
  classNames: ['progress'],

  color: '',
  textSuffix: '% Complete',
  min: 0,
  value: 0,
  max: 100,
  zIndex: null,

  percent: computed('min', 'max', 'value', function() {
    var min   = this.get('min');
    var max   = this.get('max');
    var value = Math.max(min, Math.min(max, this.get('value')));

    var per = value/(max-min)*100; // Percent 0-100
    per = Math.round(per*100)/100; // Round to 2 decimal places
    return per;
  }),

  textLabel: computed('percent', 'textSuffix', function() {
    return this.get('percent') + this.get('textSuffix');
  }),

  colorClass: computed('color', function() {
    var color = this.get('color');
    if ( !color )
    {
      return;
    }

    return 'progress-bar-' + color.replace(/^progress-bar-/,'');
  }),

  percentDidChange: observer('percent', function() {
    this.$('.progress-bar').css('width', this.get('percent') + "%");
  }),

  zIndexDidChange: observer('zIndex', function() {
    this.$().css('zIndex', this.get('zIndex') || "inherit");
  }),

  didInsertElement: function() {
    this.percentDidChange();
    this.zIndexDidChange();
  },
});
