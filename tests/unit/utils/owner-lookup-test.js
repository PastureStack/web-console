import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { setOwner } from '@ember/application';
import { module, test } from 'qunit';

import ownerLookup from 'ui/utils/owner-lookup';

module('Unit | Utility | owner lookup');

test('it resolves stable legacy properties through the public owner API', function(assert) {
  let target = {id: 'lookup-target'};
  let requestedName;
  let subject = EmberObject.extend({
    target: ownerLookup('service:lookup-target'),
  }).create();

  setOwner(subject, {
    lookup(fullName) {
      requestedName = fullName;
      return target;
    },
  });

  assert.strictEqual(subject.get('target'), target);
  assert.equal(requestedName, 'service:lookup-target');

  run(() => subject.destroy());
});
