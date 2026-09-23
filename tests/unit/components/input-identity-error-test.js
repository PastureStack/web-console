import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import InputIdentity from 'ui/components/input-identity/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | input identity errors');

function subject(responseFactory) {
  let errors = [];
  let component = createOwned(InputIdentity, {
    access: EmberObject.create({provider: 'oidcconfig'}),
    addInput: 'candidate',
    intl: EmberObject.create({t(key) { return key; }}),
    renderer: inertRenderer(),
    userStore: EmberObject.create({
      all() { return A([]); },
      findAll() { return resolve(A([])); },
      find() { return responseFactory(); },
    }),
    sendAction(name, message) {
      if ( name === 'onError' ) { errors.push(message); }
    },
  }, 'component');
  return {component, errors};
}

test('identity search distinguishes no match, denied, expired, and unavailable', async function(assert) {
  for (let [response, expected] of [
    [() => resolve(A([])), 'notFound'],
    [() => reject({status: 404}), 'unavailable'],
    [() => reject({status: 403}), 'forbidden'],
    [() => reject({status: 401}), 'sessionExpired'],
    [() => reject({status: 500}), 'unavailable'],
    [() => reject(new Error('Network down')), 'unavailable'],
  ]) {
    let {component, errors} = subject(response);
    await component.get('actions').add.call(component);
    assert.deepEqual(errors, [`inputIdentity.error.${expected}`], `${expected} uses the existing onError display action`);
    assert.strictEqual(component.get('checking'), false, 'the search lock is released');
    destroyOwned(component);
  }
});

test('an error thrown by the display callback is not reported as a second search failure', async function(assert) {
  let {component} = subject(() => resolve(A([])));
  let failure = new Error('display callback failed');
  let errors = 0;
  component.sendAction = function(name) {
    if ( name === 'onError' ) {
      errors++;
      throw failure;
    }
  };
  await component.get('actions').add.call(component).then(
    () => assert.ok(false, 'the callback error must remain observable'),
    (err) => assert.strictEqual(err, failure, 'the original callback error is preserved')
  );
  assert.strictEqual(errors, 1, 'the callback is not invoked twice');
  assert.strictEqual(component.get('checking'), false, 'the lock is released after callback failure');
  destroyOwned(component);
});
