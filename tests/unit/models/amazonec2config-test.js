import { module, test } from 'qunit';

import Amazonec2Config from 'ui/models/amazonec2config';

module('Unit | Model | amazonec2config');

test('accepts an omitted, null, or empty tags value', function(assert) {
  for (const data of [{}, {tags: null}, {tags: ''}]) {
    const imported = Amazonec2Config.mangleIn({...data});
    assert.deepEqual(imported, data);
    assert.deepEqual(Amazonec2Config.mangleOut(imported), data);
  }
});

test('round trips tag values and accepts an existing tag map', function(assert) {
  const wire = 'Name,qa,Empty,,Environment,test';
  const tags = {Name: 'qa', Empty: '', Environment: 'test'};
  const imported = Amazonec2Config.mangleIn({tags: wire});

  assert.deepEqual(imported.tags, tags);
  assert.deepEqual(Amazonec2Config.mangleIn({tags}), {tags});
  assert.deepEqual(Amazonec2Config.mangleOut(imported), {tags: wire});
  assert.deepEqual(Amazonec2Config.mangleOut({tags: wire}), {tags: wire});
});
