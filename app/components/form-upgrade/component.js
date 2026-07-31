import Component from '@ember/component';

import { observer, computed } from '@ember/object';

export default Component.extend({
  choices    : null,
  index      : null,

  batchSize  : 1,
  interval   : 2,
  startFirst : false,

  init() {
    this._super(...arguments);

    this.optionsDidChange();
  },

  optionsDidChange: observer('batchSize', 'interval', 'startFirst', function() {
    this.sendAction('optionsChanged', {
      batchSize: parseInt(this.get('batchSize'),10),
      intervalMillis: parseInt(this.get('interval'),10)*1000,
      startFirst: this.get('startFirst'),
    });
  }),

  choicesDidChange: observer('choices.@each.enabled', function() {
    var index = this.get('index');
    var obj = this.get('choices').filterBy('index',index)[0];
    if ( !obj || !obj.enabled ) {
      var first = this.get('choices').filterBy('enabled',true)[0];
      if ( first )
      {
        this.sendAction('switch', first.index);
      }
      else
      {
        this.sendAction('switch', null);
      }
    }
  }),

  hasSidekicks: computed('choices.length', function() {
    return this.get('choices.length') > 1;
  }),
});
