import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import EditCertificate from 'ui/components/edit-certificate/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit-certificate key validation');

test('edit rejects an encrypted private key with the same message as add', function(assert) {
  const model = EmberObject.create({
    key: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nexample\n',
    validationErrors() { return []; },
  });
  const component = createOwned(EditCertificate, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    modalService: EmberObject.create({modalOpts: EmberObject.create({clone() { return model; }})}),
  }, 'component');

  assert.false(component.validate());
  assert.deepEqual(component.get('errors'), ['certificatesPage.encryptedKeyError']);
  model.set('key', '-----BEGIN PRIVATE KEY-----\nexample\n');
  assert.true(component.validate());
  destroyOwned(component);
});
