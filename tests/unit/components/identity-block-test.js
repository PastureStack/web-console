import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import IdentityBlock from 'ui/components/identity-block/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | identity block');

test('embedded external identity remains visible when the authoritative lookup is unavailable', function(assert) {
  let component = createOwned(IdentityBlock, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t: (key) => key}),
    userStore: EmberObject.create({
      find() {
        return new Promise(() => {});
      },
    }),
    externalIdType: 'oidc_user',
    externalId: 'retired-subject',
  }, 'component');

  assert.strictEqual(component.get('identity.login'), 'retired-subject',
    'the embedded identity is immediately available while the lookup is pending or unavailable');
  assert.strictEqual(component.get('ariaLabel'), 'retired-subject',
    'the embedded external ID remains the accessible fallback');
  assert.strictEqual(component.get('role'), 'group',
    'the component exposes a role that can carry its accessible name');

  destroyOwned(component);
});

test('identity text avoids duplicate login and exposes an accessible fallback label', function(assert) {
  let identity = EmberObject.create({
    name: null,
    login: 'operator@example.test',
    externalId: 'opaque-subject',
    externalIdType: 'oidc_user',
  });
  let component = createOwned(IdentityBlock, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t: (key) => key}),
    identity,
  }, 'component');

  assert.strictEqual(component.get('ariaLabel'), 'operator@example.test',
    'the provider login labels an identity without a display name');
  assert.strictEqual(component.get('displayDescription'), 'opaque-subject',
    'the second line does not repeat the login already rendered on the first line');
  identity.set('login', null);
  assert.strictEqual(component.get('ariaLabel'), 'opaque-subject',
    'the external ID remains the final accessible label');
  assert.strictEqual(component.get('displayDescription'), 'opaque-subject',
    'the external ID remains the final visible detail');
  identity.set('name', 'Visible operator');
  assert.strictEqual(component.get('displayDescription'), 'Visible operator',
    'an authoritative display name remains preferred');
  assert.strictEqual(component.get('ariaLabel'), 'Visible operator',
    'the authoritative display name is the preferred accessible label');

  identity.setProperties({name: 'same-value', login: 'same-value', externalId: 'same-value'});
  assert.strictEqual(component.get('displayDescription'), undefined,
    'identical values are not rendered twice');

  destroyOwned(component);
});
