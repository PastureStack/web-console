import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import RegistryNewController from 'ui/registries/new/controller';
import RegistryNewRoute from 'ui/registries/new/route';

module('Unit | Controller | registries/new');

function subject(credentialSave, readCredentials = () => A([]), refresh = () => resolve()) {
  let registrySaves = 0;
  let credentialSaves = 0;
  let reads = 0;
  let refreshes = [];
  let transitions = 0;
  const translations = [];
  const allRegistries = A([]);
  const registry = EmberObject.create({
    serverAddress: 'quay.io',
    validationErrors() { return A([]); },
    save() {
      registrySaves++;
      this.set('id', 'registry-1');
      allRegistries.pushObject(this);
      return resolve(this);
    },
  });
  const credential = EmberObject.create({
    publicValue: 'test-user',
    secretValue: 'test-password',
    validationErrors() { return A([]); },
    save() {
      credentialSaves++;
      return resolve(credentialSave(this, credentialSaves)).then((saved) => {
        this.set('id', 'credential-1');
        return saved;
      });
    },
  });
  const controller = RegistryNewController.create({
    model: EmberObject.create({registry, credential, allRegistries}),
    intl: EmberObject.create({t(key, options) { translations.push({key, options}); return key; }}),
    store: EmberObject.create({
      find(type, id, options) {
        if ( type === 'registrycredential' && !id ) {
          reads++;
          if ( !options.forceReload ) {
            throw new Error('retries must use a fresh credential collection response');
          }
          return resolve(readCredentials());
        }
        assertRefresh(type, id, options);
        return resolve(refresh(type, id)).then(() => {
          if ( type === 'registry' ) {
            registry.set('actionLinks', {update: `/registries/${id}`});
          }
          return type === 'registry' ? registry : credential;
        });
      },
    }),
    router: EmberObject.create({transitionTo() { transitions++; }}),
  });

  return {
    controller,
    registry,
    credential,
    allRegistries,
    counts: () => ({registrySaves, credentialSaves, reads, transitions}),
    refreshes,
    translations,
  };

  function assertRefresh(type, id, options) {
    if ( !options.forceReload ) {
      throw new Error('new resources must be reloaded by ID');
    }
    refreshes.push(`${type}:${id}`);
  }
}

function save(controller) {
  return controller.get('actions').save.call(controller);
}

test('a rejected credential POST retries only the credential after a fresh read', async function(assert) {
  const state = subject((credential, count) => count === 1 ? reject({status: 422, message: 'Invalid credential'}) : resolve(credential));
  const first = await save(state.controller);
  assert.strictEqual(first.saved, false, 'first submission reports failure');
  assert.true(state.controller.get('registryCreated'), 'the first Registry POST remains recorded');
  assert.strictEqual(state.credential.get('registryId'), 'registry-1');
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 1, reads: 0, transitions: 0});
  assert.true(state.controller.validate(), 'the newly created registry does not fail its own duplicate check');

  await save(state.controller);
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 2, reads: 1, transitions: 1}, 'retry never POSTs or PUTs Registry');
  assert.deepEqual(state.refreshes, ['registrycredential:credential-1', 'registry:registry-1'], 'only the two new IDs are refreshed before navigation');
  assert.ok(state.registry.get('actionLinks.update'), 'the new row receives the direct GET Edit action link');
  state.controller.destroy();
});

test('a failed reconciliation GET does not turn a definite 422 POST rejection into an ambiguous commit', async function(assert) {
  let checks = 0;
  const state = subject(
    (credential, count) => count === 1 ? reject({status: 422}) : resolve(credential),
    () => ++checks === 1 ? reject({status: 503}) : A([])
  );
  await save(state.controller);
  await save(state.controller);
  assert.false(state.controller.get('credentialOutcomeUnknown'), 'only the POST outcome defines write uncertainty');
  await save(state.controller);
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 2, reads: 2, transitions: 1});
  state.controller.destroy();
});

test('a failed action-link refresh retries only GET after both resources were saved', async function(assert) {
  let refreshAttempt = 0;
  const state = subject(
    (credential) => resolve(credential),
    () => A([]),
    () => ++refreshAttempt === 1 ? reject({status: 503}) : resolve()
  );
  await save(state.controller);
  assert.true(state.controller.get('credentialSaved'));
  state.credential.set('validationErrors', () => A(['do not validate a completed write']));
  await save(state.controller);
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 1, reads: 0, transitions: 1});
  assert.deepEqual(state.refreshes, [
    'registrycredential:credential-1', 'registrycredential:credential-1', 'registry:registry-1'
  ]);
  state.controller.destroy();
});

test('Cancel before submission writes nothing; a successful create saves both resources once', async function(assert) {
  const cancelled = subject((credential) => resolve(credential));
  cancelled.controller.get('actions').cancel.call(cancelled.controller);
  assert.deepEqual(cancelled.counts(), {registrySaves: 0, credentialSaves: 0, reads: 0, transitions: 1});
  cancelled.controller.destroy();

  const created = subject((credential) => resolve(credential));
  await save(created.controller);
  assert.deepEqual(created.counts(), {registrySaves: 1, credentialSaves: 1, reads: 0, transitions: 1});
  assert.deepEqual(created.refreshes, ['registrycredential:credential-1', 'registry:registry-1']);
  assert.ok(created.registry.get('actionLinks.update'), 'the newly created registry row has an Edit action link');
  created.controller.destroy();
});

test('an ambiguous credential POST is reconciled, never blindly repeated', async function(assert) {
  let currentCredentials = A([]);
  const state = subject(() => reject({status: 503, message: 'Gateway timeout'}), () => currentCredentials);
  await save(state.controller);
  const retry = await save(state.controller);
  assert.strictEqual(retry.saved, false);
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 1, reads: 1, transitions: 0}, 'an empty fresh read does not justify another POST');
  assert.true(state.controller.get('errors').join(' ').includes('registriesPage.new.credentialOutcomeUnknown'));

  currentCredentials = A([EmberObject.create({registryId: 'registry-1', publicValue: 'test-user'})]);
  state.credential.set('secretValue', 'different-password');
  const reconciled = await save(state.controller);
  assert.strictEqual(reconciled.saved, false, 'a matching username cannot verify a write-only password');
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 1, reads: 2, transitions: 0}, 'a present credential requires explicit edit, not another POST or a silent success');
  assert.true(state.controller.get('errors').join(' ').includes('registriesPage.new.credentialPresent'));
  state.controller.destroy();
});

test('a statusless credential failure is also treated as an unknown commit', async function(assert) {
  const state = subject(() => reject(new Error('network disconnected')));
  await save(state.controller);
  const retry = await save(state.controller);
  assert.strictEqual(retry.saved, false);
  assert.deepEqual(state.counts(), {registrySaves: 1, credentialSaves: 1, reads: 1, transitions: 0});
  assert.true(state.controller.get('errors').join(' ').includes('registriesPage.new.credentialOutcomeUnknown'));
  state.controller.destroy();
});

test('duplicate address is localized, while cancelling a partial create requires confirmation', async function(assert) {
  const state = subject(() => reject({status: 422, message: 'Invalid credential'}));
  state.allRegistries.pushObject(EmberObject.create({serverAddress: 'quay.io', displayAddress: 'Quay'}));
  assert.false(state.controller.validate());
  assert.deepEqual(state.controller.get('errors'), ['registriesPage.new.duplicateAddress']);
  state.allRegistries.clear();
  await save(state.controller);

  const previousConfirm = window.confirm;
  const prompts = [];
  try {
    window.confirm = (message) => { prompts.push(message); return false; };
    state.controller.get('actions').cancel.call(state.controller);
    assert.strictEqual(state.counts().transitions, 0, 'declining keeps the recovery form');
    assert.deepEqual(prompts, ['registriesPage.new.cancelConfirm']);
    assert.deepEqual(state.translations.find((entry) => entry.key === 'registriesPage.new.cancelConfirm').options,
      {address: 'quay.io', id: 'registry-1'}, 'the recovery prompt identifies the created registry exactly');
    window.confirm = () => true;
    state.controller.get('actions').cancel.call(state.controller);
    assert.strictEqual(state.counts().transitions, 1, 'leaving is an explicit choice');
  } finally {
    window.confirm = previousConfirm;
    state.controller.destroy();
  }
});

test('re-entering the Add route clears the previous partial-save state', function(assert) {
  const state = subject(() => resolve());
  const route = RegistryNewRoute.create();
  state.controller.setProperties({
    registryCreated: true,
    registrySaveAttempted: true,
    registryOutcomeUnknown: true,
    credentialSaveAttempted: true,
    credentialOutcomeUnknown: true,
    credentialSaved: true,
    savedCredentialId: 'old-credential',
  });

  route.resetController(state.controller, true);
  route.setupController(state.controller, state.controller.get('model'));
  assert.false(state.controller.get('registrySaveAttempted'));
  assert.false(state.controller.get('registryCreated'));
  assert.false(state.controller.get('credentialSaveAttempted'));
  assert.false(state.controller.get('credentialSaved'));
  assert.strictEqual(state.controller.get('savedCredentialId'), null);
  assert.strictEqual(state.controller.get('activeDriver'), 'dockerhub');
  route.destroy();
  state.controller.destroy();
});
