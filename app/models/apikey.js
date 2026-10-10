import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';
import C from 'ui/utils/constants';

var ApiKey = Resource.extend(PolledResource,{

  type: 'apiKey',
  publicValue: null,
  secretValue: null,
  modalService: service('modal'),
  userStore: service('user-store'),

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

    audit: function() {
      if ( !this.get('auditSupported') ) { return; }
      return this.get('router').transitionTo('authenticated.project.api.keys', {
        queryParams: {targetKey: this.get('id')},
      });
    },
  },

  auditSupported: function() {
    let store = this.get('userStore');
    let schema = store && typeof store.getById === 'function' && store.getById('schema', 'apikey');
    return !!(this.get('id') && this.get('links.self') && schema && schema.get('resourceFields.apiKeyPolicy'));
  }.property('id', 'links.self', 'userStore.generation'),

  isForAccount: function() {
    return this.get('accountId') === this.get(`session.${C.SESSION.ACCOUNT_ID}`);
  }.property('accountId', `session.${C.SESSION.ACCOUNT_ID}`),

  displayName: function() {
    return this.get('name') || this.get('publicValue') || '('+this.get('id')+')';
  }.property('name','publicValue','id'),

  availableActions: function() {
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
      { label: 'apiKeyAudit.title',    icon: 'icon icon-history', action: 'audit',       enabled: this.get('auditSupported') },
    ];
  }.property('actionLinks.{update,activate,deactivate,restore,remove,purge}', 'auditSupported'),
});

ApiKey.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default ApiKey;
