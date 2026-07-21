import { module, test } from 'qunit';

import {
  localizedCatalogField
} from 'ui/utils/localized-catalog-field';

module('Unit | Utility | localized catalog field');

test('it selects an exact locale label and normalizes locale spelling', function(assert) {
  let labels = {
    'io.pasturestack.catalog.name.zh-tw': '網頁服務'
  };

  assert.equal(
    localizedCatalogField(labels, ['zh_TW'], 'name', 'Web Service'),
    '網頁服務'
  );
});

test('it falls back without exposing empty or missing metadata', function(assert) {
  let labels = {
    'io.pasturestack.catalog.description.zh-tw': '   '
  };

  assert.equal(
    localizedCatalogField(labels, ['zh-tw'], 'description', 'Fallback'),
    'Fallback'
  );
  assert.equal(
    localizedCatalogField(null, ['zh-tw'], 'name', 'Fallback'),
    'Fallback'
  );
});
