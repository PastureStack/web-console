import Route from '@ember/routing/route';

export default Route.extend({
  redirect: function() {
    this.get('router').replaceWith('host.containers');
  },

  model: function() {
    return this.modelFor('host').get('host');
  }
});
