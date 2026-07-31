import Route from '@ember/routing/route';

export default Route.extend({
  model() {
    let container = this.modelFor('container');
    return container.followLink('ports').then((ports) => {
      return {
        container: container,
        ports: ports,
      };
    });
  }
});
