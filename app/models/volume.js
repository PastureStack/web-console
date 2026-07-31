import { notEmpty } from '@ember/object/computed';
import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import { denormalizeIdArray } from 'ember-api-store/utils/denormalize';

import { computed } from '@ember/object';

var Volume = Resource.extend({
  type: 'volume',
  modalService: service('modal'),

  mounts: denormalizeIdArray('mountIds'),
  snapshots: denormalizeIdArray('snapshotIds'),

  isRoot: notEmpty('instanceId'),

  actions: {
    snapshot() {
      this.get('modalService').toggleModal('modal-edit-snapshot', this);
      this.get('application').setProperties({
        editSnapshot: true,
        originalModel: this,
      });
    },
  },

  availableActions: computed('actionLinks.{restore,purge,remove}', function() {
    var a = this.get('actionLinks');

    return [
      { label: 'action.remove',           icon: 'icon icon-trash',          action: 'promptDelete',      enabled: !!a.remove, altAction: 'delete' },
      { divider: true },
      { label: 'action.viewInApi',        icon: 'icon icon-external-link',  action: 'goToApi',           enabled: true },
      { label: 'action.restore',          icon: '',                         action: 'restore',           enabled: !!a.restore },
      { label: 'action.purge',            icon: '',                         action: 'purge',             enabled: !!a.purge },
      { label: 'action.snapshot',         icon: 'icon icon-copy',           action: 'snapshot',          enabled: !!a.snapshot },
    ];
  }),

  displayUri: computed('uri', function() {
    return (this.get('uri')||'').replace(/^file:\/\//,'');
  }),
});

Volume.reopenClass({
  stateMap: {
    'active':           {icon: 'icon icon-hdd',    color: 'text-success'},
  },
});

export default Volume;
