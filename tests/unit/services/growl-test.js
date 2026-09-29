import { module, test } from 'qunit';
import Growl from 'ui/services/growl';

module('Unit | Service | growl');

test('denied deletes and actions use neutral, private-safe copy in all supported write locales', async function(assert) {
  for (let locale of ['en-us', 'zh-tw', 'ja-jp']) {
    let response = await fetch(`/translations/${locale}.json`);
    assert.ok(response.ok, `${locale} translations are available`);
    let messages = await response.json();
    let notifications = [];
    let growl = Growl.create({
      intl: {t(key) { return messages[key]; }},
      error(title, body) { notifications.push({title, body}); },
    });

    assert.ok(messages['resourceSaveError.actionUnavailable'], `${locale} has neutral action copy`);
    for (let status of [403, 404]) {
      growl.fromError('Delete failed', {status, message: 'private resource ID 1st-secret'});
      assert.deepEqual(notifications.pop(), {
        title: 'Delete failed',
        body: messages['resourceSaveError.actionUnavailable'],
      }, `${locale} ${status} does not call a delete failure a save or expose its resource ID`);
    }

    growl.fromError('Validation failed', {status: 422, fieldName: 'name', detail: 'already used'});
    assert.ok(notifications.pop().body.startsWith(messages['resourceSaveError.validation']),
      `${locale} validation still uses the existing localized formatter`);
    growl.destroy();
  }
});
