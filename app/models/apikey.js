import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

var ApiKey = Resource.extend(PolledResource,{

  type: 'apiKey',
  publicValue: null,
  secretValue: null,
  modalService: service('modal'),

  actions: {
    deactivate: function() {
      return this.doAction('deactivate');
    },

    activate: function() {
      return this.doAction('activate');
    },

    edit: function() {
      this.get('modalService').toggleModal('edit-apikey', this);
    },
  },

  isForAccount: computed('accountId', `session.${C.SESSION.ACCOUNT_ID}`, function() {
    return this.get('accountId') === this.get(`session.${C.SESSION.ACCOUNT_ID}`);
  }),

  displayName: computed('name', 'publicValue', 'id', function() {
    return this.get('name') || this.get('publicValue') || '('+this.get('id')+')';
  }),

  availableActions: computed(
    'actionLinks.{update,activate,deactivate,restore,remove,purge}',
    function() {
      var a = this.get('actionLinks');

      return [
        { label: 'action.activate',      icon: 'icon icon-play',   action: 'activate',     enabled: !!a.activate },
        { label: 'action.deactivate',    icon: 'icon icon-pause',  action: 'deactivate',   enabled: !!a.deactivate },
        { label: 'action.remove',        icon: 'icon icon-trash',  action: 'promptDelete', enabled: !!a.remove, altAction: 'delete' },
        { divider: true },
        { label: 'action.purge',         icon: '',                 action: 'purge',        enabled: !!a.purge },
        { label: 'action.restore',       icon: '',                 action: 'restore',      enabled: !!a.restore },
        { divider: true },
        { label: 'action.edit',          icon: 'icon icon-edit',   action: 'edit',         enabled: !!a.update },
      ];
    }
  ),
});

ApiKey.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default ApiKey;
