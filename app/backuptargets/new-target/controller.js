import Ember from 'ember';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Ember.Controller.extend(NewOrEdit, {

  doneSaving() {
    this.get('router').transitionTo('backuptargets');
  },

  actions: {
    cancel() {
      this.send('goToPrevious');
    },
  }
});
