import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import {
  find,
  render,
  select,
  setupContext,
  setupRenderingContext,
  teardownContext,
} from '@ember/test-helpers';
import { module, test } from 'qunit';

import FormBalancerRules from 'ui/components/form-balancer-rules/component';
import NewBalancer from 'ui/components/new-balancer/component';
import LbConfig from 'ui/models/lbconfig';
import LaunchConfig from 'ui/models/launchconfig';
import LoadBalancerService from 'ui/models/loadbalancerservice';
import PortRule from 'ui/models/portrule';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';
import resolver from '../../helpers/resolver';

module('Integration | Component | load balancer service target', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    let translations = await (await fetch('/translations/en-us.json')).json();
    this.intl.addTranslations('en-us', translations);
    this.intl.setLocale(['en-us']);

    let target = EmberObject.create({
      canBalanceTo: true,
      id: '1s-target',
      name: 'backend',
      stack: EmberObject.create({name: 'qa'}),
    });
    let choices = A([{
      group: 'QA',
      id: target.get('id'),
      name: target.get('name'),
      obj: target,
      stackName: 'qa',
    }]);
    this.owner.register('service:allServices', Service.extend({
      list: choices,
      byId(id) {
        return id === target.get('id') ? target : null;
      },
      group(list) {
        return {QA: list};
      },
    }));
    await setupRenderingContext(this);

    this.rule = PortRule.create({
      access: 'public',
      priority: 1,
      protocol: 'http',
      serviceId: null,
      sourcePort: 80,
      targetPort: 8080,
      type: 'portRule',
    });
    this.launchConfig = LaunchConfig.create({
      expose: A(),
      labels: {},
      ports: A(['80:80/tcp']),
      type: 'launchConfig',
    });
    this.lbConfig = LbConfig.create({
      certificateIds: A(),
      defaultCertificateId: null,
      portRules: A([this.rule]),
      type: 'lbConfig',
    });
    this.request = null;
    this.store = {
      getById(type, id) {
        if (type === 'schema' && id === 'portrule') {
          return {optionsFor() { return A(['http', 'https', 'udp']); }};
        }
      },
      request: (options) => {
        this.request = options;
        return Promise.resolve(this.service);
      },
    };
    this.userStore = {all() { return A(); }};
    this.service = LoadBalancerService.create({
      id: '1s-balancer',
      lbConfig: this.lbConfig,
      launchConfig: this.launchConfig,
      links: {self: '/v2-beta/projects/1a5/loadbalancerservices/1s-balancer'},
      store: this.store,
      type: 'loadBalancerService',
    });
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
    run(() => {
      this.service.destroy();
      this.lbConfig.destroy();
      this.launchConfig.destroy();
      this.rule.destroy();
    });
  });

  test('DOM selection reaches the PortRule and the editing PUT payload', async function(assert) {
    this.setProperties({
      service: this.service,
      store: this.store,
      userStore: this.userStore,
    });
    await render(precompileTemplate(
      '{{form-balancer-rules service=this.service store=this.store userStore=this.userStore editing=true}}'
    ));

    assert.ok(find('.input-service select'), 'the production service selector is rendered');
    await select('.input-service select', '1s-target');
    assert.equal(this.rule.get('serviceId'), '1s-target', 'the parent owns the selected service ID');

    let component;
    run(() => {
      component = createOwned(NewBalancer, {
        editing: true,
        intl: this.intl,
        renderer: inertRenderer(),
        service: this.service,
        settings: EmberObject.create(),
      }, 'component');
    });
    await component.doSave();

    assert.equal(this.request.method, 'PUT', 'editing uses the real resource update path');
    assert.equal(this.request.data.lbConfig.portRules[0].serviceId, '1s-target',
      'the selected backend is present in the submitted API payload');
    destroyOwned(component);
  });

  test('the parent action writes and clears the PortRule explicitly', function(assert) {
    let component = createOwned(FormBalancerRules, {
      intl: this.intl,
      renderer: inertRenderer(),
      service: this.service,
      store: this.store,
      userStore: this.userStore,
    }, 'component');

    component.send('setRuleService', this.rule, '1s-target');
    assert.equal(this.rule.get('serviceId'), '1s-target');
    component.send('setRuleService', this.rule, '');
    assert.strictEqual(this.rule.get('serviceId'), null);
    destroyOwned(component);
  });
});
