import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import NewServiceController from 'ui/service/new/controller';
import NewAliasController from 'ui/service/new-alias/controller';
import NewBalancerController from 'ui/service/new-balancer/controller';
import NewExternalController from 'ui/service/new-external/controller';
import NewVirtualMachineController from 'ui/service/new-virtualmachine/controller';

module('Unit | Controller | service | new');

test('first-create navigation uses the persisted service and has a safe query fallback', function(assert) {
  let transitions = [];
  let controller = NewServiceController.create({
    stackId: '1st-query',
    model: null,
    router: {
      transitionTo(route, stackId) {
        transitions.push({route, stackId});
      },
    },
  });

  controller.actions.done.call(controller, EmberObject.create({stackId: '1st-saved'}));
  controller.actions.done.call(controller);

  assert.deepEqual(transitions, [
    {route: 'stack', stackId: '1st-saved'},
    {route: 'stack', stackId: '1st-query'},
  ], 'navigation never dereferences a missing route model after creation');

  run(() => controller.destroy());
});

test('all stack-scoped create routes avoid stale model dereferences', function(assert) {
  [NewAliasController, NewBalancerController, NewExternalController, NewVirtualMachineController].forEach((ControllerClass) => {
    let transition;
    let controller = ControllerClass.create({
      stackId: '1st-query',
      model: null,
      router: {
        transitionTo(route, stackId) {
          transition = {route, stackId};
        },
      },
    });

    controller.actions.done.call(controller);
    assert.deepEqual(transition, {route: 'stack', stackId: '1st-query'}, `${ControllerClass} uses the stable route input`);
    run(() => controller.destroy());
  });
});
