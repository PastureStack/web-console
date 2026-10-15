import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import Service from 'ui/models/service';
import Stack from 'ui/models/stack';

export function archiveFixture() {
  let objects = [];
  let projects = EmberObject.create({current: EmberObject.create({id: '1a1'}), schemaProjectId: '1a1', schemaLoadGeneration: 1,
    canCreateResource() { return false; },
  });
  let field = {type: 'boolean', update: true};
  let store = EmberObject.create({
    generation: 1,
    baseUrl: '/v2-beta/projects/1a1',
    getById(type) {
      return type === 'schema' ? {resourceFields: {archived: this.get('archiveField')}} : null;
    },
    archiveField: field,
  });
  function record(Factory, values) {
    let model = Factory.create({
      projects, store, state: 'inactive', transitioning: 'no', system: false,
      instances: A([]), services: A([]), stack: null,
      actionLinks: {update: '/update', activate: '/activate', deactivate: '/stop', remove: '/remove', restart: '/restart', activateservices: '/activate-services'},
      ...values,
    });
    objects.push(model);
    return model;
  }
  return {
    projects, store, field,
    service(values = {}) { return record(Service, {id: '1s1', name: 'Service', ...values}); },
    stack(values = {}) { return record(Stack, {id: '1st1', name: 'Stack', ...values}); },
    destroy() {
      run(() => {
        objects.forEach(object => object.destroy());
        store.destroy();
        projects.get('current').destroy();
        projects.destroy();
      });
    },
  };
}
