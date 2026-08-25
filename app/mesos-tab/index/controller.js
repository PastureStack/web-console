import Controller from '@ember/controller';

export default Controller.extend({
  activeHostCount: function() {
    return this.get('model.hosts').filterBy('state','active').get('length');
  }.property('model.hosts'),
});
