import Application, { getOwner } from '@ember/application';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { A } from '@ember/array';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import AiEnvironmentActions from 'ui/services/ai-environment-actions';
import PrefsService from 'ui/services/prefs';
import ProjectsService from 'ui/services/projects';
import { CommandContext } from 'ui/utils/ai-command-context';
import C from 'ui/utils/constants';

// This repository uses QUnit's compiled AMD registry, without ember-qunit.
// Use the same real Application/buildInstance owner scaffold as owned-subject.
const TestResolver = EmberObject.extend({normalize(name) { return name; }, resolve() { return undefined; }});
function deferred() {
  let done;
  return {promise: new Promise((resolvePromise) => { done = resolvePromise; }), resolve() { done(); }};
}

module('Unit | Service | AI environment actions actual owner', function(hooks) {
  hooks.beforeEach(function() {
    const state = this.state = {generation: 'generation-one', cookie: 'token-one', writes: 0, preference: null, actorRequests: []};
    const current = EmberObject.create({id: '1a5', uuid: 'adminProject', kind: 'project', state: 'active', name: 'Default'});
    const target = EmberObject.create({id: '1a9', uuid: 'selected-project', kind: 'project', state: 'active', name: 'Selected'});
    const app = this.application = Application.create({autoboot: false, Resolver: TestResolver});
    app.register('-environment:main', {isInteractive: false}, {instantiate: false});
    app.register('service:ai-environment-actions', AiEnvironmentActions);
    app.register('service:prefs', PrefsService);
    app.register('service:projects', ProjectsService);
    // ProjectsService validates each declared injection when the real owner
    // instantiates it, including orchestration services unused by this project.
    app.register('service:access', Service.extend({enabled: true, admin: false}));
    app.register('service:tab-session', Service.extend());
    app.register('service:k8s', Service.extend());
    app.register('service:swarm', Service.extend());
    app.register('service:mesos', Service.extend());
    app.register('service:store', Service.extend());
    app.register('service:auth-session', Service.extend({
      accountId: '1a1', tokenSnapshot: 'token-one',
      capture() { return state.generation; },
      readShared() { return {generation: state.generation, accountId: this.get('accountId')}; },
      runPassiveSynchronous(callback) { const value = callback(); return resolve(value); },
    }));
    app.register('service:cookies', Service.extend({
      get(key) { return key === C.COOKIE.TOKEN ? state.cookie : this._super(key); },
    }));
    app.register('service:intl', Service.extend({t(key) { return key; }}));
    app.register('service:ai-command-context', Service.extend({
      init() {
        this._super(...arguments);
        this.context = new CommandContext(() => ({generation: state.generation, accountId: '1a1',
          projectId: '1a5', projectName: 'Default', schemaProjectId: '1a5', schemaGeneration: 1, route: '/env/default'}));
        this.context.setMode('enabled');
      },
    }));
    function preference(values) {
      return EmberObject.create(Object.assign({}, values, {
        async save(options) {
          state.actorRequests.push(options);
          state.writes++;
          if (state.saveStarted) { state.saveStarted.resolve(); }
          if (state.saveGate) { await state.saveGate.promise; }
          this.setProperties({id: '1up-owned', accountId: '1a1'});
          state.preference = this;
          return this;
        },
      }));
    }
    app.register('service:user-store', Service.extend({
      all() { return A(state.preference ? [state.preference] : []); },
      async find(type, id, options) {
        if (type === 'project') {
          if (id === current.id) { return current; }
          if (id === target.id) { return target; }
          throw {status: 404};
        }
        if (type !== 'userpreference') { throw new Error('Unexpected native read'); }
        state.actorRequests.push(options);
        return A(state.preference ? [state.preference] : []);
      },
      createRecord(values) { return preference(values); },
    }));
    this.owner = app.buildInstance();
    this.owner.lookup('service:projects').setProperties({current, schemaProjectId: current.id, schemaLoadGeneration: 1});
    this.actions = this.owner.lookup('service:ai-environment-actions');
    this.captured = this.owner.lookup('service:ai-command-context').context.capture();
  });

  hooks.afterEach(function() {
    run(() => { this.owner.destroy(); this.application.destroy(); });
  });

  test('real owner injects actual preferences and settles an owned default readback', async function(assert) {
    assert.strictEqual(getOwner(this.actions), this.owner, 'the target is instantiated by an actual Ember owner');
    assert.strictEqual(this.actions.get('prefs'), this.owner.lookup('service:prefs'), 'the actual PrefsService is injected');
    assert.strictEqual(this.actions.get('projects'), this.owner.lookup('service:projects'), 'the actual ProjectsService is injected');
    const binding = await this.actions.preview({id: '1a9', operation: 'set_default'}, this.captured);
    const result = await this.actions.confirm(binding, this.captured, () => true);
    assert.strictEqual(result.effectScope, 'account-preference');
    assert.true(result.readbackComplete);
    assert.notStrictEqual(result.verifiedResult, true, 'a preference result is not native workload proof');
    assert.strictEqual(this.state.writes, 1);
    assert.strictEqual(JSON.parse(this.state.preference.get('value')), '1a9');
    assert.true(this.state.actorRequests.every(options => options && options.credentials === 'omit' && options.headers && options.headers.Authorization === 'Bearer token-one'), 'every native preference request pins the original actor without ambient Cookie');
    assert.strictEqual(new Set(this.state.actorRequests).size, this.state.actorRequests.length, 'each request receives fresh options');
    assert.strictEqual(new Set(this.state.actorRequests.map(options => options && options.headers)).size, this.state.actorRequests.length, 'headers are not shared between requests');
  });

  test('same generation token adoption rejects the original owner-created preview before save', async function(assert) {
    const binding = await this.actions.preview({id: '1a9', operation: 'set_default'}, this.captured);
    this.state.cookie = 'token-two';
    this.owner.lookup('service:auth-session').set('tokenSnapshot', 'token-two');
    await assert.rejects(this.actions.confirm(binding, this.captured, () => true), error => error.code === 'CONTEXT_CHANGED');
    assert.strictEqual(this.state.writes, 0, 'the original reviewed token cannot lend its authority');
  });

  test('a late native save response cannot report readback for a replacement session', async function(assert) {
    const binding = await this.actions.preview({id: '1a9', operation: 'set_default'}, this.captured);
    this.state.saveStarted = deferred(); this.state.saveGate = deferred();
    const outcome = this.actions.confirm(binding, this.captured, () => true).then(value => ({value}), error => ({error}));
    await this.state.saveStarted.promise;
    this.state.cookie = 'token-two';
    this.owner.lookup('service:auth-session').set('tokenSnapshot', 'token-two');
    this.owner.lookup('service:auth-session').set('accountId', '1a2');
    this.state.saveGate.resolve();
    const result = await outcome;
    assert.strictEqual(result.error.code, 'UNKNOWN_RESULT', 'a submitted write is not falsely called zero-effect');
    assert.notOk(result.value, 'the old callback does not publish completion');
    assert.true(this.owner.lookup('service:auth-session').get('tokenSnapshot') === 'token-two', 'the new session is retained');
    assert.strictEqual(this.owner.lookup('service:auth-session').get('accountId'), '1a2', 'the replacement actor is retained');
    assert.strictEqual(this.state.writes, 1, 'the old request is never replayed under the new actor');
    assert.true(this.state.actorRequests.every(options => options && options.credentials === 'omit' && options.headers && options.headers.Authorization === 'Bearer token-one'), 'even the late save used only its original actor options');
  });
});
