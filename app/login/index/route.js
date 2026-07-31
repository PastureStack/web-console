import Route from '@ember/routing/route';

export default Route.extend({
  activate: function() {
    $('BODY').addClass('farm');
  },

  deactivate: function() {
    $('BODY').removeClass('farm');
  }
});
