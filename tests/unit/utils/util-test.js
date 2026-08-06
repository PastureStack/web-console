import { module, test } from 'qunit';

import util from 'ui/utils/util';

module('Unit | Utility | util');

test('arrayDiff returns values not present in the comparison array', function(assert) {
  var result = util.arrayDiff([1,2,3],[1,2]);
  assert.equal(result.length, 1);
  assert.equal(result[0], 3);
});

test('camelToTitle does not depend on legacy String prototype extensions', function(assert) {
  assert.equal(util.camelToTitle('volumeDriver'), 'Volume Driver');
  assert.equal(util.camelToTitle('volume_driver'), 'Volume Driver');
  assert.equal(util.camelToTitle('HTTPServerURL'), 'Http Server Url');
  assert.equal(util.camelToTitle(null), '');
});
