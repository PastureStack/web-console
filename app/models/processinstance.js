import { computed } from '@ember/object';
import Resource from 'ember-api-store/models/resource';

var ProcessInstance = Resource.extend({
  runTime: computed('startTime', 'endTime', function(){
    return moment(this.get('endTime')).diff(this.get('startTime'), 'seconds');
  }),

  typeAndId: computed('resourceType','resourceId', function() {
    return this.get('resourceType') + ':' + this.get('resourceId');
  }),

  availableActions: computed('actionLinks.replay', function() {
    var a = this.get('actionLinks');

    return [
      { label: 'action.replay',    icon: 'icon icon-refresh',      action: 'replay',  enabled: !!a.replay },
      { label: 'action.viewInApi', icon: 'icon icon-external-link',action: 'goToApi', enabled: true },
    ];
  }),
});

export default ProcessInstance;
