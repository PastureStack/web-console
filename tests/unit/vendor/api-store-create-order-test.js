import { module, test } from 'qunit';
import { setOwner } from '@ember/application';
import { run } from '@ember/runloop';
import { defer, resolve } from 'rsvp';
import Store from 'ember-api-store/services/store';
import Resource from 'ember-api-store/models/resource';
import Schema from 'ember-api-store/models/schema';
import Collection from 'ember-api-store/models/collection';
import { bindCreateOnlyDelivery, cloneCreateOnlyDelivery, takeCreateOnlyDelivery } from 'ember-api-store/utils/create-only-delivery';
import EditApiKey from 'ui/components/edit-apikey/component';
import EmberObject from '@ember/object';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

// Real installed compatibility package and Type.save. Only the HTTP boundary
// is deferred: subscribe import must complete before the original 201 arrives.
function fixture(project = '1a-test', baseUrl = `/v2-beta/projects/${project}`) {
  const objects = new Set();
  const requests = [];
  const store = Store.create({ baseUrl });
  setOwner(store, { lookup(name) {
    if ( name === 'service:fastboot' ) { return { isFastBoot: false }; }
    const Factory = name === 'model:schema' ? Schema :
      name === 'model:collection' ? Collection : Resource;
    const object = Factory.create();
    objects.add(object);
    return object;
  } });
  const createRecord = store.createRecord.bind(store);
  store.createRecord = (...args) => {
    const object = createRecord(...args);
    objects.add(object);
    return object;
  };
  const response = defer();
  store.rawRequest = (options) => { requests.push(options); return response.promise; };
  store._bulkAdd('schema', ['volume', 'loadBalancerService', 'service'].map(id => ({
    type: 'schema', id, resourceFields: {}, collectionMethods: ['GET', 'POST'],
    links: { collection: `${store.baseUrl}/${id}s` },
  })));
  store._bulkAdd('schema', [{type: 'schema', id: 'apiKey',
    collectionMethods: ['GET', 'POST'], resourceFields: {
      name: {type: 'string', create: true},
      publicValue: {type: 'string', create: false},
      secretValue: {type: 'password', create: false, update: false, readOnCreateOnly: true},
      nested: {type: 'service'},
    }, links: {collection: `${store.baseUrl}/apikeys`}}]);
  return { store, requests, response,
    destroy() {
      store.all('schema').forEach(object => objects.add(object));
      run(() => {
        objects.forEach(object => { if ( !object.isDestroyed ) { object.destroy(); } });
        store.destroy();
      });
    },
  };
}

const initial = (type = 'volume', id = 'Opaque-ID') => ({
  type, id, accountId: '1a-test', name: 'created', state: 'registering', externalId: null,
});
const current = (type = 'volume', id = 'Opaque-ID') => ({
  ...initial(type, id), state: 'inactive', externalId: 'created',
});

module('Unit | Vendor | API store create response order', function() {
  test('apiKey first delivery survives redacted subscribe before 201 and later redaction in personal and project stores, 100 deterministic barriers each', async function(assert) {
    for ( const [accountId, baseUrl] of [['1a-owner', '/v2-beta'], ['1a-project', '/v2-beta/projects/1a-project']] ) {
      for ( let index = 0; index < 100; index++ ) {
        const f = fixture(accountId, baseUrl);
        let subject;
        try {
          const original = f.store.createRecord({type: 'apiKey', name: 'created', accountId});
          const draft = original.clone();
          subject = createOwned(EditApiKey, {
            renderer: inertRenderer(),
            intl: EmberObject.create({t(key) { return key; }}),
            modalService: EmberObject.create({modalOpts: original}),
            model: draft,
            clone: original.clone(),
            didSave(resource) {
              assert.strictEqual(imports, 0, '201 adoption performs no stale mangleIn or nested import');
              return resource;
            },
          }, 'component');
          const completion = [];
          const saving = run(() => subject.get('actions').save.call(subject, success => completion.push(success)));
          // Await the actual willSave/doSave RSVP turns, not a clock delay.
          for ( let turn = 0; !f.requests.length && turn < 20; turn++ ) { await resolve(); }
          assert.strictEqual(f.requests.length, 1, 'the actual save reaches its deferred HTTP boundary');
          const nested = run(() => f.store._typeify({...current('service', 'Nested-ID'), state: 'active'}));
          run(() => f.store._typeify({type: 'apiKey', id: 'Key-ID', accountId,
            name: 'created', state: 'active', publicValue: 'PUBLIC-TEST', secretValue: null, nested}));
          let imports = 0;
          const createRecord = f.store.createRecord;
          f.store.createRecord = (...args) => { imports++; return createRecord(...args); };
          const body = {type: 'apiKey', id: 'Key-ID', accountId, name: 'created',
            state: 'registering', publicValue: 'PUBLIC-TEST', secretValue: 'SECRET-TEST',
            nested: {...initial('service', 'Nested-ID'), state: 'creating'}};
          const xhr = {status: 201, body};
          run(() => f.response.resolve(xhr));
          await saving;
          const canonical = f.store.getById('apiKey', 'Key-ID');
          const clone = subject.get('clone');
          assert.strictEqual(canonical, draft, 'canonical save identity is retained');
          assert.strictEqual(canonical.get('state'), 'active', 'newer cached state wins');
          assert.strictEqual(nested.get('state'), 'active', 'stale nested 201 is not imported');
          assert.strictEqual(clone.get('secretValue'), 'SECRET-TEST', 'actual API-key doneSaving receives one-time secret');
          assert.strictEqual(clone.get('publicValue'), 'PUBLIC-TEST');
          assert.strictEqual(canonical.get('secretValue'), null, 'canonical store never needs to retain secret');
          assert.notOk(JSON.stringify(canonical.serialize()).includes('SECRET-TEST'));
          assert.notOk(Object.hasOwn(f.requests[0].data, 'createIdentity'));
          assert.notOk(Object.keys(f.requests[0]).includes('createIdentity'), 'create marker is nonenumerable');
          assert.notOk(JSON.stringify(f.requests[0]).includes('SECRET-TEST'), 'request metadata contains no secret');
          assert.deepEqual(completion, [true]);
          assert.strictEqual(subject._createOnlyDelivery, null);
          assert.strictEqual(subject._createOnlyRequest, null);
          assert.strictEqual(subject._saveOwner, null);
          assert.strictEqual(subject.get('saving'), false);
          assert.notOk(xhr.body, 'raw 201 body is not retained');
          run(() => f.store._typeify({type: 'apiKey', id: 'Key-ID', accountId,
            name: 'created', state: 'active', publicValue: 'PUBLIC-TEST', secretValue: null}));
          assert.strictEqual(canonical.get('secretValue'), null);
          assert.strictEqual(clone.get('secretValue'), 'SECRET-TEST', 'later WS cannot erase detached visible delivery');
          assert.strictEqual(f.requests.length, 1, 'no replay or extra request');
        } finally {
          if ( subject ) { destroyOwned(subject); }
          f.destroy();
        }
      }
    }
  });

  test('uncached API-key create-only delivery is one-shot and schema-bound, with private request metadata', async function(assert) {
    const f = fixture();
    try {
      let data, calls = 0;
      const options = {};
      bindCreateOnlyDelivery(options, value => { data = value; calls++; });
      const draft = f.store.createRecord({type: 'apiKey', name: 'created'});
      const saving = run(() => draft.save(options));
      run(() => f.response.resolve({status: 201, body: {type: 'apiKey', id: 'Key-ID',
        state: 'requested', name: 'created', secretValue: 'SECRET-TEST', publicValue: 'PUBLIC-TEST'}}));
      assert.strictEqual(await saving, draft);
      assert.strictEqual(calls, 1);
      assert.deepEqual(data.fields, {secretValue: 'SECRET-TEST'}, 'only exact readOnCreateOnly=true fields are delivered');
      assert.strictEqual(draft.get('secretValue'), null);
      const clone = cloneCreateOnlyDelivery(draft, data);
      assert.strictEqual(clone.get('secretValue'), 'SECRET-TEST');
      assert.strictEqual(data.fields, null, 'delivery is consumed');
      assert.throws(() => cloneCreateOnlyDelivery(draft, data), /no longer belongs/);
      assert.strictEqual(takeCreateOnlyDelivery(options), null);
    } finally { f.destroy(); }
  });

  test('create-only delivery rejects changed store, generation, base, concrete type and owner without importing its secret', async function(assert) {
    for ( const change of ['generation', 'base', 'type', 'owner'] ) {
      const f = fixture();
      try {
        let calls = 0;
        const options = {};
        bindCreateOnlyDelivery(options, () => calls++);
        const draft = f.store.createRecord({type: 'apiKey', accountId: '1a-test'});
        const saving = run(() => draft.save(options));
        if ( change === 'generation' ) { run(() => f.store.reset()); }
        if ( change === 'base' ) { f.store.set('baseUrl', '/v2-beta/projects/other'); }
        if ( change === 'owner' ) { run(() => f.store._typeify({type: 'apiKey', id: 'Key-ID', accountId: '1a-other', state: 'active', secretValue: null})); }
        run(() => f.response.resolve({status: 201, body: {type: change === 'type' ? 'volume' : 'apiKey', id: 'Key-ID', accountId: '1a-test', secretValue: 'SECRET-TEST'}}));
        await saving;
        assert.strictEqual(calls, 0, `${change} cannot receive first delivery`);
        assert.notStrictEqual(draft.get('secretValue'), 'SECRET-TEST');
      } finally { f.destroy(); }
    }
    const f = fixture(), other = fixture();
    try {
      const resource = other.store._typeify({type: 'apiKey', id: 'Key-ID'});
      assert.throws(() => cloneCreateOnlyDelivery(resource, {id: 'Key-ID', type: 'apikey',
        store: f.store, generation: f.store.generation, baseUrl: f.store.baseUrl, fields: {secretValue: 'SECRET-TEST'}}), /no longer belongs/);
    } finally { f.destroy(); other.destroy(); }
  });

  test('a synchronous first-delivery callback exception is consumed once and cannot replay create', async function(assert) {
    const f = fixture();
    try {
      let calls = 0, delivered;
      const options = {};
      bindCreateOnlyDelivery(options, value => { delivered = value; calls++; throw new Error('delivery callback failed'); });
      const draft = f.store.createRecord({type: 'apiKey'});
      const saving = run(() => draft.save(options));
      run(() => f.response.resolve({status: 201, body: {type: 'apiKey', id: 'Key-ID', secretValue: 'SECRET-TEST'}}));
      try { await saving; assert.ok(false); } catch (error) { assert.ok(error); }
      assert.strictEqual(calls, 1);
      assert.strictEqual(delivered.fields, null, 'synchronous callback failure clears one-time values');
      assert.strictEqual(takeCreateOnlyDelivery(options), null);
      assert.strictEqual(f.requests.length, 1);
      assert.strictEqual(f.store.getById('apiKey', 'Key-ID').get('secretValue'), null);
    } finally { f.destroy(); }
  });
  test('delayed 201 cannot overwrite the newer subscribe model, repeated with deterministic barriers 100 times', async function(assert) {
    for ( let index = 0; index < 100; index++ ) {
      const f = fixture();
      try {
        const draft = f.store.createRecord({type: 'volume', name: 'created'});
        const saving = run(() => draft.save());
        assert.strictEqual(f.requests.length, 1, 'one create dispatch, no extra GET');
        const live = run(() => f.store._typeify(current()));
        const xhr = {status: 201, body: initial()};
        run(() => f.response.resolve(xhr));
        const saved = await saving;
        assert.strictEqual(saved, draft, 'existing save completion identity retained');
        assert.strictEqual(saved.get('state'), 'inactive');
        assert.strictEqual(saved.get('externalId'), 'created');
        assert.strictEqual(f.store.getById('volume', 'Opaque-ID'), draft);
        assert.strictEqual(f.store.all('volume').get('length'), 1, 'no duplicate canonical resource');
        assert.strictEqual(live.get('xhr'), xhr, 'actual HTTP metadata remains attached');
        assert.strictEqual(f.requests[0].responseStatus, 201);
        assert.notOk(Object.hasOwn(f.requests[0].data, 'createIdentity'), 'internal marker is not payload');
      } finally { f.destroy(); }
    }
  });

  test('uncached creates retain the original response import path', async function(assert) {
    const f = fixture();
    try {
      const draft = f.store.createRecord({type: 'volume', name: 'created'});
      const saving = run(() => draft.save());
      run(() => f.response.resolve({status: 201, body: initial()}));
      assert.strictEqual(await saving, draft);
      assert.strictEqual(draft.get('state'), 'registering');
      assert.strictEqual(f.store.getById('volume', 'Opaque-ID'), draft);
      assert.strictEqual(f.requests.length, 1);
    } finally { f.destroy(); }
  });

  test('subtype and base-type aliases adopt one saved model without regressing the subscribe fields', async function(assert) {
    const f = fixture();
    try {
      const draft = f.store.createRecord({type: 'loadBalancerService', baseType: 'service', name: 'created'});
      const saving = run(() => draft.save());
      run(() => f.store._typeify({...current('loadBalancerService'), baseType: 'service'}));
      run(() => f.response.resolve({status: 201, body: {...initial('loadBalancerService'), baseType: 'service'}}));
      assert.strictEqual(await saving, draft);
      assert.strictEqual(draft.get('state'), 'inactive');
      assert.strictEqual(f.store.getById('loadBalancerService', 'Opaque-ID'), draft);
      assert.strictEqual(f.store.getById('service', 'Opaque-ID'), draft);
      assert.strictEqual(f.store.all('loadBalancerService').get('length'), 1);
      assert.strictEqual(f.store.all('service').get('length'), 1);
    } finally { f.destroy(); }
  });

  test('cached create adoption does not run stale mangleIn or nested resource imports', function(assert) {
    const f = fixture();
    try {
      const schema = f.store.getById('schema', 'volume');
      schema.set('resourceFields', { nested: {type: 'service'} });
      schema.notifyPropertyChange('typeifyFields');
      const nested = run(() => f.store._typeify({...current('service', 'Nested-ID'), state: 'active'}));
      const live = run(() => f.store._typeify({...current(), nested}));
      let conversionCalls = 0;
      const createRecord = f.store.createRecord;
      f.store.createRecord = (...args) => { conversionCalls++; return createRecord(...args); };
      const options = {method: 'POST', createIdentity: {type: 'volume',
        generation: f.store.get('generation'), baseUrl: f.store.get('baseUrl')}};
      const response = f.store._requestSuccess({status: 201,
        body: {...initial(), nested: {...initial('service', 'Nested-ID'), state: 'creating'}}}, options);
      assert.strictEqual(response, live);
      assert.strictEqual(conversionCalls, 0, 'neither mangleIn nor nested typeify is invoked');
      assert.strictEqual(nested.get('state'), 'active');
      assert.strictEqual(live.get('nested'), nested);
    } finally { f.destroy(); }
  });

  test('opaque case-sensitive IDs and exact concrete types do not borrow another canonical model', function(assert) {
    const f = fixture();
    try {
      const other = f.store._typeify(current('volume', 'opaque-id'));
      const options = {method: 'POST', createIdentity: {type: 'volume',
        generation: f.store.get('generation'), baseUrl: f.store.get('baseUrl')}};
      const response = f.store._requestSuccess({status: 201, body: initial()}, options);
      assert.notStrictEqual(response, other);
      assert.strictEqual(response.get('id'), 'Opaque-ID');
      assert.strictEqual(response.get('state'), 'registering');
      const concrete = f.store._typeify({...current('loadBalancerService', 'Sub-ID'), baseType: 'service'});
      const base = f.store._requestSuccess({status: 201, body: initial('service', 'Sub-ID')},
        {...options, createIdentity: {...options.createIdentity, type: 'service'}});
      assert.strictEqual(base.get('type'), 'service', 'base alias goes through the normal import');
      assert.strictEqual(concrete.get('state'), 'registering', 'the new rule did not adopt the different concrete type');
    } finally { f.destroy(); }
  });

  test('another project store, reset generation and changed API base cannot use create adoption', function(assert) {
    const f = fixture();
    const other = fixture('1a-other');
    try {
      const foreign = other.store._typeify(current());
      const marker = {type: 'volume', generation: f.store.get('generation'), baseUrl: f.store.get('baseUrl')};
      const response = f.store._requestSuccess({status: 201, body: initial()}, {method: 'POST', createIdentity: marker});
      assert.notStrictEqual(response, foreign);
      assert.strictEqual(foreign.get('state'), 'inactive');
      run(() => f.store.reset());
      const afterReset = f.store._typeify(current());
      f.store._requestSuccess({status: 201, body: initial()}, {method: 'POST', createIdentity: marker});
      assert.strictEqual(afterReset.get('state'), 'registering', 'old generation does not opt into the new rule');
      const beforeBaseChange = {type: 'volume', generation: f.store.get('generation'), baseUrl: f.store.get('baseUrl')};
      f.store.set('baseUrl', '/v2-beta/projects/1a-changed');
      afterReset.set('state', 'inactive');
      f.store._requestSuccess({status: 201, body: initial()}, {method: 'POST', createIdentity: beforeBaseChange});
      assert.strictEqual(afterReset.get('state'), 'registering', 'different base preserves prior import behavior');
    } finally { f.destroy(); other.destroy(); }
  });

  test('GET, PUT, action POST and non-201 responses preserve normal imports', function(assert) {
    const f = fixture();
    try {
      for ( const [method, status, marked] of [['GET', 201, true], ['PUT', 201, true],
        ['POST', 200, true], ['POST', 201, false]] ) {
        const live = f.store._typeify(current());
        const options = {method};
        if ( marked ) { options.createIdentity = {type: 'volume',
          generation: f.store.get('generation'), baseUrl: f.store.get('baseUrl')}; }
        const response = f.store._requestSuccess({status, body: initial()}, options);
        assert.strictEqual(response, live);
        assert.strictEqual(response.get('state'), 'registering', `${method}/${status}/${marked} unchanged`);
      }
    } finally { f.destroy(); }
  });

  test('204 and errors keep their HTTP semantics without importing a model', async function(assert) {
    const f = fixture();
    try {
      const options = {method: 'POST', createIdentity: {type: 'volume',
        generation: f.store.get('generation'), baseUrl: f.store.get('baseUrl')}};
      const live = f.store._typeify(current());
      assert.strictEqual(f.store._requestSuccess({status: 204}, options), undefined);
      assert.strictEqual(options.responseStatus, 204);
      assert.strictEqual(live.get('state'), 'inactive');
      f.store.rawRequest = () => Promise.reject({status: 403, body: {type: 'error', status: 403, message: 'Forbidden'}});
      try { await f.store.request({...options, url: 'volume'}); assert.ok(false); }
      catch (error) { assert.strictEqual(error.get('status'), 403); }
      assert.strictEqual(live.get('state'), 'inactive');
    } finally { f.destroy(); }
  });

  test('reusing save options cannot carry a create marker into an existing record save', async function(assert) {
    const f = fixture();
    try {
      const record = f.store._typeify({...current(), links: {self: `${f.store.baseUrl}/volumes/Opaque-ID`}});
      const options = {createIdentity: {type: 'volume', generation: f.store.get('generation'), baseUrl: f.store.baseUrl}};
      f.store.rawRequest = request => { f.requests.push(request); return resolve({status: 200, body: initial()}); };
      await run(() => record.save(options));
      assert.strictEqual(f.requests[0].method, 'PUT');
      assert.notOk(Object.hasOwn(f.requests[0], 'createIdentity'));
      assert.strictEqual(record.get('state'), 'registering');
    } finally { f.destroy(); }
  });

  test('action POST cannot reuse an old create marker even when the action returns 201', async function(assert) {
    const f = fixture();
    try {
      const record = f.store._typeify({...current(), actionLinks: {reconcile: '/actions/reconcile'}});
      const options = {createIdentity: {type: 'volume', generation: f.store.get('generation'), baseUrl: f.store.baseUrl}};
      f.store.rawRequest = request => { f.requests.push(request); return resolve({status: 201, body: initial()}); };
      assert.strictEqual(await run(() => record.doAction('reconcile', null, options)), record);
      assert.strictEqual(f.requests[0].method, 'POST');
      assert.notOk(Object.hasOwn(f.requests[0], 'createIdentity'));
      assert.strictEqual(record.get('state'), 'registering', 'action response still imports normally');
    } finally { f.destroy(); }
  });
});
