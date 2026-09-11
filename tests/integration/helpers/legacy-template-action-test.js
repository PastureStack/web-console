import { module, test } from 'qunit';
import { fillIn, render, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';

import resolver from '../../helpers/resolver';

module('Integration | Helper | legacy template action', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, { resolver });
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
});
