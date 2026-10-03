import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import FormImageComponent from 'ui/components/form-image/component';
import NewContainerComponent from 'ui/components/new-container/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | VM boot image');

function createImage(properties = {}) {
  let component;

  run(() => {
    component = createOwned(FormImageComponent, Object.assign({
      renderer: inertRenderer(),
      intl: EmberObject.create({t(key) { return key; }}),
      projects: EmberObject.create({current: EmberObject.create({isWindows: false})}),
      settings: EmberObject.create({appName: 'PastureStack'}),
      sendAction() {},
    }, properties), 'component');
  });

  return component;
}

test('existing and last-used VM images stay custom and separate from container images', function(assert) {
  let original = createImage({isVm: true, initialValue: 'docker:example.test/custom-vm:qa'});
  let remembered = createImage({isVm: true});
  let container = createImage({isVm: false, initialValue: 'docker:example.test/container:qa'});
  let nextVm = createImage({isVm: true});
  let windowsVm = createImage({
    isVm: true,
    projects: EmberObject.create({current: EmberObject.create({isWindows: true})}),
  });

  try {
    assert.strictEqual(original.get('value'), 'docker:example.test/custom-vm:qa', 'existing image is preserved, without a whitelist');
    assert.strictEqual(remembered.get('value'), original.get('value'), 'last-used VM image is retained');
    assert.strictEqual(nextVm.get('value'), original.get('value'), 'ordinary container input does not change the VM cache');
    assert.strictEqual(windowsVm.get('value'), original.get('value'), 'a Windows container default cannot replace the VM image');
    assert.strictEqual(container.get('value'), 'docker:example.test/container:qa', 'container input is unchanged');
  } finally {
    [original, remembered, container, nextVm, windowsVm].forEach(destroyOwned);
  }
});

test('blank VM image errors cancel native save before doSave', async function(assert) {
  let image = createImage({isVm: true});
  let launchConfig = EmberObject.create({labels: {}, ports: A(), secrets: A()});
  let model = EmberObject.create({
    name: 'qa-vm', scale: 1, launchConfig, secondaryLaunchConfigs: A(),
    validationErrors() { return A(); },
  });
  let saveCalls = 0;
  let callbackResult;
  let parent;

  run(() => {
    image.set('userInput', '');
    image.userInputDidChange();
    parent = createOwned(NewContainerComponent, {
      renderer: inertRenderer(),
      intl: EmberObject.create({t(key) { return key; }}),
      service: model,
      primaryResource: model,
      primaryService: model,
      launchConfig,
      isService: true,
      imageErrors: image.get('errors'),
      doSave() { saveCalls++; },
    }, 'component');
  });

  try {
    // Ember's send() dispatches the action but does not return its Promise.
    // Await the actual action, as the shared save-lifecycle tests do.
    let outcome = await parent.get('actions').save.call(parent, (result) => { callbackResult = result; });

    assert.strictEqual(image.get('value'), null, 'no misleading image is substituted for empty input');
    assert.deepEqual(image.get('errors'), ['formImage.vm.bootImageRequired']);
    assert.strictEqual(outcome.saved, false, 'real save lifecycle is cancelled by validation');
    assert.strictEqual(saveCalls, 0, 'native resource save is not entered');
    assert.strictEqual(callbackResult, false);
    assert.ok(parent.get('errors').includes('formImage.vm.bootImageRequired'), 'the image error reaches parent validation');
  } finally {
    destroyOwned(image);
    destroyOwned(parent);
  }
});
