import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';
import { denormalizeId } from 'ember-api-store/utils/denormalize';

import { computed } from '@ember/object';

var Receiver = Resource.extend(PolledResource, {
  regularStore: service('store'),
  intl: service(),

  service: denormalizeId('opt.serviceId','service','regularStore'),

  displayKind: computed('driver', 'intl._locale', function() {
    return this.get('intl').t('hookPage.' + this.get('driver') + '.label');
  }),

  opt: computed('driver', 'scaleServiceConfig', function() {
    return this.get(this.get('driver')+'Config');
  }),

  displayService: computed('opt.serviceId', function() {
    let service = this.get('regularStore').getById('service', this.get('opt.serviceId'));
    if ( service ) {
      return service.get('displayStack') +'/'+ service.get('displayName');
    } else {
      return '?';
    }
  }),

  actions: {
    edit() {
      this.get('router').transitionTo('authenticated.project.api.hooks.edit-receiver', this.get('id'));
    },

    clone: function() {
      this.get('router').transitionTo('authenticated.project.api.hooks.new-receiver', {queryParams: {receiverId: this.get('id')}});
    },
  },

  availableActions: computed('actionLinks.{update,remove}', function() {
    var choices = [
      { label: 'action.remove',         icon: 'icon icon-trash',            action: 'promptDelete',   enabled: true, altAction: 'delete'},
      { divider: true },
      { label: 'action.viewInApi',      icon: 'icon icon-external-link',    action: 'goToApi',        enabled: true },
      { label: 'action.clone',          icon: 'icon icon-copy',             action: 'clone',          enabled: true },
//      { label: 'action.edit',           icon: 'icon icon-edit',             action: 'edit',           enabled: true },
    ];

    return choices;
  }),

  needsPolling: computed('state', function() {
    return ['requested','activating','removing'].includes(this.get('state'));
  }),
});

Receiver.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default Receiver;
