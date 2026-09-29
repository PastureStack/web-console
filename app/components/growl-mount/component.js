import Component from '@ember/component';
import { service } from '@ember/service';

export default Component.extend({
  elementId: 'growl-mount',
  growl: service(),

  didInsertElement() {
    this._super(...arguments);
    this.get('growl').placeContainer(this.element);
  },

  willDestroyElement() {
    let container = document.getElementById('jGrowl');
    if (container && container.parentNode === this.element) {
      this.get('growl').placeContainer(document.body);
    }
    this._super(...arguments);
  },
});
