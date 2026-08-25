import Route from '@ember/routing/route';

export default Route.extend({
  redirect: function() {
    this.get('router').transitionTo('admin-tab.audit-logs');
  }
});
