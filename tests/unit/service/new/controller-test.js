import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import NewServiceController from 'ui/service/new/controller';
import NewContainerController from 'ui/containers/new/controller';
import NewAliasController from 'ui/service/new-alias/controller';
import NewBalancerController from 'ui/service/new-balancer/controller';
import NewExternalController from 'ui/service/new-external/controller';
import NewVirtualMachineController from 'ui/service/new-virtualmachine/controller';
import NewStandaloneVirtualMachineController from 'ui/virtualmachines/new/controller';

module('Unit | Controller | service | new');

test('new-container route callbacks retain their controller receiver when detached', function(assert) {
  [
    NewServiceController,
    NewVirtualMachineController,
    NewContainerController,
    NewStandaloneVirtualMachineController,
  ].forEach((ControllerClass) => {
    let sent = [];
    let controller = ControllerClass.create();

    controller.send = function(name, ...args) {
      sent.push([name, ...args]);
    };

    let done = controller.get('newContainerDoneAction');
    let cancel = controller.get('newContainerCancelAction');

    done('saved-resource');
    cancel();

    assert.deepEqual(sent, [
      ['done', 'saved-resource'],
      ['cancel'],
    ], `${ControllerClass} callbacks preserve the route controller instead of depending on a legacy component target`);

    run(() => controller.destroy());
  });
});

test('detached completion reaches the real controller action with its receiver', async function(assert) {
  let transitions = [];
  let controller = NewServiceController.create({
    stackId: '1st-query',
    upgrade: null,
    router: {
      transitionTo(route, stackId) {
        transitions.push({route, stackId});
        return Promise.resolve();
      },
    },
  });

  await controller.get('newContainerDoneAction')('saved-resource');

  assert.deepEqual(transitions, [
    {route: 'stack', stackId: '1st-query'},
  ], 'the real controller action retains its receiver and uses the stable stack input');

  run(() => controller.destroy());
});

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
