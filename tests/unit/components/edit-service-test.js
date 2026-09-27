import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import EditService from 'ui/components/edit-service/component';
import FormScale from 'ui/components/form-scale/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit service');

function makeComponent({save, setLinks}, closed) {
  const originalLaunchConfig = {imageUuid: 'docker:example', volumeDriver: ''};
  const originalUpgrade = {inServiceStrategy: {batchSize: 1}};
  const draft = EmberObject.create({
    name: 'renamed-service',
    description: 'edited description',
    scale: 2,
    launchConfig: {imageUuid: 'docker:example', volumeDriver: ''},
    upgrade: {inServiceStrategy: {batchSize: 1}},
    validationErrors() {
      // The shared validator can normalize fields that this modal never edits.
      this.get('launchConfig').volumeDriver = null;
      this.get('launchConfig').created = null;
      this.get('upgrade').inServiceStrategy.batchSize = 2;
      return A([]);
    },
    save,
    doAction: setLinks,
  });
  const original = EmberObject.create({
    name: 'original-service',
    description: 'old description',
    scale: 1,
    launchConfig: originalLaunchConfig,
    upgrade: originalUpgrade,
    clone() { return draft; },
  });
  const component = createOwned(EditService, {
    renderer: inertRenderer(),
    modalService: EmberObject.create({
      modalOpts: original,
      modalVisible: true,
      toggleModal() { closed.push(true); },
    }),
    serviceLinksArray: A([{name: 'database', serviceId: '1s2'}]),
  }, 'component');

  return {component, original, originalLaunchConfig, originalUpgrade};
}

function save(component) {
  return component.get('actions').save.call(component);
}

test('Save sends only editable service fields and keeps launch and upgrade data intact', async function(assert) {
  const closed = [];
  const calls = [];
  const {component, original, originalLaunchConfig, originalUpgrade} = makeComponent({
    save(options) {
      calls.push({kind: 'PUT', body: options.data});
      return resolve(this);
    },
    setLinks(action, body) {
      calls.push({kind: action, body});
      return resolve();
    },
  }, closed);

  await save(component);

  assert.deepEqual(calls, [
    {kind: 'PUT', body: {name: 'renamed-service', description: 'edited description', scale: 2}},
    {kind: 'setservicelinks', body: {serviceLinks: [{name: 'database', serviceId: '1s2'}]}},
  ], 'the link action follows a narrow Service PUT');
  assert.deepEqual(originalLaunchConfig, {imageUuid: 'docker:example', volumeDriver: ''},
    'validation side effects do not enter the cached launch configuration');
  assert.deepEqual(originalUpgrade, {inServiceStrategy: {batchSize: 1}},
    'validation side effects do not enter the cached upgrade strategy');
  assert.strictEqual(original.get('description'), 'edited description');
  assert.strictEqual(original.get('name'), 'renamed-service');
  assert.strictEqual(original.get('scale'), 2);
  assert.deepEqual(closed, [true], 'complete success closes the modal');
  destroyOwned(component);
});

test('a failed link action keeps the saved fields for retry without sending nested configuration', async function(assert) {
  const closed = [];
  const payloads = [];
  let linkAttempts = 0;
  const {component, original, originalLaunchConfig, originalUpgrade} = makeComponent({
    save(options) {
      payloads.push(options.data);
      return resolve(this);
    },
    setLinks() {
      linkAttempts++;
      return linkAttempts === 1 ? reject(new Error('link action failed')) : resolve();
    },
  }, closed);

  const first = await save(component);
  assert.strictEqual(first.saved, false, 'a failed dependent action remains a failed Save');
  assert.deepEqual(closed, [], 'the modal stays open for retry');
  assert.strictEqual(original.get('description'), 'edited description', 'the successful PUT remains applied');

  await save(component);
  assert.deepEqual(payloads, [
    {name: 'renamed-service', description: 'edited description', scale: 2},
    {name: 'renamed-service', description: 'edited description', scale: 2},
  ], 'both attempts use the same bounded payload');
  assert.strictEqual(linkAttempts, 2);
  assert.deepEqual(originalLaunchConfig, {imageUuid: 'docker:example', volumeDriver: ''});
  assert.deepEqual(originalUpgrade, {inServiceStrategy: {batchSize: 1}});
  assert.deepEqual(closed, [true], 'retry success closes the modal');
  destroyOwned(component);
});

test('saving immediately after moving the scale slider uses the visible scale', async function(assert) {
  const payloads = [];
  const scaleEvents = [];
  const {component} = makeComponent({
    save(options) {
      payloads.push(options.data);
      return resolve(this);
    },
    setLinks() { return resolve(); },
  }, []);
  let scaleForm;
  run(() => {
    scaleForm = createOwned(FormScale, {
      renderer: inertRenderer(),
      editing: true,
      initialScale: 2,
      initialLabels: {},
      sendAction(name, scale) {
        if ( name === 'setScale' ) {
          scaleEvents.push(scale);
          component.send('setScale', scale);
        }
      },
    }, 'component');
    scaleForm.set('scale', 3);
  });

  assert.true(scaleForm.get('editing'));
  assert.strictEqual(scaleForm.get('scale'), 3);
  assert.deepEqual(scaleEvents, [3], 'the form reports the visible scale immediately');
  assert.strictEqual(component.get('service.scale'), 3,
    'the parent draft is updated before a Save can read it');
  await save(component);
  assert.strictEqual(payloads[0].scale, 3, 'the Service PUT includes the current slider value');
  destroyOwned(scaleForm);
  destroyOwned(component);
});

test('editing a zero-scale service keeps scale zero when saving another field', async function(assert) {
  const payloads = [];
  const {component, original} = makeComponent({
    save(options) {
      payloads.push(options.data);
      return resolve(this);
    },
    setLinks() { return resolve(); },
  }, []);
  component.set('service.scale', 0);
  let scaleForm;
  run(() => {
    scaleForm = createOwned(FormScale, {
      renderer: inertRenderer(),
      editing: true,
      initialScale: 0,
      initialLabels: {},
      sendAction(name, scale) {
        if ( name === 'setScale' ) {
          component.send('setScale', scale);
        }
      },
    }, 'component');
  });

  assert.strictEqual(scaleForm.get('scale'), 0, 'the form displays the existing zero scale');
  assert.strictEqual(component.get('service.scale'), 0, 'opening the form does not scale up the draft');
  await save(component);
  assert.strictEqual(payloads[0].scale, 0, 'the Service PUT preserves zero scale');
  assert.strictEqual(original.get('scale'), 0, 'the cached Service remains at zero');
  destroyOwned(scaleForm);
  destroyOwned(component);
});
