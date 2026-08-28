import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { service } from '@ember/service';
import { alias } from '@ember/object/computed';
import Controller, { inject as controller } from '@ember/controller';
import moment from 'moment';
import Sortable from 'ui/mixins/sortable';
import C from 'ui/utils/constants';

const OPTIONAL_FILTER_KEYS = ['eventType', 'description', 'resource', 'clientIp', 'authType'];

function emptyFilters() {
  return {
    accountId                : null,
    authType                 : null,
    authenticatedAsAccountId : null,
    clientIp                 : null,
    createdFrom              : null,
    createdTo                : null,
    description              : null,
    descriptionOperator      : 'contains',
    eventType                : null,
    eventTypeOperator        : 'contains',
    resourceId               : null,
    resourceType             : null,
  };
}

function localDateTime(value) {
  if (!value) {
    return null;
  }

  let parsed = moment(value);

  return parsed.isValid() ? parsed.format('YYYY-MM-DDTHH:mm:ss') : null;
}

function isoDateTime(value) {
  if (!value) {
    return null;
  }

  let parsed = moment(value);

  return parsed.isValid() ? parsed.toISOString() : null;
}

export default Controller.extend(Sortable, {
  application : controller(),
  queryParams : [
    'sortBy',
    'sortOrder',
    'eventType',
    'eventTypeOperator',
    'description',
    'descriptionOperator',
    'resourceType',
    'resourceId',
    'clientIp',
    'authType',
    'createdFrom',
    'createdTo',
    'accountId',
    'authenticatedAsAccountId',
  ],

  sortableContent : alias('model.auditLog'),
  modalService    : service('modal'),
  intl            : service(),

  sortBy                   : 'id',
  sortOrder                : 'desc',
  descending               : true,
  limit                    : 100,
  eventType                : null,
  eventTypeOperator        : 'contains',
  description              : null,
  descriptionOperator      : 'contains',
  resourceType             : null,
  resourceId               : null,
  clientIp                 : null,
  authType                 : null,
  createdFrom              : null,
  createdTo                : null,
  accountId                : null,
  authenticatedAsAccountId : null,
  authTypes                : null,
  filters                  : null,
  optionalFilters          : null,
  filterError              : null,

  init() {
    this._super(...arguments);
    this.set('filters', emptyFilters());
    this.set('optionalFilters', A());
  },

  actions: {
    addFilter(key) {
      if (OPTIONAL_FILTER_KEYS.indexOf(key) >= 0 && this.get('optionalFilters').indexOf(key) === -1) {
        this.get('optionalFilters').pushObject(key);
      }
    },

    removeFilter(key) {
      this.get('optionalFilters').removeObject(key);
      this.clearOptionalFilter(key);
      this.set('filterError', null);
    },

    selectTextOperator(field, operator) {
      if (['eventType', 'description'].indexOf(field) === -1) {
        return;
      }

      this.set(`filters.${field}Operator`, operator);
    },

    selectEnvironment(environment) {
      this.set('filters.accountId', environment ? environment.get('id') : null);
    },

    selectUser(user) {
      this.set('filters.authenticatedAsAccountId', user ? user.get('id') : null);
    },

    updateResourceType(type) {
      this.set('filters.resourceType', type || null);
    },

    updateAuthType(type) {
      this.set('filters.authType', type ? type.get('name') : null);
    },

    setTimePreset(amount, unit) {
      let end = moment();

      this.set('filters.createdFrom', end.clone().subtract(amount, unit).format('YYYY-MM-DDTHH:mm:ss'));
      this.set('filters.createdTo', end.format('YYYY-MM-DDTHH:mm:ss'));
      this.set('filterError', null);
    },

    changeSort(name) {
      this._super(name);
    },

    search() {
      if (this.get('timeRangeInvalid')) {
        this.set('filterError', this.get('intl').t('auditLogsPage.filterBuilder.rangeError'));
        return;
      }

      this.set('filterError', null);
      this.setProperties({
        accountId                : this.get('filters.accountId'),
        authType                 : this.get('filters.authType'),
        authenticatedAsAccountId : this.get('filters.authenticatedAsAccountId'),
        clientIp                 : this.get('filters.clientIp'),
        createdFrom              : isoDateTime(this.get('filters.createdFrom')),
        createdTo                : isoDateTime(this.get('filters.createdTo')),
        description              : this.get('filters.description'),
        descriptionOperator      : this.get('filters.descriptionOperator') || 'contains',
        eventType                : this.get('filters.eventType'),
        eventTypeOperator        : this.get('filters.eventTypeOperator') || 'contains',
        resourceId               : this.get('filters.resourceId'),
        resourceType             : this.get('filters.resourceType'),
      });
      this.send('filterLogs');
    },

    showResponseObjects(request, response) {
      this.get('modalService').toggleModal('modal-auditlog-info', {
        requestObject  : request,
        responseObject : response,
      });
    },

    clearAll() {
      this.set('filters', emptyFilters());
      this.set('optionalFilters', A());
      this.setProperties({
        accountId                : null,
        authType                 : null,
        authenticatedAsAccountId : null,
        clientIp                 : null,
        createdFrom              : null,
        createdTo                : null,
        description              : null,
        descriptionOperator      : 'contains',
        eventType                : null,
        eventTypeOperator        : 'contains',
        filterError              : null,
        resourceId               : null,
        resourceType             : null,
        sortBy                   : 'id',
        sortOrder                : 'desc',
      });
      this.send('filterLogs');
    },
  },

  syncDraftFromQuery() {
    let filters = emptyFilters();

    filters.accountId = this.get('accountId');
    filters.authType = this.get('authType');
    filters.authenticatedAsAccountId = this.get('authenticatedAsAccountId');
    filters.clientIp = this.get('clientIp');
    filters.createdFrom = localDateTime(this.get('createdFrom'));
    filters.createdTo = localDateTime(this.get('createdTo'));
    filters.description = this.get('description');
    filters.descriptionOperator = this.get('descriptionOperator') || 'contains';
    filters.eventType = this.get('eventType');
    filters.eventTypeOperator = this.get('eventTypeOperator') || 'contains';
    filters.resourceId = this.get('resourceId');
    filters.resourceType = this.get('resourceType');

    let optional = A();

    if (filters.eventType) {
      optional.pushObject('eventType');
    }
    if (filters.description) {
      optional.pushObject('description');
    }
    if (filters.resourceType || filters.resourceId) {
      optional.pushObject('resource');
    }
    if (filters.clientIp) {
      optional.pushObject('clientIp');
    }
    if (filters.authType) {
      optional.pushObject('authType');
    }

    this.setProperties({
      filters,
      optionalFilters: optional,
      filterError: null,
    });
  },

  clearOptionalFilter(key) {
    switch (key) {
      case 'eventType':
        this.set('filters.eventType', null);
        this.set('filters.eventTypeOperator', 'contains');
        break;
      case 'description':
        this.set('filters.description', null);
        this.set('filters.descriptionOperator', 'contains');
        break;
      case 'resource':
        this.set('filters.resourceId', null);
        this.set('filters.resourceType', null);
        break;
      case 'clientIp':
        this.set('filters.clientIp', null);
        break;
      case 'authType':
        this.set('filters.authType', null);
        break;
    }
  },

  filterDefinitions: function() {
    let intl = this.get('intl');

    return OPTIONAL_FILTER_KEYS.map((key) => EmberObject.create({
      key,
      label: intl.t(`auditLogsPage.filterBuilder.conditions.${key}`),
    }));
  }.property('intl._locale'),

  availableFilterDefinitions: function() {
    let active = this.get('optionalFilters') || [];

    return this.get('filterDefinitions').filter((definition) => active.indexOf(definition.get('key')) === -1);
  }.property('filterDefinitions.[]', 'optionalFilters.[]'),

  hasAvailableFilters: function() {
    return this.get('availableFilterDefinitions.length') > 0;
  }.property('availableFilterDefinitions.length'),

  textOperators: function() {
    let intl = this.get('intl');

    return ['contains', 'exact', 'startsWith', 'notEqual', 'notContains'].map((key) => EmberObject.create({
      key,
      label: intl.t(`auditLogsPage.filterBuilder.operators.${key}`),
    }));
  }.property('intl._locale'),

  environmentOptions: function() {
    return (this.get('model.projects') || [])
      .filter((project) => String(project.get('type') || '').toLowerCase() === 'project')
      .map((project) => {
        let label = String(project.get('displayName') || project.get('name') || '').trim();

        if (!label) {
          return null;
        }

        return EmberObject.create({
          id: project.get('id'),
          label,
          searchText: label,
        });
      })
      .filter(Boolean)
      .sort((left, right) => left.get('label').localeCompare(right.get('label')));
  }.property('model.projects.@each.{displayName,name,type}'),

  userOptions: function() {
    return (this.get('model.accounts') || [])
      .filter((account) => ['admin', 'user'].indexOf(String(account.get('kind') || '').toLowerCase()) >= 0)
      .map((account) => {
        let name = String(account.get('name') || '').trim();
        let username = String(account.get('username') || '').trim();
        let label = name || username;
        let detail = name && username && name !== username ? username : null;

        if (!label) {
          return null;
        }

        return EmberObject.create({
          id: account.get('id'),
          label,
          detail,
          searchText: [name, username].filter(Boolean).join(' '),
        });
      })
      .filter(Boolean)
      .sort((left, right) => left.get('label').localeCompare(right.get('label')));
  }.property('model.accounts.@each.{id,kind,name,username}'),

  selectedEnvironment: function() {
    let id = this.get('filters.accountId');

    return this.get('environmentOptions').find((environment) => environment.get('id') === id);
  }.property('environmentOptions.[]', 'filters.accountId'),

  selectedUser: function() {
    let id = this.get('filters.authenticatedAsAccountId');

    return this.get('userOptions').find((user) => user.get('id') === id);
  }.property('userOptions.[]', 'filters.authenticatedAsAccountId'),

  selectedAuthType: function() {
    let name = this.get('filters.authType');

    return (this.get('authTypes') || []).find((authType) => authType.get('name') === name);
  }.property('authTypes.[]', 'filters.authType'),

  timeRangeInvalid: function() {
    let from = this.get('filters.createdFrom');
    let to = this.get('filters.createdTo');

    if (!from || !to) {
      return false;
    }

    let fromMoment = moment(from);
    let toMoment = moment(to);

    return !fromMoment.isValid() || !toMoment.isValid() || fromMoment.isAfter(toMoment);
  }.property('filters.createdFrom', 'filters.createdTo'),

  activeFilterCount: function() {
    let filters = this.get('filters');
    let count = 0;

    if (filters.createdFrom || filters.createdTo) {
      count++;
    }
    if (filters.accountId) {
      count++;
    }
    if (filters.authenticatedAsAccountId) {
      count++;
    }

    this.get('optionalFilters').forEach((key) => {
      if ((key === 'resource' && (filters.resourceType || filters.resourceId)) ||
          (key !== 'resource' && filters[key])) {
        count++;
      }
    });

    return count;
  }.property(
    'filters.{accountId,authType,authenticatedAsAccountId,clientIp,createdFrom,createdTo,description,eventType,resourceId,resourceType}',
    'optionalFilters.[]'
  ),

  setup: function() {
    var out = [];
    var intl = this.get('intl');
    var activeLocales = this.get('intl._locale');

    // The controller can be created while an expired session is returning to
    // the login route. Ember Intl cannot translate until setLocale() has run;
    // the locale observer below will populate these choices immediately after
    // language bootstrap completes.
    if (!intl || !activeLocales || !activeLocales.length) {
      this.set('authTypes', out);
      return;
    }

    Object.keys(C.AUTH_TYPES).forEach((key) => {
      var val = C.AUTH_TYPES[key];
      if (val !== C.AUTH_TYPES.HeaderAuth && val !== C.AUTH_TYPES.TokenAccount) {
        out.push(EmberObject.create({name: key, value: intl.t(val)}));
      }
    });

    this.set('authTypes', out);
  }.on('init').observes('intl._locale'),

  setSortOrderObserver: function() {
    var out = 'asc';

    if (this.get('descending')) {
      out = 'desc';
    }

    this.set('sortOrder', out);
    this.send('logsSorted');
  }.observes('descending'),

  showPagination: function() {
    var pagination = this.get('model.auditLog.pagination');

    return Boolean(pagination && pagination.next);
  }.property('model.auditLog.pagination'),

  // Implemented here because the page uses the sortable actions but server-side data.
  arranged: function() {},
});
