import { debounce, scheduleOnce } from '@ember/runloop';
import Component from '@ember/component';
import { observer } from '@ember/object';
import C from 'ui/utils/constants';
import ManageLabels from 'ui/mixins/manage-labels';

// Subtract 1 (because 11...), round up to the nearest 10, then double it
function roundScale(num) {
  return Math.ceil((num-1)/10)*10*2;
}

export default Component.extend(ManageLabels, {
  initialLabels : null,
  initialScale  : null,
  isGlobal      : null,
  editing       : false,
  isVm          : null,

  scale         : null,
  max           : 11,

  init() {
    this._super(...arguments);


    const initialScale = this.get('initialScale');
    this.set('scale', initialScale === 0 ? 0 : initialScale || 1);
    this.set('max', Math.max(11, roundScale(this.get('scale'))));

    this.initLabels(this.get('initialLabels'), null, C.LABEL.SCHED_GLOBAL);
    scheduleOnce('afterRender', () => {
      var on = this.getLabel(C.LABEL.SCHED_GLOBAL) === 'true';
      this.sendAction('setGlobal', this.set('isGlobal', on));
    });
  },

  updateLabels(labels) {
    this.sendAction('setLabels', labels);
  },

  isGlobalChanged: function() {
    var on = this.get('isGlobal');
    if ( on )
    {
      this.setLabel(C.LABEL.SCHED_GLOBAL,'true');
    }
    else
    {
      this.removeLabel(C.LABEL.SCHED_GLOBAL);
    }

    this.sendAction('setGlobal', on);
  }.observes('isGlobal'),

  scaleChanged: observer('scale', function() {
    if ( this.get('editing') ) {
      this.syncScale();
    } else {
      debounce(this, this.syncScale, 500);
    }
  }),

  syncScale() {
    if ( this.isDestroyed || this.isDestroying ) {
      return;
    }

    if ( this.get('scale') >= this.get('max') )
    {
      this.set('max', roundScale(this.get('scale')));
    }

    this.sendAction('setScale', this.get('scale'));
  },

  oneLouder: function() {
    return this.get('max')+1;
  }.property('max'),

});
