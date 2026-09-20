import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { Promise, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import PromiseToCb from 'ui/mixins/promise-to-cb';

module('Unit | Mixin | promise to cb');

test('a resolved promise calls its callback exactly once', function(assert) {
  let calls = 0;
  let subject = EmberObject.extend(PromiseToCb).create();

  return subject.toCb(() => resolve('loaded'))((err, result) => {
    calls++;
    assert.strictEqual(err, null, 'there is no error');
    assert.strictEqual(result, 'loaded', 'the resolved value is retained');
  }).then(() => {
    assert.strictEqual(calls, 1, 'the callback is invoked once');
    run(() => subject.destroy());
  });
});

test('a rejected promise calls its callback exactly once', function(assert) {
  let calls = 0;
  let failure = new Error('request failed');
  let subject = EmberObject.extend(PromiseToCb).create();

  return subject.toCb(() => reject(failure))((err, result) => {
    calls++;
    assert.strictEqual(err, failure, 'the original rejection is retained');
    assert.strictEqual(result, null, 'there is no result');
  }).then(() => {
    assert.strictEqual(calls, 1, 'the callback is invoked once');
    run(() => subject.destroy());
  });
});

test('an exception thrown by the callback is not converted into a second callback', function(assert) {
  let calls = 0;
  let failure = new Error('downstream callback failed');
  let subject = EmberObject.extend(PromiseToCb).create();

  return subject.toCb(() => resolve('loaded'))(() => {
    calls++;
    throw failure;
  }).then(() => {
    assert.ok(false, 'the downstream exception must remain observable');
  }, (err) => {
    assert.strictEqual(err, failure, 'the original downstream exception is retained');
    assert.strictEqual(calls, 1, 'the callback is not invoked a second time');
    run(() => subject.destroy());
  });
});

test('a synchronous task exception is reported through the callback once', function(assert) {
  let calls = 0;
  let factoryRan = false;
  let failure = new Error('task setup failed');
  let subject = EmberObject.extend(PromiseToCb).create();

  let operation = subject.toCb(() => {
    factoryRan = true;
    throw failure;
  })((err, result) => {
    calls++;
    assert.strictEqual(err, failure, 'the original synchronous exception is retained');
    assert.strictEqual(result, null, 'there is no result');
  });

  assert.strictEqual(factoryRan, false, 'the task factory is deferred into an RSVP turn');
  assert.strictEqual(calls, 0, 'the callback is not invoked inline');
  return operation.then(() => {
    assert.strictEqual(factoryRan, true, 'the deferred task factory ran');
    assert.strictEqual(calls, 1, 'the callback is invoked once');
    run(() => subject.destroy());
  });
});

test('plain values and thenables are adopted with exactly-once settlement', function(assert) {
  let subject = EmberObject.extend(PromiseToCb).create();
  let plainCalls = 0;
  let thenableCalls = 0;
  let plain = subject.toCb(() => 42)((err, result) => {
    plainCalls++;
    assert.strictEqual(err, null, 'plain value has no error');
    assert.strictEqual(result, 42, 'plain value is retained');
  });
  let thenable = subject.toCb(() => ({
    then(fulfill, rejectValue) {
      fulfill('adopted');
      fulfill('ignored');
      rejectValue(new Error('ignored'));
    },
  }))((err, result) => {
    thenableCalls++;
    assert.strictEqual(err, null, 'the first thenable settlement wins');
    assert.strictEqual(result, 'adopted', 'the thenable value is retained');
  });

  return Promise.all([plain, thenable]).then(() => {
    assert.strictEqual(plainCalls, 1, 'plain value callback runs once');
    assert.strictEqual(thenableCalls, 1, 'misbehaving thenable callback still runs once');
    run(() => subject.destroy());
  });
});

test('async auto can complete concurrent promise tasks without duplicate callbacks', function(assert) {
  let subject = EmberObject.extend(PromiseToCb).create();
  let calls = {first: 0, second: 0, dependent: 0};
  let first = subject.toCb(() => resolve('first'));
  let second = subject.toCb(() => resolve('second'));

  return new Promise((resolveTest, rejectTest) => {
    async.auto({
      first(cb) {
        return first((...callbackArgs) => {
          calls.first++;
          cb(...callbackArgs);
        });
      },
      second(cb) {
        return second((...callbackArgs) => {
          calls.second++;
          cb(...callbackArgs);
        });
      },
      dependent: ['first', 'second', subject.toCb((results) => {
        calls.dependent++;
        assert.deepEqual(results, {first: 'first', second: 'second'}, 'dependent work receives both results');
        return resolve('done');
      })],
    }, 2, (err, results) => {
      if ( err ) {
        rejectTest(err);
        return;
      }

      assert.deepEqual(results, {first: 'first', second: 'second', dependent: 'done'}, 'all work completes once');
      resolveTest();
    });
  }).then(() => {
    assert.deepEqual(calls, {first: 1, second: 1, dependent: 1}, 'no task is completed twice');
    run(() => subject.destroy());
  });
});

test('async auto reports a dependent synchronous throw through its final callback once', function(assert) {
  let subject = EmberObject.extend(PromiseToCb).create();
  let failure = new Error('dependent setup failed');
  let finalCalls = 0;

  return new Promise((resolveTest, rejectTest) => {
    async.auto({
      parent: subject.toCb(() => 'ready'),
      dependent: ['parent', subject.toCb(() => {
        throw failure;
      })],
    }, (err) => {
      finalCalls++;
      try {
        assert.strictEqual(err, failure, 'the original synchronous exception reaches async.auto');
        resolveTest();
      } catch (assertionError) {
        rejectTest(assertionError);
      }
    });
  }).then(() => {
    assert.strictEqual(finalCalls, 1, 'the final callback runs once');
    run(() => subject.destroy());
  });
});

test('async auto reports one rejection while other work settles without a callback storm', function(assert) {
  let subject = EmberObject.extend(PromiseToCb).create();
  let failure = new Error('request rejected');
  let finalCalls = 0;

  return new Promise((resolveTest, rejectTest) => {
    async.auto({
      failed: subject.toCb(() => reject(failure)),
      concurrent: subject.toCb(() => resolve('finished')),
    }, (err) => {
      finalCalls++;
      try {
        assert.strictEqual(err, failure, 'the original rejection reaches async.auto');
        resolveTest();
      } catch (assertionError) {
        rejectTest(assertionError);
      }
    });
  }).then(() => resolve()).then(() => {
    assert.strictEqual(finalCalls, 1, 'the final callback remains single after concurrent settlement');
    run(() => subject.destroy());
  });
});
