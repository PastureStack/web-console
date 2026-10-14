import { A } from '@ember/array';
import Component from '@ember/component';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { find, findAll, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';

import MachinePageTemplate from 'ui/admin-tab/machine/template';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import MachineDriver from 'ui/models/machinedriver';
import CatalogTemplate from 'ui/models/template';
import resolver from '../../helpers/resolver';
import { destroyOwned } from '../../helpers/owned-subject';

module('Integration | Component | catalog box driver names', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    this.testRoot.style.width = '320px';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    this.owner.register('service:settings', Service.extend({}));
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    for (let locale of ['en-us', 'zh-tw']) {
      this.intl.addTranslations(locale, await (await fetch(`/translations/${locale}.json`)).json());
    }
    this.intl.setLocale(['en-us']);
    this.owner.register('component:badge-state', Component.extend({
      layout: precompileTemplate('<span>{{this.model.state}}</span>'),
    }));
    this.owner.register('component:action-menu', Component.extend({
      layout: precompileTemplate('<span data-test-driver-action-id={{this.model.id}}></span>'),
    }));
    await setupRenderingContext(this);
    this.records = [];
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.records.forEach((record) => destroyOwned(record));
    this.testRoot.remove();
  });

  for (let locale of ['en-us', 'zh-tw']) {
    test(`${locale}: real machine drivers sharing a generic icon render distinct native names and IDs`, async function(assert) {
      this.intl.setLocale([locale, 'en-us']);
      let names = ['hyperv', 'libvirt', 'vmwarefusion', 'virtualbox'];
      this.records = names.map((name, index) => MachineDriver.create({
        id: `1md${index + 1}`,
        name,
        state: 'active',
        builtin: false,
        actionLinks: {},
      }));
      this.arranged = A(this.records);

      assert.true(this.records.every((driver) => driver.get('catalogDisplayName') === undefined),
        'native machine driver models have no catalog-only display-name alias');
      await render(MachinePageTemplate);

      assert.deepEqual(findAll('.catalog-box.machine h5').map((heading) => heading.textContent.trim()), names,
        'each API name remains visible even when every provider icon is generic');
      assert.strictEqual(find('.header h1').textContent.trim(), locale === 'zh-tw' ? '主機驅動程式' : 'Machine Drivers',
        'the actual compiled page translation renders in the selected locale');
      assert.true(findAll('.catalog-box.machine h5').every((heading) => heading.clientWidth > 0 && heading.scrollWidth <= heading.clientWidth),
        'the driver names fit within their cards in a 320px container');
      assert.strictEqual(findAll('.catalog-box.machine .catalog-icon.generic').length, names.length,
        'equal icons do not collapse distinct resources');
      assert.deepEqual(findAll('[data-test-driver-action-id]').map((element) => element.getAttribute('data-test-driver-action-id')),
        this.records.map((driver) => driver.id), 'each action menu retains its original resource ID');

      this.records[1].set('name', 'renamed-libvirt');
      await settled();
      assert.strictEqual(findAll('.catalog-box.machine h5')[1].textContent.trim(), 'renamed-libvirt',
        'a native name change updates the rendered card');
      assert.strictEqual(this.records[1].id, '1md2', 'renaming leaves API identity unchanged');
    });
  }

  test('real catalog driver preserves localization and display-name formatting while locale changes', async function(assert) {
    this.driver = CatalogTemplate.create({
      id: 'community:machine*provider',
      name: 'PastureStack Provider',
      templateBase: 'machine',
      labels: {
        'io.pasturestack.catalog.name.zh-tw': 'PastureStack：雲端主機驅動',
      },
      intl: this.owner.lookup('service:intl'),
    });
    this.records.push(this.driver);
    await render(precompileTemplate('{{catalog-box model=this.driver showIcon=false showDescription=false}}'));

    assert.strictEqual(find('.catalog-box h5').textContent.trim(), 'Provider', 'English retains catalog formatting');
    this.intl.setLocale(['zh-tw', 'en-us']);
    await settled();
    assert.strictEqual(find('.catalog-box h5').textContent.trim(), '雲端主機驅動', 'Traditional Chinese retains the localized catalog name');
    assert.strictEqual(this.driver.id, 'community:machine*provider', 'localized presentation leaves catalog identity unchanged');
  });

  test('an intentionally empty catalog display name does not fall back to its raw branded name', async function(assert) {
    this.driver = CatalogTemplate.create({name: 'PastureStack / ', intl: this.owner.lookup('service:intl')});
    this.records.push(this.driver);
    await render(precompileTemplate('{{catalog-box model=this.driver showIcon=false showDescription=false}}'));

    assert.strictEqual(this.driver.get('catalogDisplayName'), '');
    assert.strictEqual(find('.catalog-box h5').textContent.trim(), '', 'existing empty catalog semantics are preserved');
  });
});
