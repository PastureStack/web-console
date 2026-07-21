import { module, test } from 'qunit';

import {
  nlToBr
} from 'ui/helpers/nl-to-br';

module('Unit | Helper | nl to br');

// Replace this with your real tests.
test('it works', function(assert) {
  var result = nlToBr(["things\nstuff"]);
  assert.equal(result.toString(),"things<br/>\nstuff");
});
