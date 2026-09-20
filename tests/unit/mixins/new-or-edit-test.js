import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import NewOrEdit from 'ui/mixins/new-or-edit';

module('Unit | Mixin | new or edit');

function subjectWith(overrides={}) {
  let Subject = EmberObject.extend(NewOrEdit, {
    displayedErrors: null,
    model: null,

    init() {
      this._super(...arguments);
      this.set('displayedErrors', A([]));
      this.set('model', EmberObject.create({
        validationErrors() {
          return A([]);
        },
        save() {
          return resolve('saved');
        },
      }));
    },

    send(action, error) {
      if ( action === 'error' ) {
        this.get('displayedErrors').pushObject(error);
        return;
      }
      return this._super(...arguments);
    },

    ...overrides,
  });

  return Subject.create({saving: false});
}

function save(subject, callback) {
  return subject.get('actions').save.call(subject, callback);
}

test('validation cancellation returns an awaitable outcome and completes once', function(assert) {
  let callbacks = [];
  let saves = 0;
  let subject = subjectWith({
    validate() {
      return false;
    },
    doSave() {
      saves++;
      return resolve();
    },
  });

  let operation = save(subject, (success) => callbacks.push(success));
  assert.ok(operation && typeof operation.then === 'function', 'the action returns the complete lifecycle Promise');

  return operation.then((outcome) => {
    assert.deepEqual(outcome, {saved: false, reason: 'cancelled'}, 'validation cancellation is explicit');
    assert.strictEqual(saves, 0, 'persistence does not start');
    assert.deepEqual(callbacks, [false], 'the completion callback runs once');
    assert.strictEqual(subject.get('saving'), false, 'saving is not left active');
    run(() => subject.destroy());
  });
});

test('a duplicate submission cannot clear the active owner lock', async function(assert) {
  let pending = defer();
  let firstCallbacks = [];
  let secondCallbacks = [];
  let saves = 0;
  let subject = subjectWith({
    doSave() {
      saves++;
      return pending.promise;
    },
  });

  let first = save(subject, (success) => firstCallbacks.push(success));
  let second = save(subject, (success) => secondCallbacks.push(success));
  let duplicate = await second;

  assert.deepEqual(duplicate, {saved: false, reason: 'busy'}, 'the duplicate reports the active lock');
  assert.deepEqual(secondCallbacks, [false], 'the duplicate callback completes once');
  await resolve();
  assert.strictEqual(subject.get('saving'), true, 'the duplicate finalizer does not clear the first lock');
  assert.strictEqual(saves, 1, 'only the owner persists');

  pending.resolve('saved-resource');
  let result = await first;
  assert.strictEqual(result, 'saved-resource', 'the owner receives the complete saved value');
  assert.deepEqual(firstCallbacks, [true], 'the owner callback completes once with success');
  assert.strictEqual(subject.get('saving'), false, 'the owner clears its own lock');
  assert.strictEqual(subject._saveOwner, null, 'private ownership is released');
  run(() => subject.destroy());
});

test('every save hook handles synchronous throws and asynchronous rejections consistently', async function(assert) {
  let hooks = ['willSave', 'doSave', 'didSave', 'doneSaving', 'errorSaving'];
  let modes = ['sync', 'async'];

  for (let hook of hooks) {
    for (let mode of modes) {
      let failure = new Error(`${hook}-${mode}`);
      let primaryFailure = new Error(`primary-${hook}-${mode}`);
      let callbacks = [];
      let errorHookCalls = 0;
      let fail = () => {
        if ( mode === 'sync' ) {
          throw failure;
        }
        return reject(failure);
      };
      let subject = subjectWith({
        willSave() {
          return hook === 'willSave' ? fail() : true;
        },
        doSave() {
          if ( hook === 'errorSaving' ) {
            return reject(primaryFailure);
          }
          return hook === 'doSave' ? fail() : 'saved';
        },
        didSave(result) {
          return hook === 'didSave' ? fail() : result;
        },
        doneSaving(result) {
          return hook === 'doneSaving' ? fail() : result;
        },
        errorSaving() {
          errorHookCalls++;
          return hook === 'errorSaving' ? fail() : undefined;
        },
      });

      let outcome;
      let rejected;

      await save(subject, (success) => callbacks.push(success)).then(
        (result) => {
          outcome = result;
        },
        (error) => {
          rejected = error;
        }
      );

      if ( hook === 'errorSaving' ) {
        assert.strictEqual(rejected, failure, `${hook}-${mode} keeps its finalizer failure observable`);
      } else {
        assert.strictEqual(outcome.saved, false, `${hook}-${mode} returns a handled business failure outcome`);
        assert.strictEqual(outcome.error, failure, `${hook}-${mode} retains the triggering failure`);
      }

      let displayed = hook === 'errorSaving' ? primaryFailure : failure;
      assert.strictEqual(subject.get('displayedErrors.0'), displayed, `${hook}-${mode} displays the triggering error`);
      assert.strictEqual(errorHookCalls, 1, `${hook}-${mode} runs error cleanup once`);
      assert.deepEqual(callbacks, [false], `${hook}-${mode} completes its callback once`);
      assert.strictEqual(subject.get('saving'), false, `${hook}-${mode} releases saving state`);
      assert.strictEqual(subject._saveOwner, null, `${hook}-${mode} releases ownership`);
      run(() => subject.destroy());
    }
  }
});

test('an error display exception remains observable after error cleanup', async function(assert) {
  let primaryFailure = new Error('save failed');
  let displayFailure = new Error('display failed');
  let cleanupCalls = 0;
  let subject = subjectWith({
    doSave() {
      throw primaryFailure;
    },
    errorSaving(error) {
      assert.strictEqual(error, primaryFailure, 'cleanup receives the original save failure');
      cleanupCalls++;
    },
    send() {
      throw displayFailure;
    },
  });

  await save(subject).then(() => {
    assert.ok(false, 'the display exception must reject the lifecycle');
  }, (error) => {
    assert.strictEqual(error, displayFailure, 'the display exception is not swallowed');
    assert.strictEqual(cleanupCalls, 1, 'error cleanup still runs once');
    assert.strictEqual(subject.get('saving'), false, 'saving state is released');
    assert.strictEqual(subject._saveOwner, null, 'ownership is released');
  });
  run(() => subject.destroy());
});

test('a completion callback exception remains observable after successful cleanup', function(assert) {
  let failure = new Error('completion callback failed');
  let calls = 0;
  let subject = subjectWith();

  return save(subject, () => {
    calls++;
    throw failure;
  }).then(() => {
    assert.ok(false, 'the callback exception must reject the lifecycle');
  }, (error) => {
    assert.strictEqual(error, failure, 'the original callback exception is retained');
    assert.strictEqual(calls, 1, 'the callback is invoked once');
    assert.strictEqual(subject.get('saving'), false, 'saving state was cleaned before the callback');
    assert.strictEqual(subject._saveOwner, null, 'ownership was cleaned before the callback');
    run(() => subject.destroy());
  });
});

test('a saving-state finalizer exception remains observable and the callback still completes once', function(assert) {
  let failure = new Error('saving finalizer failed');
  let callbacks = [];
  let subject = subjectWith({
    failSavingCleanup: false,
    set(key, value) {
      if ( this.failSavingCleanup && key === 'saving' && value === false ) {
        throw failure;
      }
      return this._super(...arguments);
    },
  });

  subject.failSavingCleanup = true;
  return save(subject, (success) => callbacks.push(success)).then(() => {
    assert.ok(false, 'the finalizer exception must reject the lifecycle');
  }, (error) => {
    assert.strictEqual(error, failure, 'the original finalizer exception is retained');
    assert.deepEqual(callbacks, [true], 'the completion callback still runs exactly once');
    assert.strictEqual(subject._saveOwner, null, 'ownership is released before finalization');
    run(() => subject.destroy());
  });
});
