import { module, test } from 'qunit';
import { driverDisplayUrl } from 'ui/utils/driver-display-url';

module('Unit | Utility | driver display URL');

test('it shortens only exact GitHub repository hosts', function(assert) {
  assert.equal(driverDisplayUrl('https://github.com/example/driver'), '.../example/driver');
  assert.equal(driverDisplayUrl('github.com/example/driver?ref=main'), '.../example/driver');
  assert.equal(
    driverDisplayUrl('https://github.com.attacker.example/example/driver'),
    'https://github.com.attacker.example/example/driver',
    'does not trust a hostname containing github.com as a substring'
  );
  assert.equal(
    driverDisplayUrl('https://attacker.example/github.com/example/driver'),
    'https://attacker.example/github.com/example/driver',
    'does not trust github.com in a path'
  );
});
