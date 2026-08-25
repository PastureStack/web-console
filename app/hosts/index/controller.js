import { computed } from '@ember/object';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import C from 'ui/utils/constants';

export default Controller.extend({
  prefs: service(),

  mode        : 'grouped',
  queryParams : ['mode'],

  actions: {
    newContainer(hostId) {
      this.get('router').transitionTo('containers.new', {queryParams: {hostId: hostId}});
    },

  },

  showSystem: computed(`prefs.${C.PREFS.SHOW_SYSTEM}`, {
    get() {
      return this.get(`prefs.${C.PREFS.SHOW_SYSTEM}`) !== false;
    },

    set(key, value) {
      this.set(`prefs.${C.PREFS.SHOW_SYSTEM}`, value);
      return value;
    }
  }),

  show: computed('showSystem', function() {
    return this.get('showSystem') === false ? 'standard' : 'all';
  }),

  listLinkOptions: {
    route: 'hosts',
    options: {
      mode: 'dot',
    },
  },

  groupLinkOptions: {
    route: 'hosts',
    options: {
      mode: 'grouped',
    },
  }
});
