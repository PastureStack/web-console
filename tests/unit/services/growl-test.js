import { module, test } from 'qunit';
import $ from 'jquery';
import Growl from 'ui/services/growl';

module('Unit | Service | growl');

test('notices use the body outside authenticated pages and move with its mount', function(assert) {
  let growl = Growl.create();
  growl.raw('Login error', 'Try again');

  let container = document.getElementById('jGrowl');
  assert.ok(container && container.classList.contains('jGrowl'), 'the global plugin starts');
  assert.strictEqual(container.parentNode, document.body, 'login notices use the body');
  let instance = $(container).data('jGrowl.instance');
  assert.ok(instance && instance.interval, 'the plugin timer is running');

  let mount = document.createElement('div');
  mount.id = 'growl-mount';
  document.getElementById('qunit-fixture').appendChild(mount);
  growl.placeContainer();
  assert.strictEqual(container.parentNode, mount, 'authenticated notices use the content flow');

  growl.placeContainer(document.body);
  assert.strictEqual(container.parentNode, document.body, 'logout keeps the plugin available');
  assert.strictEqual($(container).data('jGrowl.instance'), instance,
    'moving the container preserves its running plugin instance');
  mount.remove();
  assert.strictEqual(growl.placeContainer(), document.body, 'later login notices still target the body');
  growl.raw('Login error', 'Try again');
  assert.strictEqual(container.parentNode, document.body, 'later login errors still use the body');

  $(container).jGrowl('shutdown');
  container.remove();

  document.getElementById('qunit-fixture').appendChild(mount);
  growl.raw('Denied', 'No create permission');
  let newContainer = document.getElementById('jGrowl');
  assert.strictEqual(newContainer.parentNode, mount,
    'the first authenticated notice is created inside the mount');

  $(newContainer).jGrowl('shutdown');
  newContainer.remove();
  mount.remove();
  growl.destroy();
});

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
    for (let status of [403, 404, 405]) {
      growl.fromError('Delete failed', {status, message: 'private resource ID 1st-secret'});
      assert.deepEqual(notifications.pop(), {
        title: 'Delete failed',
        body: messages['resourceSaveError.actionUnavailable'],
      }, `${locale} ${status} does not call a delete failure a save or expose its resource ID`);
    }

    let inUse = {status: 405, code: 'InvalidAction',
      message: 'Certificate is in use by load balancer services: private-balancer 1s-secret'};
    growl.fromError('Delete failed', inUse);
    assert.ok(messages['resourceSaveError.certificateInUse'], `${locale} has certificate lifecycle copy`);
    assert.strictEqual(notifications.pop().body, messages['resourceSaveError.certificateInUse'],
      `${locale} explains the blocked delete without disclosing service names`);
    for (let status of [403, 404]) {
      growl.fromError('Delete failed', {status, body: inUse});
      assert.strictEqual(notifications.pop().body, messages['resourceSaveError.actionUnavailable'],
        `${locale} denied/missing resources retain the same neutral growl`);
    }

    growl.fromError('Validation failed', {status: 422, fieldName: 'name', detail: 'already used'});
    assert.ok(notifications.pop().body.startsWith(messages['resourceSaveError.validation']),
      `${locale} validation still uses the existing localized formatter`);
    growl.destroy();
  }
});
