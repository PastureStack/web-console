import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';
import { denormalizeId } from 'ui/utils/api-store-references';

var Receiver = Resource.extend(PolledResource, {
  regularStore: service('store'),
  intl: service(),

  service: denormalizeId('opt.serviceId','service','regularStore'),

  displayKind: function() {
    return this.get('intl').t('hookPage.' + this.get('driver') + '.label');
  }.property('driver','intl._locale'),

  opt: function() {
    return this.get(this.get('driver')+'Config');
  }.property('driver','scaleServiceConfig'),

  displayService: function() {
    let service = this.get('regularStore').getById('service', this.get('opt.serviceId'));
    if ( service ) {
      return service.get('displayStack') +'/'+ service.get('displayName');
    } else {
      return '?';
    }
  }.property('opt.serviceId'),

  actions: {
    edit() {
      this.get('router').transitionTo('authenticated.project.api.hooks.edit-receiver', this.get('id'));
    },

    clone: function() {
      this.get('router').transitionTo('authenticated.project.api.hooks.new-receiver', {queryParams: {receiverId: this.get('id')}});
    },
  },

  availableActions: function() {
    let methods = this.get('schema.resourceMethods') || [];
    let canRead = methods.includes('GET') && this.hasLink('self');
    let canDelete = methods.includes('DELETE') && this.hasLink('self');
    let canClone = canRead && Boolean(this.get('store').canCreate('receiver'));
    var choices = [
      { label: 'action.remove',         icon: 'icon icon-trash',            action: 'promptDelete',   enabled: canDelete, altAction: 'delete'},
      { divider: true },
      { label: 'action.viewInApi',      icon: 'icon icon-external-link',    action: 'goToApi',        enabled: true },
      { label: 'action.clone',          icon: 'icon icon-copy',             action: 'clone',          enabled: canClone },
//      { label: 'action.edit',           icon: 'icon icon-edit',             action: 'edit',           enabled: true },
    ];

    return choices;
  }.property('schema.collectionMethods.[]','schema.resourceMethods.[]','links.self'),

  needsPolling: function() {
    return ['requested','activating','removing'].includes(this.get('state'));
  }.property('state'),
});

Receiver.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default Receiver;
