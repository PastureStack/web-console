import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';

import { computed } from '@ember/object';

var Account = Resource.extend(PolledResource, {
  type: 'account',
  modalService: service('modal'),

  reservedKeys: ['_allPasswords'],

  actions: {
    deactivate() {
      return this.doAction('deactivate');
    },

    activate() {
      return this.doAction('activate');
    },

    edit: function() {
      this.get('modalService').toggleModal('edit-account', this);
    },
  },

  availableActions: computed(
    'actionLinks.{update,activate,deactivate,restore,remove,purge}',
    function() {
      var a = this.get('actionLinks');

      return [
        { label: 'action.activate',   icon: 'icon icon-play',         action: 'activate',     enabled: !!a.activate },
        { label: 'action.deactivate', icon: 'icon icon-pause',        action: 'deactivate',   enabled: !!a.deactivate },
        { label: 'action.remove',     icon: 'icon icon-trash',        action: 'promptDelete', enabled: !!a.remove, altAction: 'delete' },
        { divider: true },
        { label: 'action.purge',      icon: '',                       action: 'purge',        enabled: !!a.purge },
        { label: 'action.restore',    icon: '',                       action: 'restore',      enabled: !!a.restore },
        { divider: true },
        { label: 'action.edit',       icon: 'icon icon-edit',         action: 'edit',         enabled: !!a.update },
        { label: 'action.viewInApi',  icon: 'icon icon-external-link',action: 'goToApi',      enabled: true },
      ];
    }
  ),

  username: computed('passwordCredential.publicValue', function() {
    return this.get('passwordCredential.publicValue');
  }),

  passwordCredential: computed('passwords.@each.kind', function() {
    return (this.get('passwords')||[]).objectAt(0);
  }),

  _allPasswords: null,
  passwords: computed('_allPasswords.@each.accountId', 'id', function() {
    let all = this.get('_allPasswords');
    if ( !all ) {
      all = this.get('store').all('password');
      this.set('_allPasswords', all);
    }

    return all.filterBy('accountId', this.get('id'));
  }),
});

Account.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default Account;
