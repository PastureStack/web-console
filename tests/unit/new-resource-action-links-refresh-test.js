import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import CertificateNewController from 'ui/certificates/new/controller';
import NewSecret from 'ui/components/new-secret/component';
import inertRenderer from '../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../helpers/owned-subject';

module('Unit | new resource action links refresh');

function save(subject) {
  return subject.get('actions').save.call(subject);
}

test('Certificate create refreshes only its new ID and retries a failed refresh without another save', async function(assert) {
  let saves = 0;
  let refreshes = 0;
  let transitions = 0;
  const certificate = EmberObject.create({
    key: '-----BEGIN PRIVATE KEY-----\nexample\n',
    validationErrors() { return A([]); },
    save() {
      saves++;
      this.set('id', 'certificate-1');
      return resolve(this);
    },
  });
  const controller = CertificateNewController.create({
    model: certificate,
    intl: EmberObject.create({t(key) { return key; }}),
    store: EmberObject.create({
      find(type, id, options) {
        assert.strictEqual(type, 'certificate');
        assert.strictEqual(id, 'certificate-1');
        assert.true(options.forceReload);
        refreshes++;
        if ( refreshes === 1 ) {
          return reject({status: 503});
        }
        certificate.set('actionLinks', {update: `/certificates/${id}`});
        return resolve(certificate);
      },
    }),
    router: EmberObject.create({transitionTo() { transitions++; }}),
  });

  const first = await save(controller);
  assert.strictEqual(first.saved, false);
  assert.deepEqual(controller.get('errors'), ['certificatesPage.new.refreshFailed']);
  certificate.set('validationErrors', () => A(['the saved certificate must not be resubmitted']));
  await save(controller);
  assert.deepEqual({saves, refreshes, transitions}, {saves: 1, refreshes: 2, transitions: 1});
  assert.ok(certificate.get('actionLinks.update'), 'the new Certificate row receives Edit on direct GET');
  controller.destroy();
});

test('Secret create follows the same targeted refresh pattern without changing Edit', async function(assert) {
  let saves = 0;
  let refreshes = 0;
  let closes = 0;
  const store = EmberObject.create({
    find(type, id, options) {
      assert.strictEqual(type, 'secret');
      assert.strictEqual(id, 'secret-1');
      assert.true(options.forceReload);
      refreshes++;
      secret.set('actionLinks', {update: `/secrets/${id}`});
      return resolve(secret);
    },
  });
  const secret = EmberObject.create({
    store,
    validationErrors() { return A([]); },
    save() {
      saves++;
      this.set('id', 'secret-1');
      return resolve(this);
    },
  });
  const component = createOwned(NewSecret, {
    editing: false,
    model: secret,
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    sendAction(name) { if ( name === 'cancel' ) { closes++; } },
  }, 'component');

  await save(component);
  assert.deepEqual({saves, refreshes, closes}, {saves: 1, refreshes: 1, closes: 1});
  assert.ok(secret.get('actionLinks.update'), 'the new Secret row receives Edit on direct GET');
  destroyOwned(component);
});

test('Secret refresh failure is localized and retry does not POST or PUT again', async function(assert) {
  let saves = 0;
  let refreshes = 0;
  let closes = 0;
  const secret = EmberObject.create({
    id: null,
    validationErrors() { return this.get('id') ? A(['saved fields are no longer validated']) : A([]); },
    save() {
      saves++;
      this.set('id', 'secret-2');
      return resolve(this);
    },
  });
  secret.set('store', EmberObject.create({
    find(type, id, options) {
      assert.strictEqual(type, 'secret');
      assert.strictEqual(id, 'secret-2');
      assert.true(options.forceReload);
      refreshes++;
      return refreshes === 1 ? reject({status: 503}) : resolve(secret);
    },
  }));
  const component = createOwned(NewSecret, {
    editing: false,
    model: secret,
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return `localized:${key}`; }}),
    sendAction(name) { if ( name === 'cancel' ) { closes++; } },
  }, 'component');

  const first = await save(component);
  assert.strictEqual(first.saved, false);
  assert.deepEqual(component.get('errors'), ['localized:newSecret.refreshFailed']);
  await save(component);
  assert.deepEqual({saves, refreshes, closes}, {saves: 1, refreshes: 2, closes: 1});
  destroyOwned(component);
});
