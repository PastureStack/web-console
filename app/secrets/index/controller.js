import { alias } from '@ember/object/computed';
import { computed, observer } from '@ember/object';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import C from 'ui/utils/constants';

export default Controller.extend({
  bulkActionHandler: service(),
  bulkActionsList: [
    {
      "label": "action.remove",
      "icon": "icon icon-trash",
      "action": "promptDelete",
      "altAction": "delete",
      "bulkActionName": "Delete",
    },
  ],
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
      this.get('bulkActionHandler')[name](selectedElements);
    },
  },

  headers: [
    {
      displayName: 'State',
      name: 'stateSort',
      sort: ['stateSort','name','id'],
      type: 'string',
      searchField: 'displayState',
      classNames: '',
      width: '125px'
    },
    {
      displayName: 'Name',
      name: 'name',
      sort: ['name','id'],
      type: 'string',
    },
    {
      displayName: 'Description',
      name: 'description',
      sort: ['description','name','id'],
      type: 'string',
    },
    {
      displayName: 'Created',
      name: 'created',
      sort: ['primaryHost.displayName','name','id'],
      searchField: false,
      type: 'string',
    },
    {
      displayName: 'Actions',
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

  sortableContent: alias('filtered'),
  filtered: computed('model.@each.system', 'showSystem', function() {
    let all = this.get('model');
    if ( this.get('showSystem') ) {
      return all;
    } else {
      return all.filterBy('isSystem', false);
    }
  }),

});
