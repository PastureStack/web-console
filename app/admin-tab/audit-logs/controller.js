import { service } from '@ember/service';
import { alias } from '@ember/object/computed';
import Controller, { inject as controller } from '@ember/controller';
import Sortable from 'ui/mixins/sortable';
import C from 'ui/utils/constants';

import { observer, computed } from '@ember/object';
import { on } from '@ember/object/evented';

export default Controller.extend(Sortable, {
  application       : controller(),
  queryParams       : ['sortBy', 'sortOrder', 'eventType', 'resourceType', 'resourceId', 'clientIp', 'authType'],

  sortableContent   : alias('model.auditLog'),
  resourceTypeAndId : null,
  modalService      : service('modal'),
  intl              : service(),

  actions: {
    updateResourceType: function(type) {
      this.set('filters.resourceType', type);
    },

    updateAuthType: function(type) {
      this.set('filters.authType', type.name);
      this.set('authTypeReadable', type.value);
    },

    changeSort: function(name) {
      this._super(name);
    },

    search: function() {
      this.setProperties({
        eventType    : this.get('filters.eventType'),
        resourceType : this.get('filters.resourceType'),
        resourceId   : this.get('filters.resourceId'),
        clientIp     : this.get('filters.clientIp'),
        authType     : this.get('filters.authType'),
      });
      this.send('filterLogs');
    },

    showResponseObjects: function(request, response) {
      this.get('modalService').toggleModal('modal-auditlog-info', {
        requestObject         : request,
        responseObject        : response,
      });
    },

    clearAll: function() {
      this.set('filters', {
        accountId                 : null,
        authType                  : null,
        authenticatedAsAccountId  : null,
        authenticatedAsIdentityId : null,
        created                   : null,
        clientIp                  : null,
        description               : null,
        eventType                 : null,
        id                        : null,
        kind                      : null,
        resourceId                : null,
        resourceType              : null,
        runtime                   : null,
      });

      this.setProperties({
        eventType: null,
        resourceType : null,
        resourceId   : null,
        clientIp     : null,
        authType     : null,
      });

      this.setProperties({
        sortBy    : 'id',
        sortOrder : 'desc',
      });
      this.set('authTypeReadable', null);
      this.send('filterLogs');
    },
  },

  sortBy           : 'id',
  sortOrder        : 'desc',
  descending       : true,
  limit            : 100,
  eventType        : null,
  resourceType     : null,
  resourceId       : null,
  clientIp         : null,
  authType         : null,
  authTypes        : null,
  authTypeReadable : null,
  filters: {
    accountId                 : null,
    authType                  : null,
    authenticatedAsAccountId  : null,
    authenticatedAsIdentityId : null,
    created                   : null,
    description               : null,
    eventType                 : null,
    clientIp                  : null,
    id                        : null,
    kind                      : null,
    resourceId                : null,
    resourceType              : null,
    runtime                   : null,
  },

  setup: observer('intl._locale', on('init', function() {
    var out = [];

    Object.keys(C.AUTH_TYPES).forEach((key) => {
      var val = C.AUTH_TYPES[key];
      if ( val !== C.AUTH_TYPES.HeaderAuth && val !== C.AUTH_TYPES.TokenAccount )
      {
        out.push({name: key, value: this.get('intl').t(val)});
      }
    });

    this.set('authTypes', out);
  })),

  setSortOrderObserver: observer('descending', function() {
    var out = 'asc';

    if (this.get('descending')) {
      out = 'desc';
    }

    this.set('sortOrder', out);
    this.send('logsSorted');

  }),

  resourceIdReady: computed('filters.resourceType', function() {
    if (this.get('filters.resourceType')) {
      return false;
    } else {
      return true;
    }
  }),

  showPagination: computed('model.auditLog.pagination', function() {
    var pagination = this.get('model.auditLog.pagination');

    if (pagination.next) {
      return true;
    } else {
      return false;
    }
  }),

  // implemented here cause we're using sortable kinda but not really. Basically want the
  // actions but not the implmentation
  arranged: function() {}

});
