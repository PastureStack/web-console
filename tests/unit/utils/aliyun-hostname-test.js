import { module, test } from 'qunit';
import { isValidAliyunHostname } from 'ui/utils/aliyun-hostname';

module('Unit | Utility | Aliyun hostname');

test('it validates hostnames without backtracking', function(assert) {
  assert.ok(isValidAliyunHostname('node-01.example'), 'accepts a normal hostname');
  assert.notOk(isValidAliyunHostname('node-.example'), 'rejects a label ending in a hyphen');
  assert.notOk(isValidAliyunHostname('node..example'), 'rejects an empty label');
  assert.notOk(isValidAliyunHostname(`A${'-'.repeat(5000)}!`), 'rejects hostile long input in linear time');
});
