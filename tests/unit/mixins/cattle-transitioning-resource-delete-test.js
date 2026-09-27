import EmberObject from '@ember/object';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import CattleTransitioningResource from 'ui/mixins/cattle-transitioning-resource';
import Project from 'ui/models/project';
import Stack from 'ui/models/stack';

module('Unit | Mixin | cattle transitioning resource delete');

test('delete displays the existing growl and rejects with the original error', async function(assert) {
  let failure = new Error('DELETE failed');
  let errors = [];
  let Subject = EmberObject.extend({
    delete() { return reject(failure); },
  }, CattleTransitioningResource);
  let subject = Subject.create({
    intl: EmberObject.create({t(key) {
      assert.strictEqual(key, 'confirmDelete.deleteFailed');
      return '刪除失敗';
    }}),
    growl: EmberObject.create({fromError(...args) { errors.push(args); }}),
  });

  await subject.delete().then(
    () => assert.ok(false, 'the failure cannot resolve as success'),
    (error) => assert.strictEqual(error, failure, 'the original error reaches callers')
  );
  assert.deepEqual(errors, [['刪除失敗', failure]], 'the existing growl uses the active locale once');
  subject.destroy();
});

test('delete success remains a successful value without an error growl', async function(assert) {
  let errors = [];
  let result = {id: '1st77'};
  let Subject = EmberObject.extend({
    delete() { return resolve(result); },
  }, CattleTransitioningResource);
  let subject = Subject.create({
    intl: EmberObject.create({t() { assert.ok(false, 'success needs no failure title'); }}),
    growl: EmberObject.create({fromError(...args) { errors.push(args); }}),
  });

  assert.strictEqual(await subject.delete(), result);
  assert.deepEqual(errors, []);
  subject.destroy();
});

test('project and stack direct delete actions do not navigate after a rejection', async function(assert) {
  let failure = new Error('DELETE denied');
  let transitions = [];
  let previousUrl = window.location.href;
  let ProjectWithRejectedDelete = Project.extend({
    delete() { return reject(failure); },
  });
  let project = ProjectWithRejectedDelete.create({
    id: '1a77',
    'tab-session': EmberObject.create({projectId: '1a77'}),
  });
  let stack = Stack.create({
    id: '1st77',
    application: EmberObject.create({currentRouteName: 'stack.index'}),
    router: EmberObject.create({transitionTo(...args) { transitions.push(args); }}),
  });

  await project.get('actions').delete.call(project).then(
    () => assert.ok(false, 'a rejected project delete cannot appear successful'),
    (error) => assert.strictEqual(error, failure, 'the project action preserves the failure')
  );
  let stackActionContext = {
    _super() { return reject(failure); },
    get(key) { return stack.get(key); },
  };
  await stack.get('actions').delete.call(stackActionContext).then(
    () => assert.ok(false, 'a rejected stack delete cannot appear successful'),
    (error) => assert.strictEqual(error, failure, 'the stack action preserves the failure')
  );
  assert.strictEqual(window.location.href, previousUrl, 'the project action did not reload the page');
  assert.deepEqual(transitions, [], 'the stack action did not navigate to the list');
  project.destroy();
  stack.destroy();
});
