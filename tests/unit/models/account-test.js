import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { module, test } from 'qunit';
import Account from 'ui/models/account';

module('Unit | Model | account');

test('account name uses authoritative identity fallback without changing description', function(assert) {
  let account = Account.create({
    name: '',
    description: 'Operator maintained description',
    _authIdentityLinks: [EmberObject.create({
      name: '',
      login: 'operator@example.test',
      externalId: 'opaque-subject',
    })],
  });

  assert.strictEqual(account.get('resolvedName'), 'operator@example.test', 'identity login fills an empty account name');
  assert.strictEqual(account.get('description'), 'Operator maintained description', 'identity data never replaces account description');

  account.set('_authIdentityLinks.firstObject.name', 'Visible operator');
  assert.strictEqual(account.get('resolvedName'), 'Visible operator', 'identity display name wins over login');

  account.setProperties({name: 'Account name', description: ''});
  assert.strictEqual(account.get('resolvedName'), 'Account name', 'the real account name remains authoritative');
  assert.strictEqual(account.get('description'), '', 'an empty real description stays empty instead of borrowing OIDC data');

  account.destroy();
});

test('account name falls back through external ID and local username', function(assert) {
  let link = EmberObject.create({name: '', login: '', externalId: 'subject-123'});
  let account = Account.create({id: '1a-local', _authIdentityLinks: [link]});

  assert.strictEqual(account.get('resolvedName'), 'subject-123', 'external ID is the last identity-link fallback');
  account.set('_authIdentityLinks', []);
  account.set('_allPasswords', A([
    EmberObject.create({accountId: '1a-local', publicValue: 'local-admin', kind: 'password'}),
  ]));
  assert.strictEqual(account.get('resolvedName'), 'local-admin', 'local accounts fall back to their username');

  account.destroy();
});

test('authoritative identity links remain display-only and never enter account updates', function(assert) {
  let account = Account.create({
    id: '1a-oidc',
    name: '',
    description: 'Operator description',
    _authIdentityLinks: [EmberObject.create({
      externalIdType: 'oidc_user',
      externalId: 'subject-123',
      login: 'oidc-user@example.test',
    })],
  });
  let payload = account.serialize();

  assert.strictEqual(account.get('resolvedName'), 'oidc-user@example.test', 'the display model retains its identity link');
  assert.notOk(Object.prototype.hasOwnProperty.call(payload, '_authIdentityLinks'), 'the API payload excludes identity links');
  assert.strictEqual(payload.description, 'Operator description', 'the editable account fields remain serializable');

  account.destroy();
});
