import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import { refreshUnallocatedVolumeRelations } from 'ui/utils/unallocated-volumes';
import { volumeFixture } from '../utils/unallocated-volumes-test';

module('Unit | Model | unallocated local volume actions', function() {
  test('deactivate requires a real advertised action, empty relationships and current environment', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume({actionLinks: {deactivate: '/volume?action=deactivate', remove: '/volume?action=remove'}});
    const projects = EmberObject.create({current: EmberObject.create({id: '1a2540'}),
      schemaProjectId: '1a2540', schemaLoadGeneration: 1});
    volume.set('projects', projects);
    let requests = 0;
    volume.doAction = (action) => { assert.strictEqual(action, 'deactivate'); requests++; return resolve(volume); };
    const enabled = () => volume.get('availableActions').find((action) => action.action === 'deactivate').enabled;
    const stop = () => volume.actions.deactivate.call(volume);
    try {
      assert.false(enabled(), 'a missing relationship does not authorize an operation');
      await stop();
      assert.strictEqual(requests, 0);
      await refreshUnallocatedVolumeRelations([volume], '1a2540');
      assert.true(enabled());
      await stop();
      assert.strictEqual(requests, 1, 'only the genuine advertised action is called');
      volume.set('actionLinks', {remove: '/volume?action=remove'});
      assert.false(enabled(), 'GET-only or revoked actions cannot retain the old button');
      await stop();
      volume.set('actionLinks', {deactivate: '/volume?action=deactivate'});
      volume.set('externalId', 'docker-owned-volume');
      assert.false(enabled(), 'an external allocation revokes the cached capability');
      await stop();
      volume.set('externalId', null);
      projects.set('schemaProjectId', null);
      assert.false(enabled(), 'a missing schema owner fails closed');
      await stop();
      projects.set('schemaProjectId', '1a2540');
      projects.set('current.id', '1a2541');
      assert.false(enabled(), 'a switched environment cannot act on the previous volume');
      await stop();
      assert.strictEqual(requests, 1);
      projects.set('current.id', '1a2540');
      f.store.incrementProperty('generation');
      assert.false(enabled(), 'the same project cannot reuse a previous generation proof');
      await stop();
      assert.strictEqual(requests, 1);
    } finally { projects.destroy(); f.dispose(); }
  });

  test('late inactive mounts revoke the button and are rechecked at actual dispatch', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume({actionLinks: {deactivate: '/volume?action=deactivate'}});
    const projects = EmberObject.create({current: EmberObject.create({id: '1a2540'}),
      schemaProjectId: '1a2540', schemaLoadGeneration: 1});
    volume.set('projects', projects);
    let requests = 0;
    volume.doAction = () => { requests++; return resolve(volume); };
    try {
      await refreshUnallocatedVolumeRelations([volume], '1a2540');
      assert.true(volume.get('canDeactivateUnallocated'), 'initial confirmed empty relationships permit stopping');
      const mount = run(() => f.store._typeify({type: 'mount', id: '1m-late', volumeId: volume.get('id'),
        instanceId: 'not-loaded', state: 'inactive'}));
      assert.false(volume.get('canDeactivateUnallocated'), 'inactive mount events revoke cached UI capability');
      await volume.actions.deactivate.call(volume);
      assert.strictEqual(requests, 0, 'a stale menu cannot send deactivate on an owned workload volume');
      run(() => f.store._remove('mount', mount));
      assert.true(volume.get('canDeactivateUnallocated'));
      volume.set('storagePools', undefined);
      await volume.actions.deactivate.call(volume);
      assert.strictEqual(requests, 0, 'dispatch directly rechecks unknown relationships');
    } finally { projects.destroy(); f.dispose(); }
  });
});
