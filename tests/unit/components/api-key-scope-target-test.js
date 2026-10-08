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
    findAll() { return resolve([item]); }, find() { return resolve(item); }});
  let userStore = EmberObject.create({generation: 1, getById() { return EmberObject.create({}); },
    rawRequest(options) { queries.push(options.url); return resolve({body: {data: []}}); }});
  let component = createOwned(Target, Object.assign({renderer: inertRenderer(), scope: {kind: 'stack', resourceId: '1st4'}, store, userStore,
    projects: EmberObject.create({current: EmberObject.create({id: '1a9'}), schemaProjectId: '1a9', schemaLoadGeneration: 1}),
    session: EmberObject.create({accountId: '1a1'}), access: EmberObject.create({identity: EmberObject.create({id: 'viewer1'})}),
    onCapabilities(value) { published.push(value); }, onSelect() {}}, extra), 'component');
  return {component, queries, published, store, item};
}

test('fresh target metadata uses its own project schema without changing the shared store', async function(assert) {
  let {component, queries, published} = target();
  component.loadContext(); await drain();
  assert.deepEqual(queries, ['projects/1a9/schema']);
  assert.strictEqual(published.at(-1).resource.id, '1st4');
  assert.ok(published.at(-1).contextVerified);
  assert.strictEqual(component.get('projects.current.id'), '1a9');
  destroyOwned(component);
});

test('project plus schema generation and viewer changes clear and reload stale metadata', async function(assert) {
  let {component, published} = target();
  component.loadContext(); await drain();
  let before = component._loadGeneration;
  component.set('projects.schemaLoadGeneration', 2);
  assert.notOk(published.at(-1).contextVerified, 'old operation evidence is cleared synchronously');
  await drain();
  assert.ok(component._loadGeneration > before);
  component.set('access.identity.id', 'viewer2');
  assert.notOk(published.at(-1).complete, 'old viewer metadata cannot remain usable');
  await drain(); destroyOwned(component);
});

test('late collection results from a previous project cannot repopulate candidates', async function(assert) {
  let first = defer(); let calls = 0;
  let {component, store} = target();
  store.findAll = () => ++calls === 1 ? first.promise : resolve([]);
  component.loadContext();
  component.set('projects.current.id', '1aOther');
  await drain();
  first.resolve([EmberObject.create({id: 'old', name: 'stale'})]); await drain();
  assert.deepEqual(component.get('candidates'), []);
  destroyOwned(component);
});

test('mixed-case schema IDs are normalized and unavailable loads stay unknown', async function(assert) {
  let seen = [];
  let {component, store, published} = target({scope: {kind: 'resource', resourceType: 'networkPolicy', resourceId: '1np1'}});
  store.getById = (type, id) => { seen.push(id); return null; };
  component.get('userStore').getById = (type, id) => { seen.push(id); return null; };
  component.loadContext(); await drain();
  assert.ok(seen.every((id) => id === 'networkpolicy'));
  assert.ok(component.get('loadError'));
  assert.notOk(published.at(-1).contextVerified);
  destroyOwned(component);
});
