import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import StacksController from 'ui/stacks/index/controller';
import StackSection from 'ui/components/stack-section/component';
import Prefs from 'ui/services/prefs';
import C from 'ui/utils/constants';
import { archiveFixture } from '../../../helpers/archive';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';
import inertRenderer from '../../../helpers/inert-renderer';

module('Unit | Stacks | archive', function(hooks) {
  hooks.beforeEach(function() {
    this.f = archiveFixture();
    this.prefs = EmberObject.create({userStore: EmberObject.create({generation: 1})});
    this.controller = StacksController.create({
      projects: this.f.projects, prefs: this.prefs,
      stacksController: EmberObject.create({which: 'user', tags: ''}),
      model: {stacks: A([])},
    });
  });
  hooks.afterEach(function() {
    this.controller.destroy();
    this.f.destroy();
  });

  test('personal environment preference switches A to B to A and invalidates on account change', function(assert) {
    let controller = this.controller;
    assert.false(controller.get('showArchived'), 'missing preference defaults OFF');
    controller.set('showArchived', true);
    assert.deepEqual(this.prefs.get(C.PREFS.SHOW_ARCHIVED_STACKS), {'1a1': true});
    this.f.projects.set('current', EmberObject.create({id: '1a2'}));
    assert.false(controller.get('showArchived'), 'other environment defaults OFF');
    controller.set('showArchived', true);
    controller.set('showArchived', false);
    this.f.projects.set('current', EmberObject.create({id: '1a1'}));
    assert.true(controller.get('showArchived'), 'returning to A restores its own preference');
    this.prefs.set(C.PREFS.SHOW_ARCHIVED_STACKS, {});
    this.prefs.get('userStore').incrementProperty('generation');
    assert.false(controller.get('showArchived'), 'new account never keeps cached previous-account visibility');
  });

  test('tag/group filters and sorting compose with archive without changing the store array', function(assert) {
    let a = this.f.stack({id: '1st1', name: 'Zebra', group: 'team', archived: true});
    let b = this.f.stack({id: '1st2', name: 'Alpha', group: 'team'});
    let c = this.f.stack({id: '1st3', name: 'Other', group: 'other'});
    let records = A([a, b, c]);
    this.controller.set('model', {stacks: records});
    this.controller.set('stacksController.tags', 'team');
    assert.deepEqual(this.controller.get('arranged').mapBy('id'), ['1st2']);
    assert.strictEqual(this.controller.get('hiddenStackCount'), 1);
    this.controller.set('showArchived', true);
    assert.deepEqual(this.controller.get('arranged').mapBy('id'), ['1st2', '1st1'], 'existing name sort stays in force');
    assert.strictEqual(records.length, 3, 'filtering never removes store records');
    this.controller.set('showArchived', false);
    a.set('archived', false);
    assert.strictEqual(this.controller.get('arranged.length'), 2, 'WS field update recomputes visible rows');
    b.set('group', 'other');
    assert.deepEqual(this.controller.get('arranged').mapBy('id'), ['1st1'], 'tag updates remain reactive');
  });

  test('real preference service saves personal JSON and a refreshed controller reads it without resource updates', async function(assert) {
    let accounts = {first: A([]), second: A([])};
    let activeAccount = 'first';
    let saves = 0;
    let userStore = EmberObject.create({generation: 1,
      all() { return accounts[activeAccount]; },
      createRecord(values) {
        let record = EmberObject.create({...values, save() { saves++; this.set('id', 'personal-pref'); return resolve(this); }});
        accounts[activeAccount].pushObject(record);
        return record;
      },
    });
    let prefs = Prefs.create({userStore});
    this.controller.set('prefs', prefs);
    this.controller.set('showArchived', true);
    await resolve();
    assert.strictEqual(saves, 1, 'only the personal preference is saved');
    assert.strictEqual(accounts.first[0].get('type'), 'userPreference');
    assert.strictEqual(accounts.first[0].get('value'), '{"1a1":true}');
    let refreshed = StacksController.create({projects: this.f.projects, prefs});
    assert.true(refreshed.get('showArchived'), 'recreated page reads the persisted value');
    activeAccount = 'second';
    userStore.incrementProperty('generation');
    assert.false(refreshed.get('showArchived'), 'switching account resets its cache without borrowing the first record');
    activeAccount = 'first';
    userStore.incrementProperty('generation');
    assert.true(refreshed.get('showArchived'), 'returning to the first account reads its own saved preference');
    refreshed.destroy();
    this.controller.set('prefs', this.prefs);
    prefs.destroy();
    userStore.destroy();
    accounts.first.forEach(record => record.destroy());
  });

  test('Service visibility preserves true counts and direct Stack detail includes archived children', function(assert) {
    let a = this.f.service({id: '1s1', archived: true, instances: A([EmberObject.create({state: 'stopped'})])});
    let b = this.f.service({id: '1s2', name: 'Visible'});
    let stack = this.f.stack({services: A([a, b])});
    let component = createOwned(StackSection, {
      renderer: inertRenderer(), model: stack, projects: this.f.projects, prefs: this.prefs,
    }, 'component');
    assert.strictEqual(component.get('sortedServices.length'), 1);
    assert.strictEqual(component.get('hiddenServiceCount'), 1);
    assert.strictEqual(component.get('model.services.length'), 2, 'actual total stays two');
    assert.strictEqual(component.get('instanceCount'), 1, 'hidden child container stays in actual count');
    component.set('single', true);
    assert.strictEqual(component.get('sortedServices.length'), 2, 'direct detail does not filter children');
    component.set('single', false);
    a.set('archived', false);
    assert.strictEqual(component.get('sortedServices.length'), 2, 'WS restore updates the list');
    destroyOwned(component);
  });
});
