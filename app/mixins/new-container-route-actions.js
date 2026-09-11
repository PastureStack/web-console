import { computed } from '@ember/object';
import Mixin from '@ember/object/mixin';

export default Mixin.create({
  newContainerDoneAction: computed(function() {
    return (...args) => this.send('done', ...args);
  }),

  newContainerCancelAction: computed(function() {
    return (...args) => this.send('cancel', ...args);
  }),
});
