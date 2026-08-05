import { module, test } from 'qunit';
import { parseVolumeSpec, rankedVolumeSuggestions } from 'ui/utils/volume-spec';

module('Unit | Utility | volume spec');

test('it parses anonymous, named, bind and read-only volume paths', function(assert) {
  let anonymous = parseVolumeSpec('/data');
  let named = parseVolumeSpec('database:/var/lib/data');
  let bind = parseVolumeSpec('/srv/config:/etc/app:ro');

  assert.deepEqual(
    {kind: anonymous.kind, target: anonymous.target, mode: anonymous.mode, valid: anonymous.valid},
    {kind: 'anonymous', target: '/data', mode: null, valid: true}
  );
  assert.deepEqual(
    {kind: named.kind, source: named.source, target: named.target, valid: named.valid},
    {kind: 'named', source: 'database', target: '/var/lib/data', valid: true}
  );
  assert.deepEqual(
    {kind: bind.kind, source: bind.source, target: bind.target, mode: bind.mode, valid: bind.valid},
    {kind: 'bind', source: '/srv/config', target: '/etc/app', mode: 'ro', valid: true}
  );
});

test('it rejects relative targets, unsafe paths, invalid names and modes', function(assert) {
  assert.ok(parseVolumeSpec('data:relative').errors.includes('absoluteTarget'));
  assert.ok(parseVolumeSpec('../data:/data').errors.includes('invalidName'));
  assert.ok(parseVolumeSpec('/srv/../secret:/data').errors.includes('unsafeSource'));
  assert.ok(parseVolumeSpec('data:/data:execute').errors.includes('invalidMode'));
  assert.ok(parseVolumeSpec('/data:execute').errors.includes('invalidMode'));
  assert.ok(parseVolumeSpec('/data\u0000').errors.includes('controlCharacter'));
});

test('it ranks prefix matches before contains matches with a stable eight-item limit', function(assert) {
  let suggestions = [
    'logs:/var/log/app',
    'data10:/data',
    'archive-data:/data',
    'data2:/data',
    'data1:/data',
    'data3:/data',
    'data4:/data',
    'data5:/data',
    'data6:/data',
    'data7:/data',
  ];
  let result = rankedVolumeSuggestions(suggestions, 'data', 8);

  assert.equal(result.length, 8, 'limits the tooltip list');
  assert.deepEqual(result.slice(0, 3).map((item) => item.value), [
    'data1:/data',
    'data2:/data',
    'data3:/data',
  ], 'uses natural prefix ordering');
  assert.ok(result.every((item) => item.value.toLowerCase().indexOf('data') >= 0));
  assert.equal(result[0].suffix, '1:/data', 'exposes the inline completion suffix');
});
