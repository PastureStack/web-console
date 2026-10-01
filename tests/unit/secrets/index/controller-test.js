import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import SecretsIndexController from 'ui/secrets/index/controller';

module('Unit | Controller | secrets/index | desktop headers');

test('desktop headers use existing generic translation keys', function(assert) {
  let controller = SecretsIndexController.create();
  let headers = controller.get('headers');

  assert.deepEqual(headers.filter((header) => !header.isActions).map((header) => header.translationKey), [
    'generic.state',
    'generic.name',
    'generic.description',
    'generic.created',
  ]);
  assert.strictEqual(headers[4].translationKey, undefined, 'actions header remains unchanged and visually suppressed');

  run(() => controller.destroy());
});

test('translation keys preserve all legacy table and QA mapping fields', function(assert) {
  let controller = SecretsIndexController.create();
  let legacyHeaders = controller.get('headers').map((header) => {
    let legacy = {...header};

    delete legacy.translationKey;
    return legacy;
  });

  assert.deepEqual(legacyHeaders, [
    {
      displayName: 'State',
      name: 'stateSort',
      sort: ['stateSort', 'name', 'id'],
      type: 'string',
      searchField: 'displayState',
      classNames: '',
      width: '125px',
    },
    {
      displayName: 'Name',
      name: 'name',
      sort: ['name', 'id'],
      type: 'string',
    },
    {
      displayName: 'Description',
      name: 'description',
      sort: ['description', 'name', 'id'],
      type: 'string',
    },
    {
      displayName: 'Created',
      name: 'created',
      sort: ['primaryHost.displayName', 'name', 'id'],
      searchField: false,
      type: 'string',
    },
    {
      displayName: 'Actions',
      isActions: true,
      width: '110px',
    },
  ], 'only four translationKey properties are added; names, sorting, searching, widths and fallback labels stay intact');
  assert.equal(controller.get('sortBy'), 'name');
  assert.deepEqual(controller.get('queryParams'), ['sortBy']);

  run(() => controller.destroy());
});
