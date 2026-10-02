import { module, test } from 'qunit';
import { setOwner } from '@ember/application';
import EmberObject from '@ember/object';
import Store from 'ember-api-store/services/store';
import Resource from 'ember-api-store/models/resource';
import Schema from 'ember-api-store/models/schema';
import RequireCreatePermission from 'ui/mixins/require-create-permission';

// Real Store/Schema/Resource implementations; no replacement lookup or getter.
// The owner supplies model factories only, as the public store contract requires.
function fixture(projectId, schemas) {
  const instances = [];
  const owner = {
    lookup(name) {
      const model = (name === 'model:schema' ? Schema : Resource).create();
      instances.push(model);
      return model;
    },
  };
  const store = Store.create({ baseUrl: `/v2-beta/projects/${projectId}` });

  setOwner(store, owner);
  store._bulkAdd('schema', schemas.map((schema) => ({
    type: 'schema',
    resourceFields: {},
    ...schema,
  })));

  return {
    store,
    resource(type, id) {
      const resource = store._typeify({ type, id, accountId: projectId });

      instances.push(resource);
      return resource;
    },
    dispose() {
      store.all('schema').forEach((schema) => schema.destroy());
      new Set(instances).forEach((instance) => instance.destroy());
      store.destroy();
    },
  };
}

module('Unit | Vendor | API store schema lookup', function() {
  test('actual bulk cache and inherited Resource.schema resolve mixed and lowercase types', function(assert) {
    const types = ['registryCredential', 'apiKey', 'loadBalancerService', 'registry'];
    const f = fixture('1a2540', types.map((id) => ({
      id, collectionMethods: ['GET'], resourceMethods: ['GET'],
    })));

    try {
      types.forEach((type, index) => {
        const cached = f.store.getById('schema', type.toLowerCase());
        const resource = f.resource(type, `opaque-${index}`);

        assert.strictEqual(cached.get('id'), type.toLowerCase(), 'bulk producer normalizes schema ID');
        assert.strictEqual(f.store.getById('SCHEMA', type), cached, 'lookup normalizes only schema ID');
        assert.strictEqual(resource.get('type'), type, 'wire/model type is not rewritten');
        assert.strictEqual(resource.get('schema'), cached, 'actual inherited getter resolves the same object');
        assert.deepEqual(resource.get('schema.resourceMethods'), ['GET']);
      });
      assert.strictEqual(f.store.getById('schema', `${f.store.baseUrl}/schemas/registryCredential`),
        f.store.getById('schema', 'registrycredential'), 'existing normalizeType also handles scoped schema URLs');
    } finally {
      f.dispose();
    }
  });

  test('mixed-case capability consumers read the actual cached methods without permissive defaults', function(assert) {
    const f = fixture('1a2540', [{
      id: 'registryCredential', collectionMethods: ['GET', 'POST'], resourceMethods: ['GET', 'PUT'],
    }]);
    const consumer = EmberObject.extend(RequireCreatePermission).create({ store: f.store });

    try {
      assert.true(f.store.canList('registryCredential'));
      assert.true(f.store.canCreate('registryCredential'));
      assert.true(consumer.canUpdateType('registryCredential'));
      assert.false(Boolean(f.store.canCreate('missingType')), 'missing create schema does not grant');
      assert.false(Boolean(f.store.canList('missingType')), 'missing read schema does not grant');
      assert.false(consumer.canUpdateType('missingType'), 'missing update schema does not grant');
      assert.strictEqual(f.resource('missingType', 'missing').get('schema'), undefined,
        'no inherited-getter fallback to another type');
    } finally {
      consumer.destroy();
      f.dispose();
    }
  });

  test('separate project stores retain readonly GET and member PUT without cross-store schema fallback', function(assert) {
    const readonly = fixture('1a2540', [{
      id: 'registryCredential', collectionMethods: ['GET'], resourceMethods: ['GET'],
    }]);
    const member = fixture('1a2541', [{
      id: 'registryCredential', collectionMethods: ['GET', 'POST'], resourceMethods: ['GET', 'PUT', 'DELETE'],
    }]);
    const noSchema = fixture('1a2542', []);
    const readonlyConsumer = EmberObject.extend(RequireCreatePermission).create({ store: readonly.store });
    const memberConsumer = EmberObject.extend(RequireCreatePermission).create({ store: member.store });

    try {
      const r = readonly.resource('registryCredential', '1c1');
      const m = member.resource('registryCredential', '1c1');

      assert.notStrictEqual(r.get('schema'), m.get('schema'), 'schemas belong to their own store');
      assert.deepEqual(r.get('schema.resourceMethods'), ['GET']);
      assert.deepEqual(m.get('schema.resourceMethods'), ['GET', 'PUT', 'DELETE']);
      assert.false(readonly.store.canCreate('registryCredential'));
      assert.false(readonlyConsumer.canUpdateType('registryCredential'));
      assert.true(member.store.canCreate('registryCredential'));
      assert.true(memberConsumer.canUpdateType('registryCredential'));
      assert.strictEqual(noSchema.resource('registryCredential', '1c1').get('schema'), undefined);
      assert.false(Boolean(noSchema.store.canCreate('registryCredential')));
    } finally {
      readonlyConsumer.destroy();
      memberConsumer.destroy();
      readonly.dispose();
      member.dispose();
      noSchema.dispose();
    }
  });

  test('ordinary resource IDs remain opaque and case-sensitive for every normalized group name', function(assert) {
    const f = fixture('1a2540', []);

    try {
      const upper = f.resource('registryCredential', 'CaseSensitive-ID');
      const lower = f.resource('registryCredential', 'casesensitive-id');

      assert.notStrictEqual(upper, lower, 'case-distinct IDs do not coalesce');
      assert.strictEqual(f.store.getById('registryCredential', 'CaseSensitive-ID'), upper);
      assert.strictEqual(f.store.getById('REGISTRYCREDENTIAL', 'casesensitive-id'), lower);
      assert.strictEqual(f.store.getById('registrycredential', 'CASESENSITIVE-ID'), undefined);
      assert.strictEqual(upper.get('id'), 'CaseSensitive-ID');
      assert.strictEqual(lower.get('id'), 'casesensitive-id');
    } finally {
      f.dispose();
    }
  });
});
