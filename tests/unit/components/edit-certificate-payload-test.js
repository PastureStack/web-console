import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import EditCertificate from 'ui/components/edit-certificate/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit-certificate payload');

test('edit PUT body contains only the five editable certificate fields', async function(assert) {
  let options;
  const saved = EmberObject.create({id: 'certificate-1'});
  const model = EmberObject.create({
    id: 'certificate-1',
    type: 'certificate',
    accountId: 'account-1',
    state: 'active',
    created: '2026-01-01T00:00:00Z',
    expiresAt: '2027-01-01T00:00:00Z',
    name: 'updated-name',
    description: '',
    cert: 'updated-certificate',
    key: 'updated-key',
    certChain: '',
    save(value) {
      options = value;
      return Promise.resolve(saved);
    },
  });
  const component = createOwned(EditCertificate, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    modalService: EmberObject.create({modalOpts: EmberObject.create({clone() { return model; }})}),
  }, 'component');

  const result = await component.doSave();
  const body = JSON.parse(JSON.stringify(options.data));

  assert.deepEqual(Object.keys(options), ['data'], 'the save receives an explicit body');
  assert.deepEqual(body, {
    name: 'updated-name',
    description: '',
    cert: 'updated-certificate',
    key: 'updated-key',
    certChain: '',
  }, 'read-only and unrelated cloned fields are absent, while empty edits are retained');
  assert.strictEqual(result, saved, 'the inherited save result remains available');
  destroyOwned(component);
});
