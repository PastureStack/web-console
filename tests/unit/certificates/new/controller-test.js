import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import CertificateNewController from 'ui/certificates/new/controller';

module('Unit | Controller | certificates/new');

test('encrypted private keys use the active locale error without submitting', function(assert) {
  let keys = [];
  let controller = CertificateNewController.create({
    intl: EmberObject.create({
      t(key) {
        keys.push(key);
        return '私鑰不可設定密碼保護。';
      },
    }),
    model: EmberObject.create({
      key: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nexample\n',
      validationErrors() { return []; },
    }),
  });

  assert.notOk(controller.validate(), 'the encrypted key is rejected');
  assert.deepEqual(keys, ['certificatesPage.encryptedKeyError']);
  assert.deepEqual(controller.get('errors'), ['私鑰不可設定密碼保護。']);
  controller.set('model.key', '-----BEGIN PRIVATE KEY-----\nexample\n');
  assert.ok(controller.validate(), 'a non-encrypted key remains valid');
  assert.deepEqual(controller.get('errors'), [], 'the previous error does not persist');
  controller.destroy();
});
