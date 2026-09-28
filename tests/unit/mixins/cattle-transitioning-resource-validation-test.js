import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import CattleTransitioningResource from 'ui/mixins/cattle-transitioning-resource';

const labels = {
  'editStack.name.label': '堆疊名稱',
  'formNameDescription.name.label': '名稱',
  'formNameDescription.description.label': '描述',
  'inputCertificate.cert.label': '憑證',
  'inputCertificate.key.label': '私鑰',
  'registriesPage.new.form.custom.labelText': '位址',
  'registriesPage.new.form.username.labelText': '使用者名稱',
  'registriesPage.new.form.password.labelText': '密碼',
  'newSecret.value.label': '機密資料值',
};

function errorsFor(type, fields, translations = labels) {
  let Subject = EmberObject.extend(CattleTransitioningResource, {
    trimValues() {},
  });
  let subject = Subject.create({
    type,
    intl: EmberObject.create({
      exists(key) { return Object.prototype.hasOwnProperty.call(translations, key); },
      t(key, params) {
        if ( key === 'validation.required' ) {
          return `${params.key} 必須設定`;
        }
        return translations[key];
      },
    }),
    store: EmberObject.create({
      getById(schemaType, name) {
        if ( schemaType !== 'schema' || name !== type.toLowerCase() ) {
          return null;
        }
        let resourceFields = {};
        fields.forEach((field) => {
          resourceFields[field] = {type: 'string', required: true, nullable: true};
        });
        return {resourceFields};
      },
    }),
  });
  let errors = subject.validationErrors();
  subject.destroy();
  return errors;
}

module('Unit | Mixin | cattle transitioning resource validation');

test('required errors use the visible translated labels of the affected forms', function(assert) {
  assert.deepEqual(errorsFor('secret', ['name', 'value']), [
    '名稱 必須設定', '機密資料值 必須設定',
  ]);
  assert.deepEqual(errorsFor('certificate', ['name', 'cert', 'key']), [
    '名稱 必須設定', '憑證 必須設定', '私鑰 必須設定',
  ]);
  assert.deepEqual(errorsFor('registry', ['serverAddress']), [
    '位址 必須設定',
  ]);
  assert.deepEqual(errorsFor('registryCredential', ['publicValue', 'secretValue']), [
    '使用者名稱 必須設定', '密碼 必須設定',
  ]);
  assert.deepEqual(errorsFor('stack', ['name']), ['堆疊名稱 必須設定']);
  assert.deepEqual(errorsFor('service', ['name']), ['名稱 必須設定']);
  assert.deepEqual(errorsFor('container', ['name']), ['名稱 必須設定']);
});

test('model-specific labels retain priority and unknown fields retain their fallback', function(assert) {
  assert.deepEqual(errorsFor('secret', ['name', 'unknownField'], {
    ...labels,
    'model.secret.name.label': '專用名稱',
  }), ['專用名稱 必須設定', 'Unknown Field 必須設定']);
  assert.deepEqual(errorsFor('stack', ['name'], {
    ...labels,
    'editStack.name.label': 'スタック名',
  }), ['スタック名 必須設定'],
  'the stack label follows the selected locale');
});
