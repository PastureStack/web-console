import Controller from '@ember/controller';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Controller.extend(NewOrEdit, {

  doneSaving() {
    this.transitionToRoute('backuptargets');
  },

  actions: {
    cancel() {
      this.send('goToPrevious');
    },
  }
});
