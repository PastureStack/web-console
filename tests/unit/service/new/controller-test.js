import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import NewServiceController from 'ui/service/new/controller';
import NewAliasController from 'ui/service/new-alias/controller';
import NewBalancerController from 'ui/service/new-balancer/controller';
import NewExternalController from 'ui/service/new-external/controller';
import NewVirtualMachineController from 'ui/service/new-virtualmachine/controller';

module('Unit | Controller | service | new');

test('first-create navigation uses only the immutable stack route input', function(assert) {
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

  controller.actions.done.call(controller, {get() { throw new Error('saved response must not be read'); }});
  run(() => controller.set('stackId', null));
  controller.actions.done.call(controller, {get() { throw new Error('missing-route fallback must not read response'); }});

  assert.deepEqual(transitions, [
    {route: 'stack', stackId: '1st-query'},
    {route: 'stacks', stackId: undefined},
  ], 'navigation cannot be broken by a partial or unreadable saved resource');

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
