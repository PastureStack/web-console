import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { defer } from 'rsvp';
import { module, test } from 'qunit';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext, triggerEvent, waitUntil } from '@ember/test-helpers';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import ProjectsService from 'ui/services/projects';
import resolver from '../../helpers/resolver';

const projects = [{id: '1a9', name: 'Visible environment'}];
const stacks = [{id: '1st4', type: 'stack', name: 'Application', accountId: '1a9', links: {self: '/stacks/1st4'}},
  {id: '1st5', type: 'stack', name: 'Batch', accountId: '1a9', links: {self: '/stacks/1st5'}}];
const services = [{id: '1s4', type: 'service', name: 'Web', accountId: '1a9', stackId: '1st4'},
  {id: '1s5', type: 'service', name: 'Worker', accountId: '1a9', stackId: '1st5'}];
const schemas = ['stack', 'service'].map((id) => ({id, collectionMethods: ['GET'], links: {collection: `/${id}s`}}));

function targetView(context) {
  return Object.values(context.owner.lookup('-view-registry:main')).find((view) => view.element === find('.api-key-scope-target'));
}

async function chooseWithMouseup(kind, index = 0) {
  await triggerEvent(`[data-scope-selector="${kind}"] .ember-power-select-trigger`, 'mousedown', {button: 0});
  let options = document.querySelectorAll(`#ember-testing [data-scope-selector="${kind}"] [role="option"]`);
  if (!options[index]) { throw new Error('ExpectedRealPowerSelectOption'); }
  await triggerEvent(options[index], 'mouseup', {button: 0});
}

function assertClosed(assert, kind, message) {
  assert.notOk(find(`[data-scope-selector="${kind}"] .ember-basic-dropdown-content`), message);
}

module('Integration | Component | API key scope target dropdown lifecycle', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    await setupRenderingContext(this);
    this.scope = {kind: 'resource', resourceType: 'stack', resourceId: ''};
    this.shown = true;
    this.events = [];
    this.evidence = [];
    this.projectRows = projects;
    this.findCalls = 0;
    this.pendingReads = [];
    let context = this;
    this.owner.register('service:store', Service.extend({generation: 1}));
    this.owner.register('service:user-store', Service.extend({generation: 1,
      find(type, id, options) {
        if (type !== 'project' || id !== null || JSON.stringify(options) !== JSON.stringify({url: 'projects', forceReload: true, depaginate: true})) {
          throw new Error('FreshVisibleProjectCollectionRequired');
        }
        context.findCalls++;
        if (context.nextProjectRead) {
          let pending = context.nextProjectRead;
          context.nextProjectRead = null;
          return pending.promise;
        }
        return Promise.resolve(context.projectRows);
      },
      rawRequest(options) {
        if (options.method !== 'GET') { throw new Error('ScopeDropdownTestMustNotWrite'); }
        if (options.url === 'projects/1a9/schema') { return Promise.resolve({body: {data: schemas}}); }
        if (options.url === '/stacks') { return Promise.resolve({body: {data: stacks}}); }
        if (options.url === '/services') { return Promise.resolve({body: {data: services}}); }
        let detail = stacks.find((item) => item.links.self === options.url);
        if (detail) { return Promise.resolve({body: detail}); }
        throw new Error('UnadvertisedScopeDropdownRead');
      }}));
    this.owner.register('service:projects', ProjectsService.extend({current: EmberObject.create({id: '1a9'}),
      schemaProjectId: '1a9', schemaLoadGeneration: 1}));
    this.owner.register('service:session', Service.extend({accountId: '1a1'}));
    this.owner.register('service:access', Service.extend({enabled: true, admin: false, identity: EmberObject.create({id: 'viewer1'})}));
    this.owner.register('service:intl', Service.extend({_locale: 'en-us',
      t(key) { return key; }}));
    this.set('onSelect', (event) => {
      this.events.push(event.target.value);
      this.set('scope', Object.assign({}, this.scope, {resourceId: event.target.value}));
    });
    this.set('onCapabilities', (value) => this.evidence.push(value));
  });

  hooks.afterEach(async function() {
    this.pendingReads.forEach((pending) => pending.resolve([]));
    await teardownContext(this);
    this.testRoot.remove();
  });

  async function renderTarget(context) {
    await render(precompileTemplate('{{#if this.shown}}{{api-key-scope-target scope=this.scope onSelect=this.onSelect onCapabilities=this.onCapabilities}}{{/if}}'));
    await waitUntil(() => targetView(context)?.get('loading') === false);
  }

  function deferNextRead(context) {
    let pending = defer();
    context.pendingReads.push(pending);
    context.nextProjectRead = pending;
    return pending;
  }

  test('project mouseup closes before deferred loading and does not reopen when enabled', async function(assert) {
    await renderTarget(this);
    let component = targetView(this), pending = deferNextRead(this);
    await chooseWithMouseup('project');
    assert.ok(component.get('loading'), 'actual project onChange starts the deferred fresh read');
    assertClosed(assert, 'project', 'the real PowerSelect content closes while loading disables the trigger');
    assert.ok(component.get('targetDisabled'), 'no resource can be selected during loading');
    assert.deepEqual(this.events, [''], 'project change clears the stable target through the normal callback');
    pending.resolve(projects);
    await waitUntil(() => component.get('loading') === false);
    await settled();
    assertClosed(assert, 'project', 'the old project menu does not reappear after loading is released');
    assert.strictEqual(component.get('selectedProject.id'), '1a9');
    assert.notOk(component.get('targetDisabled'), 'resource selection is available after the verified context loads');
    assert.strictEqual(component.get('candidates.length'), 2);
    assert.strictEqual(component.get('scope.resourceId'), '', 'closing does not select a target or write a policy');
  });

  test('stack mouseup closes its selector before deferred loading and leaves its project closed', async function(assert) {
    this.set('scope', {kind: 'resource', resourceType: 'service', resourceId: ''});
    await renderTarget(this);
    await chooseWithMouseup('project');
    let component = targetView(this);
    await waitUntil(() => component.get('loading') === false && component.get('stackOptions.length') === 2);
    let pending = deferNextRead(this);
    await chooseWithMouseup('stack', 1);
    assert.ok(component.get('loading'), 'actual stack onChange starts the deferred fresh read');
    assertClosed(assert, 'stack', 'stack closes before its disabled state takes effect');
    assertClosed(assert, 'project', 'the sibling project selector remains closed');
    assert.strictEqual(component.get('scope.resourceId'), '');
    pending.resolve(projects);
    await waitUntil(() => component.get('loading') === false);
    await settled();
    assertClosed(assert, 'stack', 'the stack menu does not reopen when loading ends');
    assertClosed(assert, 'project', 'the project menu also remains closed');
    assert.strictEqual(component.get('selectedStack.id'), '1st5');
    assert.deepEqual(component.get('candidates').map((option) => option.id), ['1s5'], 'only the chosen stack context is offered');
    assert.notOk(component.get('targetDisabled'));
  });

  test('a withdrawn viewer cannot restore a selected project or reopen it on stale completion', async function(assert) {
    await renderTarget(this);
    let component = targetView(this), pending = deferNextRead(this);
    await chooseWithMouseup('project');
    assert.ok(component.get('loading'));
    this.projectRows = [];
    this.owner.lookup('service:access').set('identity.id', 'withdrawn-viewer');
    await waitUntil(() => component.get('loading') === false && component.get('projectOptions.length') === 0);
    let generation = component._loadGeneration, evidenceCount = this.evidence.length;
    pending.resolve(projects);
    await settled();
    assert.strictEqual(component._loadGeneration, generation, 'stale completion does not replace the latest generation');
    assert.strictEqual(component.get('selectedProject'), null);
    assert.deepEqual(component.get('candidates'), []);
    assertClosed(assert, 'project', 'stale metadata cannot reopen the closed selector');
    assert.strictEqual(this.evidence.length, evidenceCount, 'stale completion publishes no new authority evidence');
    assert.notOk(this.evidence.some((value) => value.selectionValid), 'no old viewer selection is treated as permission proof');
  });

  test('resource mouseup stays closed through parent scope update and deferred verified detail loading', async function(assert) {
    await renderTarget(this);
    await chooseWithMouseup('project');
    let component = targetView(this);
    await waitUntil(() => component.get('loading') === false && component.get('candidates.length') === 2);
    let pending = deferNextRead(this);
    await chooseWithMouseup('resource');
    assert.ok(component.get('loading'), 'the normal parent scope callback starts a fresh deferred context read');
    assertClosed(assert, 'resource', 'the actual resource dropdown closes while its selected detail is being verified');
    assert.strictEqual(this.scope.resourceId, '1st4', 'only the normally selected public fixture reference reaches the parent draft');
    pending.resolve(projects);
    await waitUntil(() => component.get('loading') === false && component.get('selectedTarget.id') === '1st4');
    await settled();
    assertClosed(assert, 'resource', 'the resource menu does not reopen when loading is released');
    assertClosed(assert, 'project', 'the sibling project menu remains closed');
    assert.ok(this.evidence.at(-1).selectionValid && this.evidence.at(-1).contextVerified && this.evidence.at(-1).complete,
      'selection still requires the advertised same-project self detail and fresh capability evidence');
    assert.deepEqual(this.events, ['', '1st4'], 'normal draft callbacks are preserved without synthetic selection or a policy save');
  });

  test('destroy during a real selection rejects its late deferred completion without callbacks', async function(assert) {
    await renderTarget(this);
    let component = targetView(this), pending = deferNextRead(this);
    await chooseWithMouseup('project');
    assert.ok(component.get('loading'));
    this.set('shown', false);
    await settled();
    assert.ok(component.isDestroyed, 'the actual rendered component has been destroyed');
    let evidenceCount = this.evidence.length, events = this.events.slice();
    pending.resolve(projects);
    await settled();
    assert.notOk(find('.api-key-scope-target'));
    assert.strictEqual(this.evidence.length, evidenceCount, 'the destroyed selector cannot notify its former owner');
    assert.deepEqual(this.events, events, 'late completion does not select or clear another target');
    assert.notOk(document.querySelector('#ember-testing .ember-basic-dropdown-content'), 'no dropdown content survives destruction');
  });
});
