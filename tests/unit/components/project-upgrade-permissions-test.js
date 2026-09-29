import EmberObject from '@ember/object';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import ProjectUpgrade from 'ui/components/project-upgrade/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | project upgrade permissions');

test('upgrade requires both owner role and this project ID upgrade action', async function(assert) {
  let writes = 0;
  let owner = true;
  let project = EmberObject.create({
    id: '1a21',
    actionLinks: {},
    doAction(action) {
      assert.strictEqual(action, 'upgrade');
      writes++;
      return resolve('upgraded');
    },
  });
  let projects = EmberObject.create({current: project, schemaProjectId: '1a21', schemaLoadGeneration: 1});
  let component = createOwned(ProjectUpgrade, {
    access: EmberObject.create({isOwner() { return owner; }}),
    intl: EmberObject.create({t(key) { return key; }}),
    projects,
    renderer: inertRenderer(),
    settings: EmberObject.create(),
  }, 'component');

  assert.false(component.get('canUpgrade'), 'owner cannot upgrade without this ID action link');
  await component.get('actions').upgrade.call(component);
  assert.strictEqual(writes, 0, 'disabled button path cannot submit');

  project.set('actionLinks', {upgrade: '/projects/1a21?action=upgrade'});
  assert.true(component.get('canUpgrade'), 'owner can upgrade an advertised resource action');
  assert.strictEqual(await component.get('actions').upgrade.call(component), 'upgraded');
  assert.strictEqual(writes, 1, 'submits one upgrade and returns its completion promise');

  owner = false;
  projects.incrementProperty('schemaLoadGeneration');
  assert.false(component.get('canUpgrade'), 'role change on the same project invalidates the cached owner check');
  await component.get('actions').upgrade.call(component);
  assert.strictEqual(writes, 1);

  owner = true;
  projects.set('schemaProjectId', null);
  assert.false(component.get('canUpgrade'), 'a schema reload cannot borrow the earlier owner grant');
  projects.set('schemaProjectId', '1a21');
  projects.incrementProperty('schemaLoadGeneration');
  assert.true(component.get('canUpgrade'));

  owner = false;
  project.set('id', '1a22');
  assert.false(component.get('canUpgrade'), 'non-owner cannot use the action even if advertised');
  await component.get('actions').upgrade.call(component);
  assert.strictEqual(writes, 1);
  destroyOwned(component);
});

test('failed upgrade explains the error on the page and prevents duplicate submission', async function(assert) {
  let pending = defer();
  let writes = 0;
  let project = EmberObject.create({
    id: '1a21',
    actionLinks: {upgrade: '/projects/1a21?action=upgrade'},
    doAction() {
      writes++;
      return pending.promise;
    },
  });
  let component = createOwned(ProjectUpgrade, {
    access: EmberObject.create({isOwner() { return true; }}),
    intl: EmberObject.create({t(key) { return key; }}),
    projects: EmberObject.create({current: project, schemaProjectId: '1a21'}),
    renderer: inertRenderer(),
    settings: EmberObject.create(),
  }, 'component');

  let first = component.get('actions').upgrade.call(component);
  await component.get('actions').upgrade.call(component);
  pending.reject({status: 403});
  assert.false(await first);
  assert.strictEqual(writes, 1, 'a second click does not send another upgrade');
  assert.strictEqual(component.get('errorMessage'), 'resourceSaveError.unavailable');
  assert.false(component.get('isUpgrading'));

  project.set('doAction', () => reject({status: 404}));
  assert.false(await component.get('actions').upgrade.call(component));
  assert.strictEqual(component.get('errorMessage'), 'resourceSaveError.unavailable');
  destroyOwned(component);
});

test('a project switch before the queued upgrade cannot write either project', async function(assert) {
  let writes = [];
  const oldProject = EmberObject.create({
    id: '1a21',
    actionLinks: {upgrade: '/projects/1a21?action=upgrade'},
    doAction() { writes.push('old'); return resolve(); },
  });
  const newProject = EmberObject.create({
    id: '1a22',
    actionLinks: {upgrade: '/projects/1a22?action=upgrade'},
    doAction() { writes.push('new'); return resolve(); },
  });
  const projects = EmberObject.create({current: oldProject, schemaProjectId: '1a21'});
  const component = createOwned(ProjectUpgrade, {
    access: EmberObject.create({isOwner() { return true; }}),
    intl: EmberObject.create({t(key) { return key; }}),
    projects,
    renderer: inertRenderer(),
    settings: EmberObject.create(),
  }, 'component');

  const pending = component.get('actions').upgrade.call(component);
  projects.setProperties({current: newProject, schemaProjectId: '1a22'});
  assert.false(await pending, 'stale click settles as a localized denial');
  assert.deepEqual(writes, [], 'neither the old nor the newly selected project is modified');
  assert.strictEqual(component.get('errorMessage'), 'resourceSaveError.unavailable');
  assert.false(component.get('isUpgrading'));
  destroyOwned(component);
});
