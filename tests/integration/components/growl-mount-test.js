import { module, test } from 'qunit';
import $ from 'jquery';
import { clearRender, render, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import resolver from '../../helpers/resolver';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';

module('Integration | Component | growl mount', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    let container = document.getElementById('jGrowl');
    if (container) {
      $(container).jGrowl('shutdown');
      container.remove();
    }
    this.testRoot.remove();
  });

  test('moves an early denial into the rendered mount and back for login or MFA', async function(assert) {
    let growl = this.owner.lookup('service:growl');
    growl.error('Action unavailable', 'No create permission');
    let container = document.getElementById('jGrowl');
    let instance = $(container).data('jGrowl.instance');
    assert.strictEqual(container.parentNode, document.body,
      'a denial raised before the authenticated template renders starts on the body');

    await render(precompileTemplate('{{growl-mount}}'));
    let mount = document.getElementById('growl-mount');
    assert.strictEqual(container.parentNode, mount,
      'the component moves the existing notice when the mount actually enters the DOM');
    assert.strictEqual(getComputedStyle(container).position, 'static',
      'authenticated notices reserve space above main content');
    assert.strictEqual($(container).data('jGrowl.instance'), instance,
      'the running plugin instance is preserved');

    await clearRender();
    assert.strictEqual(container.parentNode, document.body,
      'leaving the authenticated view returns the notice to the body');
    assert.strictEqual(getComputedStyle(container).position, 'fixed',
      'login and MFA retain the global notice position');
    growl.raw('Login error', 'Try again');
    assert.strictEqual(container.parentNode, document.body,
      'login and MFA notices remain outside the authenticated mount');
    assert.strictEqual($(container).data('jGrowl.instance'), instance,
      'the same plugin instance remains active');
  });

  test('destroying an old mount does not reclaim a container moved elsewhere', async function(assert) {
    let growl = this.owner.lookup('service:growl');
    growl.error('Action unavailable', 'No create permission');
    await render(precompileTemplate('{{growl-mount}}'));
    let container = document.getElementById('jGrowl');
    let nextMount = document.createElement('div');
    document.body.appendChild(nextMount);

    growl.placeContainer(nextMount);
    await clearRender();
    assert.strictEqual(container.parentNode, nextMount,
      'the old mount leaves another destination in control of the plugin');

    growl.placeContainer(document.body);
    nextMount.remove();
  });
});
