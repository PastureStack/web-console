import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import ResourceActionsService from 'ui/services/resource-actions';

module('Unit | Service | resource actions');

function installFixture() {
  document.getElementById('qunit-fixture').innerHTML = `
    <button id="trigger-a" aria-expanded="false"></button>
    <div id="toggle-a"></div>
    <button id="trigger-b" aria-expanded="false"></button>
    <div id="toggle-b"></div>
    <div id="resource-actions-parent">
      <ul id="resource-actions" class="hide">
        <li><a id="resource-actions-first" href="#">First</a></li>
      </ul>
    </div>
  `;
}

function waitForNextQueues() {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

test('a cancelled open cannot resurrect a detached global menu', async function(assert) {
  installFixture();
  let service = ResourceActionsService.create();
  let model = EmberObject.create();
  let trigger = document.getElementById('trigger-a');
  let toggle = document.getElementById('toggle-a');

  run(() => {
    service.show(model, trigger, toggle);
    service.hide();
  });
  await waitForNextQueues();

  assert.false(service.get('open'), 'the cancelled request remains closed');
  assert.true(document.getElementById('resource-actions').classList.contains('hide'), 'the global menu remains hidden');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false', 'the cancelled trigger is collapsed');
  assert.notOk(toggle.classList.contains('open'), 'the cancelled toggle is not left open');

  run(() => service.destroy());
});

test('rapid trigger changes keep only the newest action model and anchor', async function(assert) {
  installFixture();
  let service = ResourceActionsService.create();
  let firstModel = EmberObject.create({name: 'first'});
  let secondModel = EmberObject.create({name: 'second'});
  let firstTrigger = document.getElementById('trigger-a');
  let secondTrigger = document.getElementById('trigger-b');
  let firstToggle = document.getElementById('toggle-a');
  let secondToggle = document.getElementById('toggle-b');

  run(() => {
    service.show(firstModel, firstTrigger, firstToggle);
    service.show(secondModel, secondTrigger, secondToggle);
  });
  await waitForNextQueues();

  assert.true(service.get('open'), 'the newest request opens');
  assert.strictEqual(service.get('model'), secondModel, 'the newest action model remains authoritative');
  assert.strictEqual(service.get('actionTrigger.0'), secondTrigger, 'the menu remains bound to the newest trigger');
  assert.equal(firstTrigger.getAttribute('aria-expanded'), 'false', 'the stale trigger stays collapsed');
  assert.equal(secondTrigger.getAttribute('aria-expanded'), 'true', 'the newest trigger is expanded');
  assert.notOk(firstToggle.classList.contains('open'), 'the stale toggle stays closed');
  assert.true(secondToggle.classList.contains('open'), 'the newest toggle owns the menu');
  assert.notOk(document.getElementById('resource-actions').classList.contains('hide'), 'the current menu is visible');

  run(() => service.hide());
  $(window).trigger('scroll');
  assert.false(service.get('open'), 'late viewport events cannot reopen a hidden menu');
  run(() => service.destroy());
});

test('viewport movement closes the menu instead of leaving a drifting anchor', async function(assert) {
  installFixture();
  let service = ResourceActionsService.create();
  let trigger = document.getElementById('trigger-a');

  run(() => service.show(EmberObject.create(), trigger, trigger));
  await waitForNextQueues();
  assert.true(service.get('open'), 'precondition: the menu opened');

  $(window).trigger('scroll');

  assert.false(service.get('open'), 'scroll closes the global menu');
  assert.true(document.getElementById('resource-actions').classList.contains('hide'), 'the menu cannot drift away from its trigger');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false', 'the trigger is collapsed after scroll');
  run(() => service.destroy());
});
