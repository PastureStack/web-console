import { notEmpty } from '@ember/object/computed';
import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import { hasMany } from 'ember-api-store/utils/denormalize';
import { denormalizeIdArray } from 'ui/utils/api-store-references';
import { isUnallocatedLocalVolume } from 'ui/utils/unallocated-volumes';

var Volume = Resource.extend({
  type: 'volume',
  modalService: service('modal'),
  projects: service(),

  mounts: denormalizeIdArray('mountIds'),
  allMounts: hasMany('id', 'mount', 'volumeId'),
  snapshots: denormalizeIdArray('snapshotIds'),

  isRoot: notEmpty('instanceId'),

  actions: {
    deactivate() {
      let projectId = this.get('projects.current.id');
      if ( !projectId || this.get('projects.schemaProjectId') !== projectId ||
        !this.get('actionLinks.deactivate') || !isUnallocatedLocalVolume(this, projectId) ) {
        return;
      }
      return this.doAction('deactivate');
    },

    snapshot() {
      this.get('modalService').toggleModal('modal-edit-snapshot', this);
      this.get('application').setProperties({
        editSnapshot: true,
        originalModel: this,
      });
    },
  },

  canDeactivateUnallocated: function() {
    let projectId = this.get('projects.current.id');
    // Register the existing live hasMany watcher before caching this capability.
    this.get('allMounts');
    return Boolean(projectId && this.get('projects.schemaProjectId') === projectId &&
      this.get('actionLinks.deactivate') && isUnallocatedLocalVolume(this, projectId));
  }.property('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration', 'store.generation', 'store.baseUrl',
    'actionLinks.deactivate', 'accountId', 'id', 'driver', 'state', 'removed', 'isNative', 'isHostPath',
    'imageId', 'instanceId', 'hostId', 'externalId', 'storagePoolIds.[]', 'storagePools.[]', 'mountIds.[]', 'mounts.[]', 'allMounts.[]'),

  availableActions: function() {
    var a = this.get('actionLinks');

    return [
      { label: 'action.deactivate',       icon: 'icon icon-pause',          action: 'deactivate',        enabled: this.get('canDeactivateUnallocated') },
      { label: 'action.remove',           icon: 'icon icon-trash',          action: 'promptDelete',      enabled: !!a.remove, altAction: 'delete' },
      { divider: true },
      { label: 'action.viewInApi',        icon: 'icon icon-external-link',  action: 'goToApi',           enabled: true },
      { label: 'action.restore',          icon: '',                         action: 'restore',           enabled: !!a.restore },
      { label: 'action.purge',            icon: '',                         action: 'purge',             enabled: !!a.purge },
      { label: 'action.snapshot',         icon: 'icon icon-copy',           action: 'snapshot',          enabled: !!a.snapshot },
    ];
  }.property('actionLinks.{restore,purge,remove}', 'canDeactivateUnallocated'),

  displayUri: function() {
    return (this.get('uri')||'').replace(/^file:\/\//,'');
  }.property('uri'),
});

Volume.reopenClass({
  stateMap: {
    'active':           {icon: 'icon icon-hdd',    color: 'text-success'},
  },
});

export default Volume;
