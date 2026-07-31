import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';

import { computed } from '@ember/object';

export default Resource.extend({
  modalService: service('modal'),
  actions: {
    edit: function() {
      this.get('modalService').toggleModal('edit-secret', this);
    },
  },

  availableActions: computed('actionLinks.{remove,update}', function() {
    var a = this.get('actionLinks');
    if ( !a )
    {
      return [];
    }

    var choices = [
      { label: 'action.remove',     icon: 'icon icon-trash',          action: 'promptDelete', enabled: !!a.remove, altAction: 'delete', bulkable: true },
      { divider: true },
      { label: 'action.viewInApi',  icon: 'icon icon-external-link',  action: 'goToApi',      enabled: true },
      { divider: true },
      { label: 'action.edit',       icon: 'icon icon-edit',           action: 'edit',         enabled: !!a.update || true },
    ];

    return choices;
  }),
});
