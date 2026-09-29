import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import StackHeader from 'ui/components/stack-header/component';
import StackSection from 'ui/components/stack-section/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | stack add permissions');

[
  ['header', StackHeader],
  ['section', StackSection],
].forEach(([name, Factory]) => {
  test(`${name} offers each service subtype only when its create schema allows it`, function(assert) {
    let allowed = new Set(['service']);
    let project = EmberObject.create({id: '1a21', isWindows: false, virtualMachine: true});
    let projects = EmberObject.create({
      current: project,
      schemaProjectId: '1a21',
      schemaLoadGeneration: 1,
      canCreateResource(type) {
        return this.get('current.id') === this.get('schemaProjectId') && allowed.has(type.toLowerCase());
      },
    });
    let component = createOwned(Factory, {
      projects,
      settings: EmberObject.create(),
      prefs: EmberObject.create(),
      model: EmberObject.create({id: '1st1'}),
      renderer: inertRenderer(),
    }, 'component');

    assert.deepEqual(component.get('createOptions'), {
      service: true, balancer: false, alias: false, external: false,
      vm: true, other: true, any: true,
    }, 'ordinary Service and VM use the service create capability');

    allowed = new Set(['loadbalancerservice', 'dnsservice']);
    projects.incrementProperty('schemaLoadGeneration');
    assert.deepEqual(component.get('createOptions'), {
      service: false, balancer: true, alias: true, external: false,
      vm: false, other: true, any: true,
    }, 'Balancer and Alias stay available without ordinary Service create');

    project.set('isWindows', true);
    assert.deepEqual(component.get('createOptions'), {
      service: false, balancer: false, alias: true, external: false,
      vm: false, other: true, any: true,
    }, 'Windows still suppresses Balancer and VM');

    allowed = new Set(['externalservice']);
    projects.incrementProperty('schemaLoadGeneration');
    assert.deepEqual(component.get('createOptions'), {
      service: false, balancer: false, alias: false, external: true,
      vm: false, other: true, any: true,
    }, 'External Service has its own create capability');

    projects.set('schemaProjectId', 'different-project');
    assert.false(component.get('createOptions.any'), 'stale schema grants no create entry');

    destroyOwned(component);
  });
});
