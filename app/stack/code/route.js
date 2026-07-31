import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function(/*params, transition*/) {
    var par = this.modelFor('stack');
    var stack = par.get('stack');
    return stack.doAction('exportconfig').then((config) => {
      // Windows needs CRLFs
      var dockerCompose = config.dockerComposeConfig.split(/\r?\n/).join('\r\n');
      var rancherCompose = config.rancherComposeConfig.split(/\r?\n/).join('\r\n');

      return EmberObject.create({
        stack: stack,
        all: par.get('all'),
        dockerCompose: dockerCompose,
        rancherCompose: rancherCompose,
      });
    });
  },
});
