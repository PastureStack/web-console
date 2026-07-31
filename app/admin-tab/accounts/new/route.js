import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    var account = this.get('userStore').createRecord({type: 'account', kind: 'user'});
    var credential = this.get('userStore').createRecord({type: 'password'});

    return EmberObject.create({
      account: account,
      credential: credential
    });
  },

  resetController: function (controller, isExisting/*, transition*/) {
    if (isExisting)
    {
      controller.set('errors', null);
    }
  }
});
