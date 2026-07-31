import { computed, observer } from '@ember/object';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import C from 'ui/utils/constants';

export default Controller.extend({
  bulkActionHandler: service(),
  bulkActionsList: C.BULK_ACTIONS,
  sortBy: 'name',
  prefs: service(),

  queryParams: ['sortBy'],

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

  actions: {
    applyBulkAction: function(name, selectedElements) {
      if ( selectedElements.length === 1 ) {
        selectedElements.objectAt(0).send(name);
      } else {
        this.get('bulkActionHandler')[name](selectedElements);
      }
    },
  },

  headers: [
    {
      classNames: '',
      name: 'stateSort',
      searchField: 'displayState',
      sort: ['stateSort','name','id'],
      translationKey: 'containersPage.index.table.header.state',
      width: '125px'
    },
    {
      name: 'name',
      sort: ['name','id'],
      translationKey: 'containersPage.index.table.header.name',
    },
    {
      name: 'displayIp',
      sort: ['displayIp','name','id'],
      width: '110px',
      translationKey: 'containersPage.index.table.header.ip',
    },
    {
      name: 'primaryHost.displayName',
      sort: ['primaryHost.displayName','name','id'],
      translationKey: 'containersPage.index.table.header.host',
    },
    {
      name: 'imageUuid',
      sort: ['imageUuid','id'],
      translationKey: 'containersPage.index.table.header.image',
    },
    {
      name: 'command',
      sort: ['command','name','id'],
      translationKey: 'containersPage.index.table.header.command',
    },
    {
      isActions: true,
      width: '110px',
    },
  ],

  // showChanged should be an observer rather then init to correctly set the showSystem checkbox
  // if showSystem is set on init show does not contain the correct qp as the router has not set it
  // so the checkbox never gets set
  showChanged: observer('show', function() {
    this.set('showSystem', this.get('show') === 'all');
  }),

  showSystemChanged: observer('showSystem', function() {
    this.set('show', (this.get('showSystem') ? 'all' : 'standard'));
  }),

  filtered: computed('model.@each.system', 'showSystem', function() {
    let all = this.get('model');
    if ( this.get('showSystem') ) {
      return all;
    } else {
      return all.filterBy('isSystem', false);
    }
  }),

});
