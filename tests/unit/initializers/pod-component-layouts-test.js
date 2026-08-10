import { module, test } from 'qunit';

import {
  associatePodComponentLayouts
} from 'ui/initializers/pod-component-layouts';

module('Unit | Initializer | pod component layouts');

test('it associates colocated pod templates with classic component classes', function(assert) {
  let LoginForm = function() {};
  let LoginTemplate = function() {};
  let modules = {
    'ui/components/login-user-pass/component': {default: LoginForm},
    'ui/components/login-user-pass/template': {default: LoginTemplate},
    'ui/components/component-without-template/component': {default: function() {}},
    'ui/login/index/component': {default: function() {}},
    'ui/login/index/template': {default: function() {}}
  };
  let associated = [];

  let count = associatePodComponentLayouts(
    modules,
    (name) => modules[name],
    () => undefined,
    (template, component) => associated.push({template, component})
  );

  assert.equal(count, 1, 'only complete component/template pairs under ui/components are associated');
  assert.deepEqual(associated, [{template: LoginTemplate, component: LoginForm}], 'associates the expected pod pair');
});

test('it leaves a component that already owns a template unchanged', function(assert) {
  let Component = function() {};
  let ExistingTemplate = function() {};
  let ReplacementTemplate = function() {};
  let modules = {
    'ui/components/example/component': {default: Component},
    'ui/components/example/template': {default: ReplacementTemplate}
  };
  let setCalls = 0;

  let count = associatePodComponentLayouts(
    modules,
    (name) => modules[name],
    () => ExistingTemplate,
    () => setCalls += 1
  );

  assert.equal(count, 0, 'does not associate a second template');
  assert.equal(setCalls, 0, 'does not overwrite an existing component template');
});
