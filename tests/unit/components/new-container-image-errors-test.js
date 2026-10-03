import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import NewContainerComponent from 'ui/components/new-container/component';
import FormImageComponent from 'ui/components/form-image/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new container image errors');

function pair(isVm = true) {
  let launchConfig = EmberObject.create({labels: {}, ports: A(), secrets: A()});
  let model = EmberObject.create({
    launchConfig, secondaryLaunchConfigs: A(),
    validationErrors() { return A(); },
  });
  let parent, image;
  let intl = EmberObject.create({label: '', t(key) { return this.get('label') + key; }});
  run(() => {
    parent = createOwned(NewContainerComponent, {
      renderer: inertRenderer(), intl, launchConfig, service: model,
      primaryResource: model, primaryService: model, isService: true,
    }, 'component');
    image = createOwned(FormImageComponent, {
      renderer: inertRenderer(), intl, isVm, initialValue: 'docker:example.test/custom:qa',
      projects: EmberObject.create({current: EmberObject.create({isWindows: false})}),
      settings: EmberObject.create({appName: 'PastureStack'}), sendAction() {},
    }, 'component');
  });
  let sync = () => parent.set('imageErrors', image.get('errors'));
  image.addObserver('errors', parent, sync);
  run(sync);
  return {parent, image, model, intl, destroy() {
    image.removeObserver('errors', parent, sync);
    destroyOwned(image);
    destroyOwned(parent);
  }};
}

test('VM and container correction clears only their locally aggregated required error', function(assert) {
  for (let isVm of [true, false]) {
    let p = pair(isVm);
    try {
      run(() => p.image.set('userInput', ''));
      assert.notOk(p.parent.get('errors.length'), 'does not auto-validate the parent before local validation');
      assert.notOk(p.parent.validate());
      assert.strictEqual(p.parent.get('errors.length'), 1);
      run(() => p.image.set('userInput', 'registry.example/custom:qa'));
      assert.deepEqual(p.image.get('errors'), []);
      assert.strictEqual(p.parent.get('errors'), null, 'top-errors clears without another validate/save');
      assert.ok(p.parent.validate(), 'required validation is not weakened');
    } finally { p.destroy(); }
  }
});

test('correction retains model and other component errors, including matching text', function(assert) {
  let p = pair();
  let required = 'formImage.vm.bootImageRequired';
  try {
    p.model.validationErrors = () => A(['model error']);
    run(() => {
      p.parent.set('commandErrors', A([required, 'command error']));
      p.image.set('userInput', '');
    });
    assert.notOk(p.parent.validate());
    run(() => p.image.set('userInput', 'registry.example/custom:qa'));
    assert.deepEqual(p.parent.get('errors'), ['model error', required, 'command error'], 'matching non-image diagnostics are not removed');
    assert.notOk(p.parent.validate(), 'remaining invalid fields still block saving');
  } finally { p.destroy(); }
});

test('locale replacement refreshes the required text without retaining the previous image message', function(assert) {
  let p = pair();
  try {
    run(() => p.image.set('userInput', ''));
    assert.notOk(p.parent.validate());
    run(() => { p.intl.set('label', 'zh:'); p.image.validate(); });
    assert.deepEqual(p.parent.get('errors'), ['zh:formImage.vm.bootImageRequired']);
    run(() => p.image.set('userInput', 'registry.example/custom:qa'));
    assert.strictEqual(p.parent.get('errors'), null);
  } finally { p.destroy(); }
});

test('a real save failure and errorSaving hook survive subsequent image correction', async function(assert) {
  let p = pair();
  let cleanupCalls = 0;
  p.parent.errorSaving = () => { cleanupCalls++; };
  try {
    run(() => p.image.set('userInput', ''));
    assert.notOk(p.parent.validate());
    await p.parent._handleSaveFailure('backend rejection');
    let backend = p.parent.get('errors');
    assert.deepEqual(backend, ['backend rejection']);
    run(() => p.image.set('userInput', 'registry.example/custom:qa'));
    assert.strictEqual(p.parent.get('errors'), backend, 'the server error array is neither cleared nor replaced');
    assert.strictEqual(cleanupCalls, 1, 'the existing failure cleanup runs once');
  } finally { p.destroy(); }
});
