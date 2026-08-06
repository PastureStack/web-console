import { module, test } from 'qunit';
import { catalogVersionOptions } from 'ui/utils/catalog-version-options';

module('Unit | Utility | catalog version options');

test('it maps the installed revision and every valid upgrade link into choices', function(assert) {
  let options = catalogVersionOptions({
    'v0.3.16-pasturestack.1': '/templates/healthcheck:1',
    'invalid-empty-link': '',
  }, {
    version: 'v0.3.15 (current)',
    link: '/templateversions/healthcheck:0',
  });

  assert.deepEqual(options, [
    {
      version: 'v0.3.15 (current)',
      link: '/templateversions/healthcheck:0',
    },
    {
      version: 'v0.3.16-pasturestack.1',
      link: '/templates/healthcheck:1',
    },
  ]);
});

test('it fails closed for a missing or malformed version-link map', function(assert) {
  assert.deepEqual(catalogVersionOptions(null), []);
  assert.deepEqual(catalogVersionOptions('not-a-map'), []);
  assert.deepEqual(catalogVersionOptions({v1: null}), []);
});
