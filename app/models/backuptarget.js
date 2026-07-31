import Resource from 'ember-api-store/models/resource';

import { computed } from '@ember/object';

var BackupTarget = Resource.extend({
  type: 'backupTarget',
  availableActions: computed('actionLinks.{restore,purge}', 'model.canDelete', function() {
    return [
      { label: 'action.remove',    icon: 'icon icon-trash',          action: 'promptDelete',      enabled: this.get('canDelete'), altAction: 'delete' },
      { divider: true },
      { label: 'action.viewInApi', icon: 'icon icon-external-link',  action: 'goToApi',           enabled: true },
    ];
  }),
});

export default BackupTarget;
