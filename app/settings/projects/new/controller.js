import { filterBy } from '@ember/object/computed';
import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    done() {
      this.send('goToPrevious');
    },

    cancel() {
      this.send('goToPrevious');
    }
  },

  availableProjectTemplates: filterBy('model.projectTemplates','allThere',true),
});
