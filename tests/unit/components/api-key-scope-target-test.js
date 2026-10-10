import EmberObject from '@ember/object';
import { defer, resolve } from 'rsvp';
import { module, test } from 'qunit';
import Target from 'ui/components/api-key-scope-target/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | API key scope target');
const drain = () => new Promise((done) => setTimeout(done, 0));
function target(extra = {}) {
  let queries = [], published = [];
  let item = EmberObject.create({id: '1st4', type: 'stack', name: 'test', accountId: '1a9', actionLinks: {}, links: {self: '/self'}});
  let store = EmberObject.create({generation: 1, getById(type, id) { return id === 'stack' ? EmberObject.create({id}) : null; },
    find() { throw new Error('CurrentProjectStoreMustNotRecoverParent'); }});
  let userStore = EmberObject.create({generation: 1, getById() { return EmberObject.create({}); },
    find(type, id, options) {
      if ( type !== 'project' || id !== null || options.forceReload !== true ) { throw new Error('FreshProjectCollectionRequired'); }
      return resolve([{id: '1a9', name: 'Visible environment'}]);
    },
    rawRequest(options) {
      queries.push(options.url);
      return resolve({body: options.url === '/self' ? item : {data: options.url === 'schema' ? [] : options.url.endsWith('/schema') ?
        [{id: 'stack', collectionMethods: ['GET'], links: {collection: '/stacks'}}] : [item]}});
    }});
  let component = createOwned(Target, Object.assign({renderer: inertRenderer(), scope: {kind: 'stack', resourceId: '1st4'}, store, userStore,
    projects: EmberObject.create({current: EmberObject.create({id: '1a9'}), schemaProjectId: '1a9', schemaLoadGeneration: 1}),
    session: EmberObject.create({accountId: '1a1'}), access: EmberObject.create({identity: EmberObject.create({id: 'viewer1'})}),
    intl: EmberObject.create({t(value) { return value; }}),
    onCapabilities(value) { published.push(value); }, onSelect() {}}, extra), 'component');
  return {component, queries, published, store, userStore, item};
}

test('fresh target metadata uses its own project schema without changing the shared store', async function(assert) {
  let {component, queries, published} = target();
  component.loadContext(); await drain();
  assert.deepEqual(queries, ['schema', 'projects/1a9/schema', '/stacks', '/self']);
  assert.strictEqual(published.at(-1).resource.id, '1st4');
  assert.ok(published.at(-1).contextVerified);
  assert.ok(published.at(-1).selectionValid);
  assert.ok(published.at(-1).selectionLabel.includes('Visible environment / test'));
  assert.notOk(published.at(-1).selectionLabel.includes('1st4'));
  assert.strictEqual(component.get('projects.current.id'), '1a9');
  destroyOwned(component);
});

test('project plus schema generation and viewer changes clear and reload stale metadata', async function(assert) {
  let {component, published} = target();
  component.loadContext(); await drain();
  let before = component._loadGeneration;
  component.set('projects.schemaLoadGeneration', 2);
  assert.notOk(component._pendingEvidence.evidence.contextVerified, 'invalid evidence replaces the pending prior context immediately');
  await drain();
  assert.ok(component._loadGeneration > before);
  component.set('access.identity.id', 'viewer2');
  assert.notOk(component._pendingEvidence.evidence.complete, 'pending old viewer metadata is discarded before notification');
  await drain(); destroyOwned(component);
});

test('same-scope explicit policy reload revalidates names once without an attribute request loop', async function(assert) {
  let {component, queries, published, item} = target({reloadGeneration: 1});
  await component.loadContext(); await drain();
  let before = queries.length;
  item.set('name', 'Refreshed stack');
  component.set('reloadGeneration', 2);
  assert.notOk(component._pendingEvidence.evidence.contextVerified, 'reload invalidates the prior target immediately');
  await drain();
  assert.deepEqual(queries.slice(before), ['projects/1a9/schema', '/stacks', '/self'], 'same target gets fresh schema, collection and object');
  assert.ok(published.at(-1).selectionLabel.includes('Refreshed stack'), 'fresh human name is republished');
  assert.ok(published.at(-1).selectionValid);
  let refreshed = queries.length;
  component.didReceiveAttrs(); await component.loadContext(); await drain();
  assert.strictEqual(queries.length, refreshed, 'unchanged reload generation does not start another request');
  destroyOwned(component);
});

test('same-scope reload and owner change reject old requests without ending the latest loading', async function(assert) {
  let firstStarted = defer(), latestStarted = defer(), oldRead = defer(), latestRead = defer(), calls = 0;
  let {component, userStore, published, item} = target({reloadGeneration: 1});
  let read = userStore.rawRequest.bind(userStore);
  userStore.rawRequest = (options) => {
    if ( options.url !== '/self' ) { return read(options); }
    if ( ++calls === 1 ) { firstStarted.resolve(); return oldRead.promise; }
    latestStarted.resolve(); return latestRead.promise;
  };
  let first = component.loadContext();
  await firstStarted.promise;
  let oldItem = item.getProperties('id', 'type', 'name', 'accountId', 'actionLinks', 'links');
  component.set('reloadGeneration', 2);
  component.set('session.accountId', '1a2');
  item.set('name', 'Latest owner stack');
  await latestStarted.promise;
  oldRead.resolve({body: oldItem}); await first; await drain();
  assert.ok(component.get('loading'), 'old finalizer cannot end the latest generation loading');
  assert.strictEqual(component.get('selectedTarget'), null, 'old result cannot restore a selected target');
  assert.notOk(published.some((value) => value.selectionValid), 'prior owner never publishes a valid selection');
  latestRead.resolve({body: item}); await drain();
  assert.notOk(component.get('loading'));
  assert.ok(published.at(-1).selectionLabel.includes('Latest owner stack'));
  assert.ok(published.at(-1).contextVerified);
  destroyOwned(component);
});

test('afterRender coalesces the newest scope and a late previous context cannot publish', async function(assert) {
  let first = defer();
  let {component, userStore, published} = target();
  userStore.find = () => first.promise;
  component.loadContext();
  component.set('scope', {kind: 'global'});
  component.didReceiveAttrs();
  assert.strictEqual(published.length, 0, 'render lifecycle never synchronously mutates the parent');
  await drain();
  assert.strictEqual(published.length, 1, 'only the latest pending scope is delivered');
  assert.strictEqual(published[0].scopeKey, 'global::');
  assert.notOk(published[0].contextVerified, 'global remains unknown');
  first.resolve([EmberObject.create({id: 'stale', name: 'old'})]); await drain();
  assert.strictEqual(published.length, 1, 'stale collection completion cannot publish to the new context');
  destroyOwned(component);
});

test('destroy cancels queued evidence and late callbacks cannot reach the parent', async function(assert) {
  let pending = defer();
  let {component, userStore, published} = target();
  userStore.find = () => pending.promise;
  component.loadContext();
  component.willDestroyElement();
  destroyOwned(component);
  pending.resolve([]); await drain();
  assert.deepEqual(published, [], 'no callback survives component destruction');
});

test('late collection results from a previous project cannot repopulate candidates', async function(assert) {
  let first = defer(); let calls = 0;
  let {component, userStore} = target();
  userStore.find = () => ++calls === 1 ? first.promise : resolve([]);
  component.loadContext();
  component.set('projects.current.id', '1aOther');
  await drain();
  first.resolve([EmberObject.create({id: 'old', name: 'stale'})]); await drain();
  assert.deepEqual(component.get('candidates'), []);
  destroyOwned(component);
});

test('an unselected resource type has a human prompt and disabled selector, not permanent loading', async function(assert) {
  let {component, queries, published} = target({scope: {kind: 'resource'}});
  component.loadContext(); await drain();
  assert.notOk(component.get('loading'));
  assert.ok(component.get('targetDisabled'));
  assert.strictEqual(component.get('selectionStatus'), 'chooseType');
  assert.notOk(published.at(-1).selectionValid);
  assert.deepEqual(queries, []);
  destroyOwned(component);
});

test('changing an environment clears stable target and stack before any late completion', async function(assert) {
  let selected = [];
  let {component, userStore} = target({onSelect(event) { selected.push(event.target.value); }});
  userStore.find = () => resolve([{id: '1a9', name: 'Visible environment'}, {id: '1aOther', name: 'Other environment'}]);
  component.loadContext(); await drain();
  component.send('selectProject', component.get('projectOptions')[1]);
  assert.strictEqual(component.get('scope.resourceId'), '');
  assert.strictEqual(component.get('selectedTarget'), null);
  assert.strictEqual(component.get('selectedStack'), null);
  assert.deepEqual(selected, ['']);
  await drain();
  assert.deepEqual(component.get('candidates'), [], 'a row belonging to another environment cannot be offered');
  assert.strictEqual(component.get('projects.current.id'), '1a9', 'shared environment never rebases');
  destroyOwned(component);
});

test('service uses an actual stack name path; switching stack clears the service', async function(assert) {
  let {component, item, userStore, published} = target({scope: {kind: 'resource', resourceType: 'service', resourceId: 'svc'}});
  item.setProperties({id: 'svc', name: 'Web', type: 'service', stackId: 'st'});
  let stacks = [{id: 'st', name: 'Application', accountId: '1a9'}, {id: 'stOther', name: 'Batch', accountId: '1a9'}];
  userStore.rawRequest = (options) => resolve({body: options.url === 'schema' ? {data: []} : options.url.endsWith('/schema') ? {data: [
    {id: 'service', collectionMethods: ['GET'], links: {collection: '/services'}},
    {id: 'stack', collectionMethods: ['GET'], links: {collection: '/stacks'}},
  ]} : options.url === '/services' ? {data: [item]} : options.url === '/stacks' ? {data: stacks} : item});
  component.loadContext(); await drain();
  assert.ok(published.at(-1).selectionLabel.includes('Application'));
  assert.ok(published.at(-1).selectionLabel.includes('Web'));
  component.send('selectStack', component.get('stackOptions')[1]);
  assert.strictEqual(component.get('scope.resourceId'), '');
  assert.strictEqual(component.get('selectedTarget'), null);
  await drain();
  assert.deepEqual(component.get('candidates'), []);
  destroyOwned(component);
});

test('platform and project scopes select names without inventing stack parents', async function(assert) {
  let {component, userStore, published} = target({scope: {kind: 'project', resourceId: '1a9'}});
  userStore.find = () => resolve([{id: '1a9', type: 'project', name: 'Visible environment', links: {self: '/project'}}]);
  userStore.rawRequest = (options) => resolve({body: options.url === '/project' ?
    {id: '1a9', type: 'project', name: 'Visible environment', links: {self: '/project'}} : {data: []}});
  component.loadContext(); await drain();
  assert.notOk(component.get('needsProject'));
  assert.notOk(component.get('needsStack'));
  assert.ok(published.at(-1).selectionValid);
  component.set('scope', {kind: 'resource', resourceType: 'setting', resourceId: 'setting1'});
  userStore.rawRequest = (options) => resolve({body: options.url === 'schema' ? {data: [
    {id: 'setting', collectionMethods: ['GET'], links: {collection: '/settings'}},
  ]} : options.url === '/settings' ? {data: [{id: 'setting1', type: 'setting', name: 'Public endpoint', links: {self: '/setting'}}]} :
    {id: 'setting1', type: 'setting', name: 'Public endpoint', links: {self: '/setting'}}});
  component.loadContext(); await drain();
  assert.ok(published.at(-1).selectionValid);
  assert.ok(component.get('selectedTarget.label').includes('Public endpoint'));
  assert.notOk(component.get('needsProject'));
  destroyOwned(component);
});

test('container without a unique visible service parent uses explicit environment context, not a guessed stack', async function(assert) {
  let {component, item, userStore, published} = target({scope: {kind: 'resource', resourceType: 'container', resourceId: 'worker'}});
  item.setProperties({id: 'worker', name: 'Worker', type: 'instance', serviceIds: ['svcA', 'svcB']});
  let records = {container: [item], stack: [{id: 'stA', name: 'Web', accountId: '1a9'}, {id: 'stB', name: 'Batch', accountId: '1a9'}],
    service: [{id: 'svcA', name: 'Web service', stackId: 'stA', accountId: '1a9'}, {id: 'svcB', name: 'Batch service', stackId: 'stB', accountId: '1a9'}]};
  userStore.rawRequest = (options) => resolve({body: options.url === 'schema' ? {data: []} : options.url.endsWith('/schema') ? {data: Object.keys(records).map((id) =>
    ({id: id === 'container' ? 'instance' : id, collectionMethods: ['GET'], links: {collection: `/${id}`}}))} :
    options.url === '/self' ? item : {data: records[options.url.slice(1)]}});
  component.loadContext(); await drain();
  assert.strictEqual(component.get('selectedStack.id'), '__environment_resources__');
  assert.ok(published.at(-1).selectionValid);
  assert.ok(published.at(-1).selectionLabel.includes('environmentResources'));
  assert.notOk(published.at(-1).selectionLabel.includes('Web service'));
  assert.notOk(published.at(-1).selectionLabel.includes('worker'));
  destroyOwned(component);
});

test('non-stack environment resource follows complete advertised pages and keeps only its own environment', async function(assert) {
  let {component, item, userStore, queries, published} = target({scope: {kind: 'resource', resourceType: 'volume', resourceId: 'vol'}});
  item.setProperties({id: 'vol', name: 'Data disk', type: 'volume'});
  userStore.rawRequest = (options) => {
    queries.push(options.url);
    return resolve({body: options.url === 'schema' ? {data: []} : options.url.endsWith('/schema') ? {data: [{id: 'volume', collectionMethods: ['GET'], links: {collection: '/volumes'}}]} :
      options.url === '/volumes' ? {data: [{id: 'other', name: 'Other private disk', accountId: 'another'}], pagination: {next: '/volumes-next'}} :
      options.url === '/volumes-next' ? {data: [item]} : item});
  };
  component.loadContext(); await drain();
  assert.notOk(component.get('needsStack'));
  assert.deepEqual(component.get('candidates').map((option) => option.name), ['Data disk']);
  assert.ok(queries.includes('/volumes-next'));
  assert.ok(published.at(-1).selectionValid);
  destroyOwned(component);
});

test('a legal named service with no advertised parent collection offers explicit context, never a fabricated stack', async function(assert) {
  let {component, item, userStore, queries, published} = target({scope: {kind: 'resource', resourceType: 'service', resourceId: 'svc'}});
  item.setProperties({id: 'svc', name: 'Web', type: 'service', stackId: 'unavailable-parent'});
  userStore.rawRequest = (options) => {
    queries.push(options.url);
    return resolve({body: options.url === 'schema' ? {data: []} : options.url.endsWith('/schema') ? {data: [{id: 'service', collectionMethods: ['GET'], links: {collection: '/services'}}]} :
      options.url === '/services' ? {data: [item]} : item});
  };
  component.loadContext(); await drain();
  assert.ok(published.at(-1).selectionValid);
  assert.strictEqual(component.get('selectedStack.id'), '__environment_resources__');
  assert.notOk(published.at(-1).selectionLabel.includes('unavailable-parent'));
  assert.notOk(queries.some((url) => url.includes('stack')), 'no guessed stack URL is fetched');
  destroyOwned(component);
});

test('unavailable selected names clear evidence; forged options never select', async function(assert) {
  let events = [];
  let {component, userStore, published} = target({onSelect(event) { events.push(event.target.value); }});
  component.loadContext(); await drain();
  component.send('select', {id: 'forged', label: 'Guessed'});
  assert.deepEqual(events, []);
  userStore.find = () => resolve([]);
  component.set('access.identity.id', 'viewer-lost'); await drain();
  assert.strictEqual(component.get('selectedTarget'), null);
  assert.deepEqual(component.get('candidates'), []);
  assert.strictEqual(published.at(-1).selectionStatus, 'unavailable');
  assert.notOk(published.at(-1).selectionValid);
  destroyOwned(component);
});

test('mixed-case advertised schema without GET remains unavailable without a guessed URL', async function(assert) {
  let {component, userStore, queries, published} = target({scope: {kind: 'resource', resourceType: 'networkPolicy', resourceId: '1np1'}});
  userStore.rawRequest = (options) => {
    queries.push(options.url);
    return resolve({body: {data: [{id: 'networkPolicy', collectionMethods: ['POST'], links: {collection: '/never-GET'}}]}});
  };
  component.loadContext(); await drain();
  assert.notOk(queries.includes('/never-GET'));
  assert.strictEqual(published.at(-1).selectionStatus, 'unavailable');
  assert.notOk(published.at(-1).contextVerified);
  destroyOwned(component);
});

test('fresh project GET result never exposes old all-store members after viewer change', async function(assert) {
  let calls = 0;
  let {component, userStore, published} = target({scope: {kind: 'resource', resourceType: 'stack', resourceId: ''}});
  userStore.findAll = userStore.all = () => { throw new Error('WholeStoreCacheForbidden'); };
  userStore.find = (type, id, options) => {
    assert.strictEqual(type, 'project'); assert.strictEqual(id, null);
    assert.deepEqual(options, {forceReload: true, depaginate: true});
    return resolve(++calls === 1 ? [{id: '1a9', name: 'Fresh environment'}] : []);
  };
  component.loadContext(); await drain();
  assert.deepEqual(component.get('projectOptions').map((option) => option.label), ['Fresh environment']);
  component.set('access.identity.id', 'after-withdrawal'); await drain();
  assert.strictEqual(calls, 2);
  assert.deepEqual(component.get('projectOptions'), []);
  assert.notOk(published.at(-1).selectionValid);
  destroyOwned(component);
});

test('saved non-current Stack Service and instance-alias Container recover advertised visible parents only', async function(assert) {
  for ( let type of ['stack', 'service', 'container'] ) {
    let id = type === 'stack' ? '1stOther' : type === 'service' ? '1sOther' : '1iOther';
    let record = {id, type: type === 'container' ? 'instance' : type, name: 'Readable target', description: 'Blue',
      accountId: '1aOther', links: {self: '/advertised-self'}};
    if ( type === 'service' ) { record.stackId = '1stParent'; }
    if ( type === 'container' ) { record.serviceIds = ['1sParent']; }
    let stack = {id: '1stParent', name: 'Application', accountId: '1aOther'};
    let service = {id: '1sParent', name: 'Web service', accountId: '1aOther', stackId: stack.id};
    let schema = {id: record.type, collectionMethods: ['GET'], links: {collection: '/advertised-targets'}};
    let {component, userStore, store, queries, published} = target({scope: {kind: 'resource', resourceType: type, resourceId: id}});
    store.set('baseUrl', '/v2-beta/projects/1a9');
    userStore.find = () => resolve([{id: '1a9', name: 'Current environment'}, {id: '1aOther', name: 'Other environment'}]);
    userStore.rawRequest = (options) => {
      queries.push(options.url);
      let body;
      if ( options.url === 'schema' ) { body = {data: type === 'stack' ? [] : [schema]}; }
      else if ( options.url === 'projects/1a9/schema' ) { body = {data: []}; }
      else if ( options.url === 'projects/1aOther/schema' ) { body = {data: [schema,
        ...(type === 'stack' ? [] : [{id: 'stack', collectionMethods: ['GET'], links: {collection: '/advertised-parents'}}]),
        ...(type === 'container' ? [{id: 'service', collectionMethods: ['GET'], links: {collection: '/advertised-services'}}] : [])]}; }
      else if ( options.url === '/advertised-targets' ) { body = {data: [record]}; }
      else if ( options.url === '/advertised-parents' ) { body = {data: [stack]}; }
      else if ( options.url === '/advertised-services' ) { body = {data: [service]}; }
      else if ( options.url === '/advertised-self' ) { body = record; }
      else { throw new Error('UnadvertisedRead'); }
      return resolve({body});
    };
    component.loadContext(); await drain();
    assert.ok(published.at(-1).selectionValid, type);
    assert.strictEqual(component.get('selectedProject.id'), '1aOther', type);
    assert.strictEqual(component.get('scope.resourceId'), id, 'stable DTO is retained');
    assert.ok(component.get('selectedTarget.label').includes('Other environment'));
    assert.notOk(component.get('selectedTarget.label').includes(id));
    if ( type !== 'stack' ) { assert.strictEqual(component.get('selectedStack.id'), stack.id); }
    assert.strictEqual(component.get('projects.current.id'), '1a9');
    assert.strictEqual(store.get('baseUrl'), '/v2-beta/projects/1a9');
    assert.notOk(queries.some((url) => url.includes('/schemas/container')), 'container resolves advertised instance alias');
    destroyOwned(component);
  }
});

test('fresh detail description change invalidates the old same-name label', async function(assert) {
  let {component, item, userStore, published} = target();
  item.set('description', 'Blue');
  let raw = userStore.rawRequest;
  userStore.rawRequest = (options) => options.url === '/self' ? resolve({body: {
    id: '1st4', type: 'stack', name: 'test', description: 'Green', accountId: '1a9', links: {self: '/self'},
  }}) : raw(options);
  component.loadContext(); await drain();
  assert.strictEqual(component.get('selectedTarget'), null);
  assert.strictEqual(component.get('scope.resourceId'), '1st4');
  assert.strictEqual(published.at(-1).selectionStatus, 'unavailable');
  assert.notOk(published.at(-1).selectionValid);
  assert.notOk(published.at(-1).complete);
  destroyOwned(component);
});

test('foreign saved reference is not restored from account collection or guessed current store', async function(assert) {
  let {component, userStore, published} = target();
  userStore.rawRequest = () => resolve({body: {data: [{id: 'stack', collectionMethods: ['GET'], links: {collection: '/foreign'}}]}});
  let raw = userStore.rawRequest;
  userStore.rawRequest = (options) => options.url === '/foreign' ? resolve({body: {data: [
    {id: '1st4', name: 'Private environment target', accountId: 'foreign'},
  ]}}) : raw(options);
  component.loadContext(); await drain();
  assert.strictEqual(component.get('selectedProject'), null);
  assert.deepEqual(component.get('candidates'), []);
  assert.strictEqual(published.at(-1).selectionStatus, 'unavailable');
  assert.strictEqual(component.get('scope.resourceId'), '1st4');
  destroyOwned(component);
});

test('recovered collection reference still requires the advertised self account to match', async function(assert) {
  let {component, userStore, published} = target();
  let raw = userStore.rawRequest;
  userStore.rawRequest = (options) => options.url === '/self' ? resolve({body: {
    id: '1st4', type: 'stack', name: 'test', accountId: 'foreign', links: {self: '/self'},
  }}) : raw(options);
  component.loadContext(); await drain();
  assert.strictEqual(component.get('selectedTarget'), null);
  assert.strictEqual(component.get('scope.resourceId'), '1st4');
  assert.strictEqual(published.at(-1).selectionStatus, 'unavailable');
  assert.notOk(published.at(-1).contextVerified);
  destroyOwned(component);
});

test('late account parent recovery cannot restore a withdrawn environment', async function(assert) {
  let pending = defer();
  let {component, item, userStore, published} = target();
  let raw = userStore.rawRequest;
  userStore.rawRequest = (options) => options.url === 'schema' ? resolve({body: {data: [
    {id: 'stack', collectionMethods: ['GET'], links: {collection: '/delayed-account-targets'}},
  ]}}) : options.url === '/delayed-account-targets' ? pending.promise : raw(options);
  component.loadContext(); await drain();
  userStore.find = () => resolve([]);
  component.set('access.identity.id', 'withdrawn'); await drain();
  pending.resolve({body: {data: [item]}}); await drain();
  assert.strictEqual(component.get('selectedProject'), null);
  assert.strictEqual(component.get('selectedTarget'), null);
  assert.deepEqual(component.get('candidates'), []);
  assert.notOk(published.at(-1).selectionValid);
  destroyOwned(component);
});
