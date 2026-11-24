import EmberObject from '@ember/object';
import { click, find, render, setupContext, setupRenderingContext, teardownContext, settled } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import { module, test } from 'qunit';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

const LOCALES = ['de-de','en-us','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua','zh-hans','zh-tw'];

module('Integration | Component | lb image upgrade', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div'); this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver}); initializePodLayouts(); initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    await setupRenderingContext(this);
    this.calls = [];
    this.service = EmberObject.create({imageUpgradeAvailable: true,
      imageUpgradeCandidate: {fromLabel: 'v0.9.34', toLabel: 'v0.9.35'},
      send: (...args) => this.calls.push(args),
    });
  });
  hooks.afterEach(async function() {
    await teardownContext(this); this.testRoot.remove(); this.service.destroy();
  });

  test('all locales have a readable shared candidate and localized unavailable notice', async function(assert) {
    for (let locale of LOCALES) {
      let values = await (await fetch(`/translations/${locale}.json`)).json();
      this.intl.addTranslations(locale, values); this.intl.setLocale([locale]);
      await render(precompileTemplate('<LbImageUpgrade @service={{this.service}} />'));
      let button = find('[data-testid="lb-image-upgrade"]');
      assert.ok(button && button.textContent.includes('v0.9.34 → v0.9.35'), locale);
      assert.notOk(button.textContent.includes('Missing translation'), locale);
      let message = this.intl.t('servicePage.newBalancer.upgradeImageUnavailable').toString();
      assert.ok(message && !message.includes('Missing translation'), locale);
      if (locale !== 'en-us') {
        assert.notStrictEqual(message, 'No managed image update is available for this load balancer. Its existing image has not been changed.', locale);
      }
    }
    await click('[data-testid="lb-image-upgrade"]');
    assert.deepEqual(this.calls, [['upgrade', 'true']], 'image update is explicit, separate from ordinary editing');
  });

  test('permission or candidate loss removes the shared entry and prevents dispatch', async function(assert) {
    this.intl.addTranslations('en-us', await (await fetch('/translations/en-us.json')).json());
    this.intl.setLocale(['en-us']);
    await render(precompileTemplate('<LbImageUpgrade @service={{this.service}} />'));
    this.service.set('imageUpgradeAvailable', false); await settled();
    assert.strictEqual(find('[data-testid="lb-image-upgrade"]'), null);
    assert.deepEqual(this.calls, []);
  });
});
