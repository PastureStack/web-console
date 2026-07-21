import { module, test } from 'qunit';
import { catalogDisplayName } from 'ui/utils/catalog-display-name';

module('Unit | Utility | catalog display name');

test('removes a repeated PastureStack card-name prefix', function(assert) {
  assert.equal(
    catalogDisplayName('PastureStack NFS Storage'),
    'NFS Storage'
  );
  assert.equal(
    catalogDisplayName('PastureStack：網路服務'),
    '網路服務'
  );
  assert.equal(
    catalogDisplayName('PastureStack — Network Services'),
    'Network Services'
  );
});

test('preserves names without the brand prefix', function(assert) {
  assert.equal(catalogDisplayName('Metadata Healthcheck'), 'Metadata Healthcheck');
  assert.equal(catalogDisplayName(''), '');
  assert.equal(catalogDisplayName(null), '');
});
