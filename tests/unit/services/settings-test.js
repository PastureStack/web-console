import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import SettingsService, { resolveAppName } from 'ui/services/settings';

module('Unit | Service | settings');

test('it always provides a product name when white-label data is absent', function(assert) {
  assert.equal(resolveAppName('', 'PastureStack', false), 'PastureStack');
  assert.equal(resolveAppName(null, 'PastureStack', false), 'PastureStack');
  assert.equal(resolveAppName('pasturestack', 'PastureStack', true), 'PastureStack');
  assert.equal(resolveAppName('Custom Platform', 'PastureStack', false), 'Custom Platform');
});

test('load adopts every setting request through the shared callback adapter', function(assert) {
  let requested = [];
  let service = SettingsService.create({
    userStore: {
      all() {
        return [];
      },
      find(type, id) {
        requested.push(`${type}:${id}`);
        return id === 'second.setting' ? {then: (fulfill) => fulfill(id)} : resolve(id);
      },
    },
  });

  return service.load(['first.setting', 'second.setting']).then(() => {
    assert.deepEqual(requested.sort(), ['setting:first.setting', 'setting:second.setting'], 'Promise and thenable requests both complete');
    run(() => service.destroy());
  });
});

test('load rejects with the original asynchronous or synchronous request failure', async function(assert) {
  for (let mode of ['async', 'sync']) {
    let failure = new Error(`${mode} settings failure`);
    let service = SettingsService.create({
      userStore: {
        all() {
          return [];
        },
        find() {
          if ( mode === 'sync' ) {
            throw failure;
          }
          return reject(failure);
        },
      },
    });

    try {
      await service.load('api.host');
      assert.ok(false, `${mode} failure must reject`);
    } catch (error) {
      assert.strictEqual(error, failure, `${mode} failure is retained`);
    } finally {
      run(() => service.destroy());
    }
  }
});
