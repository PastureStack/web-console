import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import NewSecret from 'ui/components/new-secret/component';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';
import resolver from '../../helpers/resolver';

module('Unit | Component | new secret');

test('a denied Secret edit leaves the cached record and form available for retry', async function(assert) {
  const original = EmberObject.create({name: 'existing-name', description: 'before', value: null});
  const draft = EmberObject.create({
    name: 'existing-name', description: 'after', value: null,
    validationErrors() { return A([]); },
    save(options) {
      assert.deepEqual(options.data, {description: 'after'});
      return reject(new Error('Secret update denied'));
    },
  });
  let closes = 0;
  const component = createOwned(NewSecret, {
    renderer: inertRenderer(),
    editing: true,
    model: draft,
    originalModel: original,
    sendAction() { closes++; },
  }, 'component');

  const result = await component.get('actions').save.call(component);
  assert.strictEqual(result.saved, false);
  assert.strictEqual(closes, 0, 'the failed edit stays open');
  assert.strictEqual(original.get('description'), 'before', 'the cached Secret is unchanged');
  assert.strictEqual(draft.get('description'), 'after', 'the entered description is retained');
  assert.ok(component.get('errors.0').includes('Secret update denied'));
  destroyOwned(component);
});

test('clearing the description sends an explicit empty string after schema validation', async function(assert) {
  const original = EmberObject.create({name: 'existing-name', description: 'before'});
  const payloads = [];
  const draft = EmberObject.create({
    name: 'existing-name', description: '',
    validationErrors() {
      // The resource validator normalizes an empty nullable string to null.
      this.set('description', null);
      return A([]);
    },
    save(options) {
      payloads.push(options.data);
      return resolve(this);
    },
  });
  const component = createOwned(NewSecret, {
    renderer: inertRenderer(),
    editing: true,
    model: draft,
    originalModel: original,
    sendAction() {},
  }, 'component');

  await component.get('actions').save.call(component);
  assert.deepEqual(payloads, [{description: ''}], 'the PUT explicitly clears the description');
  assert.strictEqual(original.get('description'), '', 'the listed Secret is cleared too');

  draft.set('description', null);
  await component.get('actions').save.call(component);
  assert.deepEqual(payloads, [{description: ''}, {description: null}],
    'an untouched null is not converted to an empty string');
  assert.strictEqual(original.get('description'), null);
  destroyOwned(component);
});

test('Secret creation still saves its full new record', async function(assert) {
  const draft = EmberObject.create({
    name: 'new-secret', description: 'new description', value: 'encoded-value',
    validationErrors() { return A([]); },
    save(options) {
      assert.strictEqual(options, undefined, 'creation uses the existing resource serialization');
      return resolve(this);
    },
  });
  let closes = 0;
  const component = createOwned(NewSecret, {
    renderer: inertRenderer(),
    editing: false,
    model: draft,
    sendAction() { closes++; },
  }, 'component');

  await component.get('actions').save.call(component);
  assert.strictEqual(closes, 1);
  destroyOwned(component);
});

module('Integration | Component | edit secret', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    const intl = this.owner.lookup('service:intl');
    const messages = await (await fetch('/translations/en-us.json')).json();
    intl.addTranslations('en-us', messages);
    intl.setLocale(['en-us']);
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('Save sends only description, updates the listed Secret, and keeps name read-only', async function(assert) {
    const payloads = [];
    let closes = 0;
    const draft = EmberObject.create({
      name: 'existing-name', description: 'after', value: null,
      state: 'active', accountId: '1a-owner',
      validationErrors() { return A([]); },
      save(options) {
        payloads.push(options.data);
        return resolve(this);
      },
    });
    const original = EmberObject.create({
      name: 'existing-name', description: 'before', value: null,
      clone() { return draft; },
    });

    this.owner.register('service:modal', Service.extend({
      modalVisible: true,
      modalOpts: null,
      toggleModal() { closes++; this.set('modalVisible', false); },
    }));
    this.modal = this.owner.lookup('service:modal');
    this.modal.set('modalOpts', original);

    await render(precompileTemplate('{{#if this.modal.modalVisible}}{{edit-secret}}{{/if}}'));
    assert.true(find('input[type="text"]').disabled, 'the API does not allow renaming this Secret');
    assert.ok(this.testRoot.textContent.includes('Name cannot be changed after creation.'),
      'the form explains why its name field is read-only');
    assert.false(find('textarea').disabled, 'description remains editable');
    assert.strictEqual(document.activeElement, find('textarea'),
      'opening Edit focuses the first editable field');
    find('.footer-actions .btn-primary').click();
    await settled();

    assert.deepEqual(payloads, [{description: 'after'}], 'metadata and absent secret value never enter the PUT');
    assert.strictEqual(original.get('description'), 'after', 'the cached list resource reflects the Save');
    assert.strictEqual(original.get('name'), 'existing-name');
    assert.strictEqual(original.get('value'), null);
    assert.strictEqual(closes, 1);
  });
});
