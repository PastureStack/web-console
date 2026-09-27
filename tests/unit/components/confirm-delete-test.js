import EmberObject from '@ember/object';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import ConfirmDelete from 'ui/components/confirm-delete/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | confirm delete');

function makeComponent(resources, closed) {
  return createOwned(ConfirmDelete, {
    renderer: inertRenderer(),
    resources,
    modalService: EmberObject.create({
      modalOpts: {escToClose: true},
      modalVisible: true,
      toggleModal() { closed.push(true); },
    }),
    settings: EmberObject.create(),
    intl: EmberObject.create({t(key) { return key; }}),
  }, 'component');
}

function confirm(component) {
  return component.get('actions').confirm.call(component);
}

test('Cancel before confirmation closes without deleting anything', function(assert) {
  let calls = 0;
  let closed = [];
  let component = makeComponent([{
    delete() { calls++; return resolve(); },
  }], closed);

  component.get('actions').cancel.call(component);
  assert.strictEqual(calls, 0, 'Cancel does not submit DELETE');
  assert.deepEqual(closed, [true], 'Cancel closes the modal once');
  destroyOwned(component);
});

test('confirmation waits for deletion before closing and rejects duplicate clicks', async function(assert) {
  let operation = defer();
  let calls = 0;
  let closed = [];
  let component = makeComponent([{
    delete() {
      calls++;
      return operation.promise;
    },
  }], closed);

  let first = confirm(component);
  assert.true(component.get('deleting'), 'the lock is reserved synchronously');
  assert.false(component.escToClose(), 'Escape cannot close a pending deletion');
  component.get('actions').cancel.call(component);
  assert.deepEqual(closed, [], 'Cancel cannot close a pending deletion');
  assert.deepEqual(await confirm(component), {deleted: false, reason: 'busy'});
  await resolve();
  assert.strictEqual(calls, 1, 'the same resource is deleted once');
  assert.deepEqual(closed, [], 'the modal remains open until the request finishes');

  operation.resolve();
  await first;
  assert.deepEqual(closed, [true], 'success closes the modal once');
  assert.false(component.get('deleting'), 'the lock is released');
  destroyOwned(component);
});

test('a rejected deletion is handled at the button boundary and leaves the modal open for retry', async function(assert) {
  let failure = new Error('DELETE denied');
  let attempts = 0;
  let closed = [];
  let component = makeComponent([{
    delete() {
      attempts++;
      return attempts === 1 ? reject(failure) : resolve();
    },
  }], closed);

  let outcome = await confirm(component);
  assert.deepEqual(outcome, {deleted: false, error: failure}, 'the button consumes the rejection and retains the original error');
  assert.deepEqual(closed, [], 'failure leaves the confirmation open');
  assert.false(component.get('deleting'), 'failure releases the lock');

  await confirm(component);
  assert.strictEqual(attempts, 2, 'the pending deletion can be retried');
  assert.deepEqual(closed, [true], 'the successful retry closes the modal');
  destroyOwned(component);
});

test('multiple deletes run in order and retry skips resources already accepted', async function(assert) {
  let first = defer();
  let second = defer();
  let attempts = [0, 0, 0];
  let closed = [];
  let resources = [
    {delete() { attempts[0]++; return first.promise; }},
    {delete() { attempts[1]++; return attempts[1] === 1 ? second.promise : resolve(); }},
    {delete() { attempts[2]++; return resolve(); }},
  ];
  let component = makeComponent(resources, closed);
  let operation = confirm(component);

  await resolve();
  assert.deepEqual(attempts, [1, 0, 0], 'the second request waits for the first');
  first.resolve();
  await resolve();
  await resolve();
  assert.deepEqual(attempts, [1, 1, 0], 'the third request waits for the second');

  let failure = new Error('second DELETE failed');
  second.reject(failure);
  assert.deepEqual(await operation, {deleted: false, error: failure}, 'partial failure remains observable without an unhandled rejection');
  assert.deepEqual(attempts, [1, 1, 0], 'the remaining request was not started');
  assert.deepEqual(closed, [], 'partial completion does not close the modal');

  await confirm(component);
  assert.deepEqual(attempts, [1, 2, 1], 'retry skips the accepted delete and finishes the batch');
  assert.deepEqual(closed, [true]);
  destroyOwned(component);
});
