import { module, test } from 'qunit';

import DriverAmazonec2 from 'ui/components/machine/driver-amazonec2/component';

module('Unit | Component | machine | driver-amazonec2 tags');

test('allows no tags and still rejects commas in tag names or values', function(assert) {
  const validate = DriverAmazonec2.proto().validate;
  let tags;
  const properties = {
    amazonec2Config: {get: () => tags},
    'nameParts.prefix': 'qa-ec2',
    intl: {t: (key, {tag}) => `${key}: ${tag}`},
  };
  const component = {
    get: key => properties[key],
    set: (key, value) => { properties[key] = value; },
  };

  assert.true(validate.call(component), 'omitted tags pass validation');
  assert.deepEqual(properties.errors, []);

  tags = {'invalid,key': 'value', another: 'invalid,value'};
  assert.false(validate.call(component));
  assert.deepEqual(properties.errors, [
    'machine.driverAmazon.tags.error: invalid,key', 'machine.driverAmazon.tags.error: another',
  ]);
});
