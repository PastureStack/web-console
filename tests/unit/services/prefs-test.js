import { run } from '@ember/runloop';
import { A } from '@ember/array';
import { resolve } from 'rsvp';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import PrefsService from 'ui/services/prefs';

module('Unit | Service | prefs');

function preferenceRecord(name, value) {
  return EmberObject.create({
    id: `1up-${name}`,
    name,
    value: JSON.stringify(value),
    save() {
      return resolve(this);
    },
  });
}

test('page-size computed properties accept legacy two-way binding writes', function(assert) {
  assert.expect(7);

  let records = A([
    preferenceRecord('tableCount', 50),
    preferenceRecord('statsTableCount', 10),
    preferenceRecord('storageTableCount', 25),
  ]);
  let service = PrefsService.create({
    userStore: EmberObject.create({
      all() {
        return records;
      },
    }),
  });

  assert.equal(service.get('storageTablePerPage'), 25, 'reads the stored storage page size');

  run(() => service.set('storageTablePerPage', 0));

  assert.equal(service.get('storageTablePerPage'), 0, 'accepts the semantic All value');
  assert.equal(records.findBy('name', 'storageTableCount').get('value'), '0', 'persists All through the base preference');

  run(() => service.set('storageTablePerPage', 999));

  assert.equal(service.get('storageTablePerPage'), 25, 'normalizes unsupported storage sizes');
  assert.equal(records.findBy('name', 'storageTableCount').get('value'), '25', 'persists the normalized storage size');

  run(() => service.set('tablePerPage', 0));

  assert.equal(service.get('tablePerPage'), 50, 'does not allow All on ordinary tables');
  assert.equal(records.findBy('name', 'tableCount').get('value'), '50', 'persists the ordinary-table fallback');

  run(() => service.destroy());
});
