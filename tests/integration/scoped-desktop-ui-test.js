import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { helper } from '@ember/component/helper';
import Service from '@ember/service';
import { run } from '@ember/runloop';
import { precompileTemplate } from '@ember/template-compilation';
import { find, findAll, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';

import HostTemplate from 'ui/host/template';
import SecretsIndexController from 'ui/secrets/index/controller';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../helpers/resolver';

module('Integration | UI | scoped desktop fixes', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    for (let locale of ['en-us', 'zh-tw']) {
      this.intl.addTranslations(locale, await (await fetch(`/translations/${locale}.json`)).json());
    }
    this.owner.register('service:prefs', Service.extend({tablePerPage: 25}));
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    if (this.secretsController) {
      run(() => this.secretsController.destroy());
    }
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('the real Host template hides denied Add Container and preserves an allowed host query', async function(assert) {
    // Only unrelated Host widgets and routing are inert. The production Host
    // template still supplies the capability conditional and exact LinkTo args.
    const Yielding = Component.extend({tagName: '', layout: precompileTemplate('{{yield}}')});
    this.owner.register('component:action-menu', Yielding);
    this.owner.register('component:link-to', Component.extend({
      tagName: 'a',
      layout: precompileTemplate('{{yield}}'),
      attributeBindings: ['route:data-route', 'hostId:data-host-id'],
      hostId: alias('query.hostId'),
    }));
    for (let name of ['power-select', 'select-dot', 'header-state', 'copy-ip', 'info-multi-stats']) {
      this.owner.register(`component:${name}`, Component.extend({tagName: 'span'}));
    }
    this.owner.register('helper:outlet', helper(() => null));
    this.host = EmberObject.create({id: 'synthetic-host', info: {osInfo: {kernelVersion: 'test'}}});
    this.model = {host: this.host, all: A([this.host])};
    this.actions = {changeHost() {}};
    this.intl.setLocale(['zh-tw', 'en-us']);
    this.set('canCreateContainer', false);

    await render(HostTemplate);
    assert.strictEqual(findAll('.header [data-route="containers.new"]').length, 0, 'denied or unloaded capability has no Add link');
    this.set('canCreateContainer', true);
    await settled();
    let add = find('.header [data-route="containers.new"]');
    assert.ok(add, 'the actual template exposes the creator entry');
    assert.strictEqual(add.getAttribute('data-host-id'), 'synthetic-host', 'LinkTo receives the exact selected Host ID');
    assert.strictEqual(add.textContent.trim(), this.intl.t('hostsPage.hostPage.addContainer.linkTo'));
    this.set('canCreateContainer', false);
    await settled();
    assert.strictEqual(findAll('.header [data-route="containers.new"]').length, 0, 'revoked capability removes an already-rendered entry');
    run(() => this.host.destroy());
  });

  test('real desktop table headers render the Secrets generic keys and follow locale changes', async function(assert) {
    this.secretsController = SecretsIndexController.create();
    this.headers = this.secretsController.get('headers');
    this.rows = A([]);
    this.intl.setLocale(['en-us']);

    await render(precompileTemplate('{{sortable-table headers=this.headers body=this.rows sortBy="name" paging=false bulkActions=false search=false}}'));
    let labels = () => findAll('thead tr.fixed-header > th').filter(node => node.getAttribute('data-column-role') !== 'actions').map(node => node.textContent.replace(/\s+/g, ' ').trim());
    assert.deepEqual(labels(), ['State', 'Name', 'Description', 'Created'], 'the real table retains English desktop labels');
    this.intl.setLocale(['zh-tw', 'en-us']);
    await settled();
    assert.deepEqual(labels(), ['狀態', '名稱', '描述', '建立'], 'the same real table headers react to Traditional Chinese');
    assert.strictEqual(findAll('thead tr.fixed-header > th[data-column-role="actions"]').length, 1, 'the unchanged actions column remains present');
  });
});
