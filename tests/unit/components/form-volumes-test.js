import Ember from 'ember';
import { module, test } from 'qunit';

import FormVolumesComponent from 'ui/components/form-volumes/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | form volumes');

function intlStub() {
  return Ember.Object.create({
    _locale: 'en-us',
    t(key, values) {
      if ( values && values.path ) {
        return `${key}:${values.path}`;
      }
      if ( values && values.value ) {
        return `${key}:${values.value}`;
      }
      return key;
    },
  });
}

function resource(values) {
  return Ember.Object.create(values);
}

function createComponent(properties) {
  let component;
  Ember.run(() => {
    component = createOwned(FormVolumesComponent, Object.assign({
      renderer: inertRenderer(),
      intl: intlStub(),
      projects: Ember.Object.create({current: Ember.Object.create({isWindows: false})}),
      instance: resource({
        dataVolumes: Ember.A(),
        dataVolumesFrom: Ember.A(),
        dataVolumesFromLaunchConfigs: Ember.A(),
        requestedHostId: null,
        volumeDriver: null,
      }),
      primaryService: resource({name: 'app', secondaryLaunchConfigs: Ember.A()}),
      launchConfigIndex: -1,
      allHosts: Ember.A(),
      allStorageDrivers: Ember.A(),
      allStoragePools: Ember.A(),
      allVolumes: Ember.A(),
      allServices: Ember.A(),
      scheduleVolumePreflight() {},
    }, properties || {}), 'component');
  });
  return component;
}

test('driver choices hide secret drivers and disable incomplete NFS coverage', function(assert) {
  let hosts = Ember.A([
    resource({id: '1h1', state: 'active'}),
    resource({id: '1h2', state: 'active'}),
  ]);
  let nfs = resource({
    id: '1sd4',
    name: 'pasturestack-nfs',
    state: 'active',
    scope: 'environment',
    volumeAccessMode: 'multiHostRW',
    volumeCapabilities: Ember.A(),
  });
  let secret = resource({
    id: '1sd10',
    name: 'secret-driver',
    state: 'active',
    scope: 'local',
    volumeCapabilities: Ember.A(['secrets']),
  });
  let pools = Ember.A([
    resource({
      state: 'active',
      storageDriverId: '1sd4',
      driverName: 'pasturestack-nfs',
      hostIds: Ember.A(['1h1']),
    }),
  ]);
  let component = createComponent({
    allHosts: hosts,
    allStorageDrivers: Ember.A([nfs, secret]),
    allStoragePools: pools,
  });
  let choices = component.get('storageDriverChoices');

  assert.deepEqual(choices.mapBy('value'), ['', 'pasturestack-nfs'], 'keeps local and non-secret choices only');
  assert.ok(choices.findBy('value', 'pasturestack-nfs').disabled, 'blocks incomplete environment coverage');

  Ember.run(() => pools[0].set('hostIds', Ember.A(['1h1', '1h2'])));
  assert.notOk(component.get('storageDriverChoices').findBy('value', 'pasturestack-nfs').disabled, 'enables NFS after every active host is covered');
  assert.ok(component.get('storageDriverChoices').findBy('value', 'pasturestack-nfs').detail.includes('multiHostRW'), 'shows the access mode in driver details');
  destroyOwned(component);
});

test('pasturestack-nfs requires environment scope and multi-host read-write access', function(assert) {
  let hosts = Ember.A([resource({id: '1h1', state: 'active'})]);
  let nfs = resource({
    id: '1sd4',
    name: 'pasturestack-nfs',
    state: 'active',
    scope: 'local',
    volumeAccessMode: 'singleHostRW',
    volumeCapabilities: Ember.A(),
  });
  let pools = Ember.A([resource({
    state: 'active',
    storageDriverId: '1sd4',
    driverName: 'pasturestack-nfs',
    hostIds: Ember.A(['1h1']),
  })]);
  let component = createComponent({
    allHosts: hosts,
    allStorageDrivers: Ember.A([nfs]),
    allStoragePools: pools,
  });

  assert.equal(component.get('storageDriverChoices').findBy('value', 'pasturestack-nfs').disabledReason, 'invalidNfsContract');

  Ember.run(() => nfs.setProperties({scope: 'environment', volumeAccessMode: 'singleHostRW'}));
  assert.equal(component.get('storageDriverChoices').findBy('value', 'pasturestack-nfs').disabledReason, 'invalidNfsContract');

  Ember.run(() => nfs.set('volumeAccessMode', 'multiHostRW'));
  assert.notOk(component.get('storageDriverChoices').findBy('value', 'pasturestack-nfs').disabled);
  destroyOwned(component);
});

test('autocomplete candidates include existing service mounts before generated paths', function(assert) {
  let service = resource({
    launchConfig: resource({dataVolumes: Ember.A(['shared:/srv/shared', '/etc/app:/config:ro'])}),
    secondaryLaunchConfigs: Ember.A([
      resource({dataVolumes: Ember.A(['sidekick-data:/data'])}),
    ]),
  });
  let component = createComponent({allServices: Ember.A([service])});
  let suggestions = component.get('volumePathSuggestions');

  assert.deepEqual(
    suggestions.filterBy('priority', 0).mapBy('value'),
    ['shared:/srv/shared', '/etc/app:/config:ro', 'sidekick-data:/data'],
    'collects primary and sidekick mount specifications from the current environment'
  );
  assert.ok(suggestions.findBy('value', '/data').priority > 0, 'keeps generic paths at lower priority');
  destroyOwned(component);
});

test('validation rejects duplicate targets and unavailable selected drivers', function(assert) {
  let instance = resource({
    dataVolumes: Ember.A(['one:/data', 'two:/data']),
    dataVolumesFrom: Ember.A(),
    dataVolumesFromLaunchConfigs: Ember.A(),
    requestedHostId: null,
    volumeDriver: 'missing-driver',
  });
  let component = createComponent({instance});

  component.validate();
  assert.ok(component.get('errors').some((item) => item.indexOf('formVolumes.errors.duplicateTarget') === 0));
  assert.ok(component.get('errors').includes('formVolumes.errors.driverUnavailable'));
  assert.ok(component.get('storageDriverChoices').findBy('value', 'missing-driver').disabled, 'preserves the legacy value visibly');
  destroyOwned(component);
});

test('late preflight responses cannot overwrite the newest result', function(assert) {
  let first = Ember.RSVP.defer();
  let second = Ember.RSVP.defer();
  let calls = 0;
  let project = resource({
    actionLinks: {volumepreflight: '/v2-beta/projects/1a5?action=volumepreflight'},
    hasAction(name) {
      return name === 'volumepreflight';
    },
    doAction() {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    },
  });
  let component = createComponent({projects: resource({current: project})});

  component._preflightSequence = 1;
  let firstRequest = component.runVolumePreflight(1);
  component._preflightSequence = 2;
  let secondRequest = component.runVolumePreflight(2);

  second.resolve({status: 'available', issues: []});
  return secondRequest.then(() => {
    assert.equal(component.get('preflightStatus'), 'available');
    first.resolve({status: 'blocked', issues: [{reasonCode: 'late'}]});
    return firstRequest;
  }).then(() => {
    assert.equal(component.get('preflightStatus'), 'available', 'ignores the older response');
    destroyOwned(component);
  });
});
