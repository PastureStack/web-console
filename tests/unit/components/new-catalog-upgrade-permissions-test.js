import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import NewCatalog from 'ui/components/new-catalog/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new catalog upgrade permissions');

test('same-page upgrade refuses a missing instance action before sending a request', async function(assert) {
  let writes = 0;
  let stack = EmberObject.create({
    id: '1st-qa', actionLinks: {}, dockerCompose: 'services: {}',
    rancherCompose: 'services: {}', environment: {},
    doAction(action) {
      assert.strictEqual(action, 'upgrade');
      writes++;
      return resolve('upgraded');
    },
  });
  let component = createOwned(NewCatalog, {
    stackResource: stack,
    projectId: 'project-1',
    selectedTemplateModel: EmberObject.create({id: 'version-qa'}),
    intl: EmberObject.create({t(key) { return key; }}),
    catalog: EmberObject.create(),
    projects: EmberObject.create({
      current: EmberObject.create({id: 'project-1'}),
      schemaProjectId: 'project-1',
    }),
    settings: EmberObject.create(),
    renderer: inertRenderer(),
  }, 'component');

  assert.throws(() => component.doSave(),
    (error) => error.status === 403 && error.messageKey === 'newCatalog.upgradeUnavailable');
  assert.strictEqual(writes, 0, 'no upgrade request was sent');

  stack.set('actionLinks.upgrade', '/upgrade');
  assert.strictEqual(await component.doSave(), 'upgraded');
  assert.strictEqual(writes, 1, 'one explicitly authorized upgrade request was sent');
  destroyOwned(component);
});

test('same-page stack creation rechecks this project before POST', async function(assert) {
  let writes = 0;
  let allowed = true;
  let projects = EmberObject.create({
    current: EmberObject.create({id: 'project-1'}),
    schemaProjectId: 'project-1',
    schemaLoadGeneration: 1,
    canCreateResource(type) {
      assert.strictEqual(type, 'stack');
      return allowed && this.get('current.id') === this.get('schemaProjectId');
    },
  });
  let component = createOwned(NewCatalog, {
    stackResource: EmberObject.create({
      type: 'stack',
      save() {
        writes++;
        return resolve('created');
      },
    }),
    projectId: 'project-1',
    intl: EmberObject.create({t(key) { return key; }}),
    catalog: EmberObject.create(),
    projects,
    settings: EmberObject.create(),
    renderer: inertRenderer(),
  }, 'component');

  assert.true(component.get('canSubmit'));
  assert.strictEqual(await component.doSave(), 'created');
  assert.strictEqual(writes, 1);

  allowed = false;
  projects.incrementProperty('schemaLoadGeneration');
  assert.false(component.get('canSubmit'), 'the open form disables Save after capability revocation');
  assert.throws(() => component.doSave(),
    (error) => error.status === 403 && error.messageKey === 'newCatalog.permissionDenied');
  assert.strictEqual(writes, 1, 'revocation sends no second POST');

  allowed = true;
  projects.set('current.id', 'project-2');
  projects.set('schemaProjectId', 'project-2');
  assert.false(component.get('canSubmit'), 'a creator in another project cannot submit the old form');
  assert.throws(() => component.doSave(),
    (error) => error.status === 403 && error.messageKey === 'newCatalog.projectChanged');
  assert.strictEqual(writes, 1, 'project switching sends no POST');

  component.set('actuallySave', false);
  assert.true(component.get('canSubmit'), 'the configure-only modal does not write a stack');
  destroyOwned(component);
});

test('catalog required-field errors use the selected English, Chinese, or Japanese copy', async function(assert) {
  for (let locale of ['en-us', 'zh-tw', 'ja-jp']) {
    let response = await fetch(`/translations/${locale}.json`);
    assert.ok(response.ok, `${locale} translations are available`);
    let messages = await response.json();
    let t = (key, args={}) => messages[key].replace('{key}', args.key || '');
    let component = createOwned(NewCatalog, {
      stackResource: EmberObject.create({name: ''}),
      selectedTemplateModel: EmberObject.create({
        questions: [EmberObject.create({required: true, answer: null, label: 'Database name'})],
      }),
      intl: EmberObject.create({t}),
      catalog: EmberObject.create(),
      projects: EmberObject.create(),
      settings: EmberObject.create(),
      renderer: inertRenderer(),
    }, 'component');

    assert.false(component.validate());
    assert.deepEqual(component.get('errors'), [
      t('validation.required', {key: t('generic.name')}),
      t('validation.required', {key: 'Database name'}),
    ], `${locale} translates both client-side required errors`);
    destroyOwned(component);
  }
});

test('completed save never navigates a stack ID into a newly selected project', function(assert) {
  const transitions = [];
  const projects = EmberObject.create({current: EmberObject.create({id: 'project-1'})});
  const component = createOwned(NewCatalog, {
    stackResource: EmberObject.create({id: '1st-qa', system: false}),
    projectId: 'project-1',
    projects,
    router: EmberObject.create({transitionTo(...args) { transitions.push(args); }}),
    intl: EmberObject.create({t(key) { return key; }}),
    catalog: EmberObject.create(),
    settings: EmberObject.create(),
    renderer: inertRenderer(),
  }, 'component');

  component.doneSaving();
  assert.deepEqual(transitions, [['stack', 'project-1', '1st-qa']], 'the originating project is used');
  projects.set('current.id', 'project-2');
  component.doneSaving();
  assert.strictEqual(transitions.length, 1, 'a late save does not redirect from the newer project');
  destroyOwned(component);
});
