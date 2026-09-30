import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import Certificate from 'ui/models/certificate';
import EditCertificate from 'ui/components/edit-certificate/component';
import CattleTransitioningResource from 'ui/mixins/cattle-transitioning-resource';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

const CERT = '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----\n';
const CHAIN = '-----BEGIN CERTIFICATE-----\nCHAIN\n-----END CERTIFICATE-----\n';
const KEY = '-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----\n';

function fixture({original = {}, edits = {}, failure} = {}) {
  const sent = [], events = [], records = [];
  const labels = {'formNameDescription.name.label': 'Name', 'inputCertificate.cert.label': 'Certificate', 'inputCertificate.key.label': 'Private Key'};
  const intl = EmberObject.create({
    exists(key) { return Object.hasOwn(labels, key); },
    t(key, parameters) { return key === 'validation.required' ? `Required ${parameters.key}` : labels[key] || key; },
  });
  const resourceFields = {
    name: {type: 'string', required: true, nullable: true},
    description: {type: 'string', nullable: true},
    cert: {type: 'string', required: true},
    key: {type: 'string', required: true},
    certChain: {type: 'string', nullable: true},
  };
  let source;
  const Model = Certificate.extend(CattleTransitioningResource, {
    save(options) {
      sent.push(options);
      if (failure === 'sync') {
        throw new Error('synthetic save failure');
      }
      if (failure === 'async') {
        return Promise.reject(new Error('synthetic save failure'));
      }
      return Promise.resolve(store.createRecord({...source.serialize(), ...options.data}));
    },
  });
  const store = EmberObject.create({
    getById(type, id) { return type === 'schema' && id === 'certificate' ? {resourceFields} : null; },
    hasRecord() { return false; },
    createRecord(values) {
      const record = Model.create({...values, store: this, intl});
      records.push(record);
      return record;
    },
  });
  source = store.createRecord({id: '1c52', type: 'certificate', accountId: '1a2515', name: 'Original', description: 'Original description', cert: CERT, key: null, certChain: CHAIN, ...original});
  const component = createOwned(EditCertificate, {
    renderer: inertRenderer(), intl,
    modalService: EmberObject.create({modalOpts: source}),
    send(action) { events.push(action); },
  }, 'component');
  component.get('model').setProperties({name: 'Edited', description: 'Edited description', ...edits});
  return {component, source, resourceFields, sent, events, destroy() {
    destroyOwned(component);
    run(() => records.forEach(record => record.destroy()));
  }};
}

module('Unit | Component | edit-certificate metadata validation');

test('real cloned certificate validation preserves masked-key metadata edits before and after trimming', async function(assert) {
  for (const key of [null, undefined, '', ' \n ']) {
    const f = fixture({edits: {key}});
    const model = f.component.get('model');
    assert.notStrictEqual(model, f.source, 'the editor uses the real resource clone');
    assert.strictEqual(model.get('id'), f.source.get('id'));
    assert.true(f.component.isMetadataOnlyUpdate(), 'before validation');
    assert.true(f.component.validate(), 'required-key exception is opt-in and does not need writeOnly');
    assert.true(f.component.isMetadataOnlyUpdate(), 'after validation trimmed the clone');
    assert.strictEqual(model.get('cert'), CERT.trim());
    assert.strictEqual(model.get('certChain'), CHAIN.trim());
    assert.strictEqual(f.source.get('cert'), CERT, 'original PEM bytes remain intact');
    assert.strictEqual(f.source.get('certChain'), CHAIN);
    assert.true(f.resourceFields.key.required, 'shared schema is not changed');
    await f.component.doSave();
    assert.deepEqual(f.sent[0].data, {name: 'Edited', description: 'Edited description'}, 'no masked or trimmed material is sent');
    assert.strictEqual(f.source.get('cert'), CERT, 'simulated metadata response preserves material');
    assert.strictEqual(f.source.get('certChain'), CHAIN);
    f.destroy();
  }
});

test('a missing optional chain stays metadata-only across empty-string normalization', function(assert) {
  const f = fixture({original: {certChain: null}, edits: {certChain: ''}});
  assert.true(f.component.isMetadataOnlyUpdate());
  assert.true(f.component.validate());
  assert.true(f.component.isMetadataOnlyUpdate());
  f.destroy();
});

test('new and material-changing certificates still require certificate and key', function(assert) {
  for (const options of [
    {original: {id: null}},
    {edits: {cert: ''}},
    {edits: {cert: 'REPLACEMENT'}},
    {edits: {certChain: ''}},
    {edits: {certChain: 'REPLACEMENT CHAIN'}},
    {original: {key: KEY}, edits: {key: ''}},
  ]) {
    const f = fixture(options);
    assert.false(f.component.isMetadataOnlyUpdate());
    assert.false(f.component.validate(), 'the ordinary schema validator is still used');
    assert.ok(f.component.get('errors').includes('Required Private Key'));
    assert.strictEqual(f.sent.length, 0);
    f.destroy();
  }
  const f = fixture({original: {id: null, cert: ''}});
  assert.false(f.component.validate());
  assert.deepEqual(f.component.get('errors'), ['Required Certificate', 'Required Private Key']);
  f.destroy();
});

test('metadata exception cannot hide name errors or cross an identity/type boundary', function(assert) {
  const f = fixture({edits: {name: ''}});
  assert.false(f.component.validate());
  assert.deepEqual(f.component.get('errors'), ['Required Name']);
  f.destroy();
  for (const edits of [{id: '1c53'}, {type: 'secret'}]) {
    const changed = fixture({edits});
    assert.false(changed.component.isMetadataOnlyUpdate());
    changed.destroy();
  }
});

test('explicit replacements keep the full editable body and encrypted keys remain rejected', async function(assert) {
  const f = fixture({edits: {cert: 'REPLACEMENT CERT', key: KEY, certChain: ''}});
  assert.false(f.component.isMetadataOnlyUpdate());
  assert.true(f.component.validate());
  await f.component.doSave();
  assert.deepEqual(f.sent[0].data, {name: 'Edited', description: 'Edited description', cert: 'REPLACEMENT CERT', key: KEY.trim(), certChain: null});
  f.destroy();
  const encrypted = fixture({edits: {key: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nSYNTHETIC\n'}});
  assert.false(encrypted.component.validate());
  assert.deepEqual(encrypted.component.get('errors'), ['certificatesPage.encryptedKeyError']);
  assert.strictEqual(encrypted.sent.length, 0);
  encrypted.destroy();
});

test('material changes between validation and doSave are not silently omitted', async function(assert) {
  const f = fixture();
  assert.true(f.component.validate());
  f.component.get('model').setProperties({cert: 'REPLACEMENT CERT', key: KEY});
  assert.false(f.component.isMetadataOnlyUpdate());
  await f.component.doSave();
  assert.deepEqual(f.sent[0].data, {name: 'Edited', description: 'Edited description', cert: 'REPLACEMENT CERT', key: KEY, certChain: CHAIN.trim()});
  f.destroy();
});

test('willSave and the real save lifecycle dispatch metadata exactly once and settle the callback', async function(assert) {
  const f = fixture();
  const callbacks = [];
  const operation = f.component.get('actions').save.call(f.component, success => callbacks.push(success));
  await operation;
  assert.strictEqual(f.sent.length, 1);
  assert.deepEqual(f.sent[0].data, {name: 'Edited', description: 'Edited description'});
  assert.deepEqual(callbacks, [true]);
  assert.deepEqual(f.events, ['cancel']);
  assert.false(f.component.get('saving'));
  assert.strictEqual(f.component._saveOwner, null);
  f.destroy();
});

test('synchronous and asynchronous save failures settle the same metadata lifecycle', async function(assert) {
  for (const failure of ['sync', 'async']) {
    const f = fixture({failure});
    const callbacks = [];
    const result = await f.component.get('actions').save.call(f.component, success => callbacks.push(success));
    assert.false(result.saved);
    assert.strictEqual(f.sent.length, 1);
    assert.deepEqual(callbacks, [false]);
    assert.deepEqual(f.events, ['error']);
    assert.false(f.component.get('saving'));
    assert.strictEqual(f.component._saveOwner, null);
    f.destroy();
  }
});
