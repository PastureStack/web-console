import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';

export default Route.extend({
  model() {
    return this.get('store').findAll('container').then((containers) => {
      let inst = containers.filter((c) => {
        return (c.get('labels')||{})[C.LABEL.SERVICE_NAME] === 'swarm/swarmkit-mon';
      }).sortBy('createIndex').objectAt(0);

      if ( inst )
      {
        return EmberObject.create({
          command: ['/bin/bash','-l','-c','echo "# Run docker commands inside here\n# e.g. docker service ls\n"; TERM=xterm-256color /bin/bash'],
          instance: inst,
        });
      }
    });
  },
});
