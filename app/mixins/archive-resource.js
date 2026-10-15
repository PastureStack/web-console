import { computed, get } from '@ember/object';
import Mixin from '@ember/object/mixin';
import { service } from '@ember/service';
import { systemResource } from 'ui/utils/archive';

const SERVICE_TYPES = ['service', 'loadbalancerservice', 'dnsservice', 'externalservice',
  'networkdriverservice', 'storagedriverservice'];

export default Mixin.create({
  modalService: service('modal'),
  projects: service(),

  isArchived: computed('archived', function() {
    return this.get('archived') === true;
  }),

  archiveSupported: computed('type', function() {
    let type = (this.get('type') || '').toLowerCase();
    return type === 'stack' || SERVICE_TYPES.includes(type);
  }),

  archiveSystemResource: computed('system', 'group', 'data.{system,isSystem}', 'launchConfig.labels', 'type',
    'stack.system', 'stack.group', 'stack.data.{system,isSystem}', function() {
    let type = (this.get('type') || '').toLowerCase();
    return systemResource(this) || systemResource(this.get('stack')) ||
      ['networkdriverservice', 'storagedriverservice'].includes(type);
  }),

  archiveFieldSupported: computed('type', 'store.generation', 'store.baseUrl',
    'projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration', function() {
      let projectId = this.get('projects.current.id');
      if ( !projectId || this.get('projects.schemaProjectId') !== projectId ) {
        return false;
      }
      let store = this.get('store');
      let schema = store && store.getById('schema', (this.get('type') || '').toLowerCase());
      let field = schema && get(schema, 'resourceFields.archived');
      return !!field && field.type === 'boolean' && field.read !== false && field.update === true;
    }),

  archiveCanUpdate: computed('archiveSupported', 'archiveFieldSupported', 'actionLinks.update', function() {
    return this.get('archiveSupported') && this.get('archiveFieldSupported') && !!this.get('actionLinks.update');
  }),

  archiveBlockReason: computed('archiveCanUpdate', 'archiveSystemResource', 'isArchived', 'archiveStopped', function() {
    if ( !this.get('archiveCanUpdate') ) {
      return 'archive.readOnly';
    }
    // Restoring also repairs archived system resources from older data.
    if ( this.get('isArchived') ) {
      return null;
    }
    if ( this.get('archiveSystemResource') ) {
      return 'archive.system';
    }
    return this.get('archiveStopped') ? null : 'archive.requiresStopped';
  }),

  archiveMenuAction: computed('archiveCanUpdate', 'archiveSystemResource', 'isArchived', function() {
    return {
      label: this.get('isArchived') ? 'archive.restore' : 'archive.action',
      icon: this.get('isArchived') ? 'icon icon-history' : 'icon icon-folder',
      action: 'promptArchive',
      // A running resource opens an explanation with a disabled submit button.
      enabled: this.get('archiveCanUpdate') &&
        (this.get('isArchived') || !this.get('archiveSystemResource')),
    };
  }),

  actions: {
    promptArchive() {
      if ( this.get('archiveMenuAction.enabled') ) {
        this.get('modalService').toggleModal('modal-confirm-archive', {
          originalModel: this,
          archived: !this.get('isArchived'),
        });
      }
    },
  },
});
