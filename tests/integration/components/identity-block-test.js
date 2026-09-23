import { module, test } from 'qunit';
import { setupContext, setupRenderingContext, teardownContext, render, find, settled } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import Service from '@ember/service';
import EmberObject from '@ember/object';
import resolver from '../../helpers/resolver';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';

module('Integration | Component | identity block', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    this.owner.register('service:intl', Service.extend({
      t(key) {
        return key;
      },
    }));
    await setupRenderingContext(this);
    this.userStore = EmberObject.create({
      find() {
        return Promise.reject({status: 404});
      },
    });
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('renders the embedded external identity after the authoritative lookup returns 404', async function(assert) {
    await render(precompileTemplate('{{identity-block userStore=this.userStore externalIdType="oidc_user" externalId="retired-subject" avatar=false link=false size=0}}'));
    await settled();

    let block = find('.gh-block');

    assert.strictEqual(block.getAttribute('role'), 'group', 'the identity has nameable group semantics');
    assert.strictEqual(block.getAttribute('aria-label'), 'retired-subject', 'the external ID remains the accessible name');
    assert.ok(block.textContent.includes('retired-subject'), 'the inactive identity remains visibly distinguishable');
  });
});
