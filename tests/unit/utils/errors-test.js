import { module, test } from 'qunit';
import ApiError from 'ember-api-store/models/error';
import Errors from 'ui/utils/errors';

module('Unit | Utility | errors');

test('extracts useful messages from API and XHR error envelopes', function(assert) {
  assert.strictEqual(
    Errors.stringify({body: '{"message":"OIDC discovery failed"}'}),
    'OIDC discovery failed',
    'a JSON response body is decoded'
  );
  assert.strictEqual(
    Errors.stringify({xhr: {responseJSON: {detail: 'Issuer does not match'}}}),
    'Issuer does not match',
    'a nested XHR API detail is shown'
  );
  assert.strictEqual(
    Errors.stringify({statusText: 'Bad Gateway'}),
    'Bad Gateway',
    'the HTTP status text is a safe final explanation'
  );
  assert.strictEqual(Errors.stringify({}), null, 'unknown objects do not become blank-looking object text');
});

test('finds authentication status codes in nested request failures', function(assert) {
  assert.strictEqual(Errors.status({status: 401}), 401, 'a direct status is found');
  assert.strictEqual(Errors.status({xhr: {status: 403}}), 403, 'an XHR status is found');
  assert.strictEqual(Errors.status({body: '{"status":502}'}), 502, 'a JSON body status is found');
  assert.strictEqual(Errors.status({xhr: {status: 0}}), null, 'a network failure is not authentication failure');
});

test('save errors have useful reviewed copy in English, Traditional Chinese, and Japanese', async function(assert) {
  for (let locale of ['en-us', 'zh-tw', 'ja-jp']) {
    let response = await fetch(`/translations/${locale}.json`);
    assert.ok(response.ok, `${locale} translations are available`);
    let messages = await response.json();
    let lookup = (key) => messages[key];
    let intl = {t: lookup};

    for (let key of ['unavailable', 'validation', 'failed']) {
      assert.ok(lookup(`resourceSaveError.${key}`), `${locale} has ${key} copy`);
    }
    for (let key of [
      'projectTemplateUnavailable', 'stackUnavailable', 'stackFailed',
      'serviceUnavailable', 'serviceFailed', 'secretsUnavailable', 'secretsFailed',
      'accountsUnavailable', 'accountsFailed',
      'accountSecurityUnavailable', 'accountSecurityFailed'
    ]) {
      assert.ok(lookup(`resourceLoadError.${key}`), `${locale} has ${key} load copy`);
    }

    let denied = ApiError.create({status: 403, message: 'Resource 1st1 exists', detail: 'private ID'});
    let missing = ApiError.create({status: 404, message: 'Resource 1st1 does not exist'});
    assert.strictEqual(Errors.status(denied), 403, 'the API error model exposes its status');
    assert.strictEqual(Errors.stringify(denied, intl), lookup('resourceSaveError.unavailable'),
      `${locale} does not expose the denied resource's message or ID`);
    assert.strictEqual(Errors.stringify(missing, intl), lookup('resourceSaveError.unavailable'),
      `${locale} gives a missing resource the same visible explanation`);
    assert.strictEqual(Errors.stringify({status: 403}, intl), lookup('resourceSaveError.unavailable'),
      `${locale} has a nonempty fallback for a status-only denial`);
    assert.strictEqual(Errors.stringify({status: 405, message: 'Raw English method error'}, intl),
      lookup('resourceSaveError.unavailable'),
      `${locale} localizes a denied save when the schema method is unavailable`);

    let validation = ApiError.create({status: 422, fieldName: 'name', detail: 'already used', code: 'NotUnique'});
    let validationText = Errors.stringify(validation, intl);
    assert.ok(validationText.startsWith(lookup('resourceSaveError.validation')),
      `${locale} begins validation errors in the selected language`);
    assert.ok(validationText.includes('name: already used'), 'the API field and detail remain visible');
    assert.strictEqual(Errors.stringify({status: 422, xhr: {responseJSON: {fieldName: 'name', detail: 'too long'}}}, intl),
      `${lookup('resourceSaveError.validation')} name: too long`, 'nested API validation details remain visible');
    assert.strictEqual(Errors.stringify({}, intl), lookup('resourceSaveError.failed'),
      `${locale} never displays a blank error for an unknown failed save`);
  }

  let legacy = ApiError.create({status: 422, fieldName: 'name', detail: 'already used'});
  assert.ok(Errors.stringify(legacy).startsWith('Validation failed in API:'),
    'existing callers without intl keep their original formatting');
});
