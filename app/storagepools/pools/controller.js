import Controller from '@ember/controller';
import { computed, observer } from '@ember/object';
import { service } from '@ember/service';
import { isUnallocatedLocalVolume, refreshUnallocatedVolumeRelations } from 'ui/utils/unallocated-volumes';

export default Controller.extend({
  projects: service(),
  growl: service(),
  intl: service(),

  init() {
    this._super(...arguments);
    this._volumeRelationErrors = new Set();
  },

  canCreateVolume: computed('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration', function() {
    return this.get('projects').canCreateResource('volume');
  }),

  // The store arrays remain live after the initial scoped reads.  Re-read the
  // actual relationship when a new volume arrives or its allocation changes.
  refreshVolumeRelations: observer('projects.current.id', 'store.generation', 'store.baseUrl', 'model.volumes.[]',
    'model.volumes.@each.{state,removed,driver,accountId,isNative,isHostPath,hostId,imageId,instanceId,externalId,links}', function() {
      refreshUnallocatedVolumeRelations(this.get('model.volumes') || [], this.get('projects.current.id'),
        this.get('intl').t('storagePoolsPage.unallocated.relationIncomplete')).catch((error) => {
        if (!this.isDestroying && !this.isDestroyed && !this._volumeRelationErrors.has(error)) {
          this._volumeRelationErrors.add(error);
          this.get('growl').fromError(this.get('intl').t('generic.error'), error);
        }
      });
    }),

  unallocatedVolumes: computed('projects.current.id', 'store.generation', 'store.baseUrl', 'model.volumes.[]',
    'model.volumes.@each.{id,accountId,driver,state,removed,isNative,isHostPath,hostId,imageId,instanceId,externalId,storagePools,mounts,mountIds,storagePoolIds}',
    'model.mounts.[]', 'model.mounts.@each.volumeId', function() {
      let projectId = this.get('projects.current.id');
      let seen = new Set();
      return (this.get('model.volumes') || []).filter((volume) => {
        let id = volume.get('id');
        if (seen.has(id) || !isUnallocatedLocalVolume(volume, projectId)) {
          return false;
        }
        seen.add(id);
        return true;
      });
    }),

  usefulPools: function() {
    return this.get('model.all').filter((pool) => {
      return !!pool.get('driverName');
    });
  }.property('model.all.@each.driverName'),
});
