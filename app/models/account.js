import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';

function value(record, key) {
  if ( record && typeof record.get === 'function' ) {
    return record.get(key);
  }
  return record && record[key];
}

function nonEmpty(input) {
  let text = input === null || input === undefined ? '' : String(input).trim();
  return text || null;
}

var Account = Resource.extend(PolledResource, {
  type: 'account',
  modalService: service('modal'),

  reservedKeys: ['_allPasswords', '_authIdentityLinks'],

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

  availableActions: function() {
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
  }.property('actionLinks.{update,activate,deactivate,restore,remove,purge}'),

  username: function() {
    return this.get('passwordCredential.publicValue');
  }.property('passwordCredential.publicValue'),

  resolvedName: function() {
    let accountName = nonEmpty(this.get('name'));
    if ( accountName ) {
      return accountName;
    }

    let links = this.get('_authIdentityLinks') || [];
    for ( let link of links ) {
      for ( let key of ['name', 'login', 'externalId'] ) {
        let candidate = nonEmpty(value(link, key));
        if ( candidate ) {
          return candidate;
        }
      }
    }

    return nonEmpty(this.get('username')) || nonEmpty(this.get('externalId'));
  }.property('name', 'username', 'externalId', '_authIdentityLinks.[]', '_authIdentityLinks.@each.{name,login,externalId}'),

  passwordCredential: function() {
    return (this.get('passwords')||[]).objectAt(0);
  }.property('passwords.@each.kind'),

  _allPasswords: null,
  passwords: function() {
    let all = this.get('_allPasswords');
    if ( !all ) {
      all = this.get('store').all('password');
      this.set('_allPasswords', all);
    }

    return all.filterBy('accountId', this.get('id'));
  }.property('_allPasswords.@each.accountId','id'),
});

Account.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default Account;
