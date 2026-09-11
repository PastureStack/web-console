import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import { readableServices } from 'ui/components/page-header/component';

module('Unit | Component | page header');

test('transient holes in the live service collection are ignored', function(assert) {
  let service = EmberObject.create({id: '1s1', serviceApp: null});

  assert.deepEqual(
    readableServices([undefined, null, {}, service]),
    [service],
    'only readable service resources reach navigation observers'
  );
});
