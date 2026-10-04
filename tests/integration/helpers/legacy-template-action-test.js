import { module, test } from 'qunit';
import { fillIn, find, render, select, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import Service from '@ember/service';

import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';

import resolver from '../../helpers/resolver';

module('Integration | Helper | legacy template action', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, { resolver });
    initializePodLayouts();
    this.owner.register('service:intl', Service.extend({t(key) { return key; }}));
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('fn mut updates the command model through a real legacy input', async function(assert) {
    this.command = ['sleep', '30'];
    await render(precompileTemplate(
      '{{input-command initialValue=this.command changed=(fn (mut this.command))}}'
    ));

    await fillIn('input', 'sleep 3600');
    assert.deepEqual(this.command, ['sleep', '3600'], 'the rendered command field writes the bound array');
  });

  test('native enum select preserves the mut setter and changes only its bound model field', async function(assert) {
    this.enumModel = {id: 'unchanged-model', value: 'first', metadata: {stable: true}};
    this.enumField = {options: ['first', 'second']};
    let metadata = this.enumModel.metadata;
    await render(precompileTemplate('{{schema/input-enum field=this.enumField value=this.enumModel.value}}'));

    assert.strictEqual(find('select').value, 'first');
    await select('select', 'second');
    assert.strictEqual(this.enumModel.value, 'second', 'real input/change invokes the native fn-mut setter');
    assert.strictEqual(find('select').value, 'second', 'the selected option agrees with the model');
    assert.strictEqual(this.enumModel.id, 'unchanged-model');
    assert.strictEqual(this.enumModel.metadata, metadata, 'unknown metadata is not replaced');
    assert.deepEqual(metadata, {stable: true});
    assert.deepEqual(this.enumField.options, ['first', 'second'], 'schema choices remain unchanged');
  });
});
