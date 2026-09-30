import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { credentialUpdateData } from 'ui/utils/registry-save';

module('Unit | Utility | registry-save');

test('username-only updates omit missing, undefined, null and empty passwords', function(assert) {
  for ( const values of [{}, {secretValue: undefined}, {secretValue: null}, {secretValue: ''}] ) {
    const credential = EmberObject.create({publicValue: 'edited-user', registryId: 'registry-1', ...values});
    assert.deepEqual(credentialUpdateData(credential), {publicValue: 'edited-user'},
      'only the username is sent when no new password was entered');
    assert.deepEqual(credential.getProperties(Object.keys(values)), values, 'building a PUT does not mutate the credential');
  }
});

test('explicit nonempty passwords are sent byte-for-byte without cloned metadata', function(assert) {
  for ( const password of ['new-password', '  new-password  ', '   '] ) {
    const credential = EmberObject.create({
      id: 'credential-1', registryId: 'registry-1', publicValue: 'edited-user',
      email: 'ignored@invalid.test', state: 'active', secretValue: password,
    });
    assert.deepEqual(credentialUpdateData(credential), {publicValue: 'edited-user', secretValue: password});
    assert.strictEqual(credential.get('secretValue'), password);
  }
});

test('the existing-password hint has reviewed English, Traditional Chinese and Japanese copy', async function(assert) {
  const expected = {
    'en-us': 'Leave blank to keep the current password.',
    'zh-tw': '留空保留現有密碼。',
    'ja-jp': '空欄のままにすると、現在のパスワードを保持します。',
  };
  for ( const locale of Object.keys(expected) ) {
    const response = await fetch(`/translations/${locale}.json`);
    assert.ok(response.ok, `${locale} translations are available`);
    const messages = await response.json();
    assert.strictEqual(messages['editRegistry.password.keepExisting'], expected[locale]);
  }
});
