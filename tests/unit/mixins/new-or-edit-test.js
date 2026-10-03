import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import NewOrEdit from 'ui/mixins/new-or-edit';
import { takeCreateOnlyDelivery } from 'ember-api-store/utils/create-only-delivery';

module('Unit | Mixin | new or edit');

test('validation forwards explicit options and leaves the default strict', function(assert) {
  const received = [];
  const options = {updateOmittedFields: ['key']};
  const Subject = EmberObject.extend(NewOrEdit);
  const subject = Subject.create({model: EmberObject.create({validationErrors(value) { received.push(value); return A([]); }})});

  assert.true(subject.validate());
  assert.true(subject.validate(options));
  assert.deepEqual(received, [undefined, options]);
  run(() => subject.destroy());
});

test('the save error action uses optional localized formatting', function(assert) {
  let intl = {t(key) {
    return {
      'resourceSaveError.unavailable': '無法完成儲存。',
      'resourceSaveError.validation': '伺服器未接受變更。',
      'resourceSaveError.failed': '儲存失敗。',
      'viewEditProject.error.projectNotSaved': '環境設定未儲存。',
    }[key];
  }};
  let Subject = EmberObject.extend(NewOrEdit, {intl});
  let subject = Subject.create();

  subject.get('actions').error.call(subject, {status: 403});
  assert.deepEqual(subject.get('errors'), ['無法完成儲存。']);
  subject.get('actions').error.call(subject, {status: 404, message: 'Private ID exists'});
  assert.deepEqual(subject.get('errors'), ['無法完成儲存。']);
  subject.get('actions').error.call(subject, {
    status: 403,
    messageKey: 'viewEditProject.error.projectNotSaved',
    message: '環境設定未儲存。',
  });
  assert.deepEqual(subject.get('errors'), ['環境設定未儲存。'], 'Project keeps its stage-specific message');
  subject.get('actions').error.call(subject, {status: 422, fieldName: 'name', detail: 'already used'});
  assert.deepEqual(subject.get('errors'), ['伺服器未接受變更。 name: already used']);
  run(() => subject.destroy());
});

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

test('opt-in delivery belongs to one save owner and is cleared on success, rejection and synchronous callback failures', async function(assert) {
  for ( const mode of ['success', 'request-reject', 'doneSaving-throw', 'completion-throw'] ) {
    const pending = defer();
    const failure = new Error(mode);
    let options, callbackCalls = 0;
    const subject = subjectWith({
      createOnlyDelivery: true,
      doneSaving(value) {
        assert.strictEqual(value, 'saved', 'existing hook argument is unchanged');
        if ( mode === 'doneSaving-throw' ) { throw failure; }
        return value;
      },
    });
    subject.get('model').save = value => { options = value; return pending.promise; };
    const operation = save(subject, () => {
      callbackCalls++;
      if ( mode === 'completion-throw' ) { throw failure; }
    });
    for ( let turn = 0; !options && turn < 20; turn++ ) { await resolve(); }
    assert.ok(options, 'base doSave binds private delivery options');
    const data = {fields: {secretValue: 'SECRET-TEST'}};
    takeCreateOnlyDelivery(options)(data);
    assert.notOk(Object.keys(subject).includes('_createOnlyDelivery'), 'delivery metadata is nonenumerable');
    assert.notOk(Object.keys(subject).includes('_createOnlyRequest'), 'request metadata is nonenumerable');
    const owner = subject._saveOwner;
    assert.deepEqual(await save(subject), {saved: false, reason: 'busy'});
    assert.strictEqual(subject._saveOwner, owner, 'duplicate cannot clear the owner');
    assert.strictEqual(subject._createOnlyDelivery.data, data, 'duplicate cannot consume the owner delivery');
    if ( mode === 'request-reject' ) { pending.reject(failure); } else { pending.resolve('saved'); }
    try {
      const result = await operation;
      if ( mode === 'completion-throw' ) { assert.ok(false, 'callback failure must reject'); }
      else if ( mode === 'success' ) { assert.strictEqual(result, 'saved', 'existing result is unchanged'); }
      else { assert.strictEqual(result.error, failure); }
    } catch (error) {
      assert.strictEqual(error, failure);
      assert.strictEqual(mode, 'completion-throw');
    }
    assert.strictEqual(callbackCalls, 1);
    assert.strictEqual(data.fields, null, `${mode} clears unconsumed one-time values`);
    assert.strictEqual(takeCreateOnlyDelivery(options), null);
    assert.strictEqual(subject._createOnlyRequest, null);
    assert.strictEqual(subject._createOnlyDelivery, null);
    assert.strictEqual(subject._saveOwner, null);
    assert.strictEqual(subject.get('saving'), false);
    run(() => subject.destroy());
  }
});

test('synchronous persistence failure clears private callback, while ordinary consumers keep their options and result', async function(assert) {
  let options;
  const subject = subjectWith({createOnlyDelivery: true});
  const failure = new Error('synchronous save failed');
  subject.get('model').save = value => { options = value; throw failure; };
  const outcome = await save(subject);
  assert.strictEqual(outcome.error, failure);
  assert.strictEqual(takeCreateOnlyDelivery(options), null);
  assert.strictEqual(subject._createOnlyRequest, null);
  assert.strictEqual(subject._saveOwner, null);
  assert.strictEqual(subject.get('saving'), false);
  run(() => subject.destroy());

  const ordinary = subjectWith();
  ordinary.get('model').save = value => {
    assert.strictEqual(value, undefined, 'non-opted-in consumers keep their previous arguments');
    return resolve('ordinary-saved');
  };
  assert.strictEqual(await save(ordinary), 'ordinary-saved');
  assert.strictEqual(ordinary._createOnlyRequest, undefined);
  assert.strictEqual(ordinary._createOnlyDelivery, undefined);
  run(() => ordinary.destroy());
});

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

test('a submission that only observes an existing saving lock cannot take ownership or clear it', async function(assert) {
  let callbacks = [];
  let saves = 0;
  let subject = subjectWith({
    doSave() {
      saves++;
      return resolve('unexpected-save');
    },
  });

  subject.set('saving', true);
  let outcome = await save(subject, (success) => callbacks.push(success));

  assert.deepEqual(outcome, {saved: false, reason: 'busy'}, 'the pre-existing lock is reported as busy');
  assert.strictEqual(saves, 0, 'a second persistence operation is not started');
  assert.deepEqual(callbacks, [false], 'the rejected duplicate callback completes once');
  assert.strictEqual(subject.get('saving'), true, 'the observed lock remains owned by the first operation');
  assert.strictEqual(subject._saveOwner, undefined, 'the duplicate never claims private ownership');
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
