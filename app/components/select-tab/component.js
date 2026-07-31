import { scheduleOnce } from '@ember/runloop';
import Component from '@ember/component';
import SelectTab from 'ui/mixins/select-tab';

export default Component.extend(SelectTab, {
  tagName    : 'section',
  initialTab : '',
  init: function() {
    this._super(...arguments);
    scheduleOnce('afterRender', () => {
      this.send('selectTab', this.get('initialTab'));
    });
  }
});
