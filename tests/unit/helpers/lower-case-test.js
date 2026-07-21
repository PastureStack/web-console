import { module, test } from 'qunit';

import {
  lowerCase
} from 'ui/helpers/lower-case';

module('Unit | Helper | lower case');

// Replace this with your real tests.
test('it works with strings', function(assert) {
  var result = lowerCase(["HELLO"]);
  assert.ok(result === "hello");
});
