import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    return this.get('store').createRecord({
      type: 'backupTarget',
      name: '',
      description: null,
      nfsConfig: {
        server: null,
        share: null,
        mountOptions: null,
      },
    });
  }
});
