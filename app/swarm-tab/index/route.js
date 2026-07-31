import Route from '@ember/routing/route';

export default Route.extend({
  redirect: function() {
    this.replaceWith('swarm-tab.console');
  }
});
