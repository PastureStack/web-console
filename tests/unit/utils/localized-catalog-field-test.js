import { module, test } from 'qunit';

import {
  localizedCatalogField,
  localizedCatalogQuestionField,
  localizedCatalogReadme,
  normalizeCatalogLocale
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

test('it localizes catalog questions by normalized variable name', function(assert) {
  let labels = {
    'io.pasturestack.catalog.question.vault_url.label.zh-tw': 'Vault API 網址',
    'io.pasturestack.catalog.question.vault_url.description.zh-tw': 'Vault API 的 HTTPS 基底網址。'
  };

  assert.equal(
    localizedCatalogQuestionField(labels, ['zh_TW'], 'VAULT_URL', 'label', 'Vault API URL'),
    'Vault API 網址'
  );
  assert.equal(
    localizedCatalogQuestionField(labels, ['zh-TW'], 'VAULT_URL', 'description', 'Fallback'),
    'Vault API 的 HTTPS 基底網址。'
  );
});

test('it selects a localized README without changing the English fallback', function(assert) {
  let files = {
    'README.zh-TW.md': '# 繁體中文',
    'docker-compose.yml': 'version: 2'
  };

  assert.equal(normalizeCatalogLocale(['zh_TW']), 'zh-tw');
  assert.equal(localizedCatalogReadme(files, ['zh_TW']), '# 繁體中文');
  assert.equal(localizedCatalogReadme(files, ['en_US']), null);
});
