import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import LoadBalancerService from 'ui/models/loadbalancerservice';
import C from 'ui/utils/constants';

module('Unit | Model | load balancer image');

test('shared candidate recomputes on reference, setting and action permission changes', function(assert) {
  let settings = EmberObject.create({[C.SETTING.BALANCER_IMAGE]: 'ghcr.io/pasturestack/load-balancer-service:v0.9.35'});
  let service = LoadBalancerService.create({settings,
    launchConfig: EmberObject.create({imageUuid: 'docker:ghcr.io/pasturestack/load-balancer-service:v0.9.34'}),
    actionLinks: {upgrade: '/loadbalancerservices/1s1?action=upgrade'},
  });
  assert.true(service.get('imageUpgradeAvailable'));
  assert.equal(service.get('imageUpgradeCandidate.toLabel'), 'v0.9.35');
  service.set('actionLinks', {});
  assert.false(service.get('imageUpgradeAvailable'), 'no resource action means no update entry');
  service.set('actionLinks', {upgrade: '/loadbalancerservices/1s1?action=upgrade'});
  settings.set(C.SETTING.BALANCER_IMAGE, 'ghcr.io/pasturestack/load-balancer-service:v0.9.34');
  assert.false(service.get('imageUpgradeAvailable'), 'same exact tag');
  settings.set(C.SETTING.BALANCER_IMAGE, 'ghcr.io/pasturestack/load-balancer-service:v0.9.35');
  service.set('launchConfig.imageUuid', 'docker:registry.example/team/custom-lb:v0.9.34');
  assert.false(service.get('imageUpgradeAvailable'), 'a platform setting cannot replace a custom repository');
  service.destroy(); settings.destroy();
});
