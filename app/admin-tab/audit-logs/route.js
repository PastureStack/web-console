import { cancel, later } from '@ember/runloop';
import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { hash } from 'rsvp';
import auditQueryError, { isAuthenticationFailure } from 'ui/utils/audit-query-error';

const INTERVALCOUNT = 15000;
const TEXT_OPERATORS = ['exact', 'contains', 'startsWith', 'notEqual', 'notContains'];

export default Route.extend({
  access: service(),
  queryParams: {
    sortBy: {
      refreshModel: true
    },
    sortOrder: {
      refreshModel: true
    },
    eventType: {
      refreshModel: true
    },
    resourceType: {
      refreshModel: true
    },
    resourceId: {
      refreshModel: true
    },
    clientIp: {
      refreshModel: true
    },
    authType: {
      refreshModel: true
    },
    interactionChannel: {
      refreshModel: true
    },
    createdFrom: {
      refreshModel: true
    },
    createdTo: {
      refreshModel: true
    },
    timeScope: {
      refreshModel: true
    },
    accountId: {
      refreshModel: true
    },
    authenticatedAsAccountId: {
      refreshModel: true
    },
    description: {
      refreshModel: true
    },
    eventTypeOperator: {
      refreshModel: true
    },
    descriptionOperator: {
      refreshModel: true
    }
  },

  timer   : null,
  userHasPaged : null,
  pollGeneration: 0,

  actions: {
    filterLogs(options = {}) {
      this.cancelLogUpdate();
      this.set('userHasPaged', false);
      if (options.refreshIfUnchanged) {
        this.refresh();
      }
    },

    logsSorted() {
      this.cancelLogUpdate();
      this.set('userHasPaged', false);
    },

    next() {
      this.cancelLogUpdate();
      this.set('userHasPaged', true);
      let model = this.controller.get('model');
      let generation = this.get('pollGeneration');
      let authGeneration = this.get('access').captureGeneration();

      if (!model.get('auditLog') || model.get('queryError')) {
        return;
      }
      this.controller.set('isFiltering', true);
      return model.get('auditLog').followPagination('next').then((response) => {
        if (this.isCurrentQuery(generation, model) && this.get('access').captureGeneration() === authGeneration) {
          this.controller.setProperties({'model.auditLog': response, isFiltering: false});
        }
      }, (error) => this.applyQueryFailure(error, generation, model, authGeneration));
    },

    first() {
      this.cancelLogUpdate();
      this.set('userHasPaged', false);
      return this.refresh();
    },

    retryAuditQuery() {
      this.cancelLogUpdate();
      this.set('userHasPaged', false);
      return this.refresh();
    },

    loading() {
      if (this.controller) {
        this.controller.set('isFiltering', true);
      }
      return true;
    },

    error() {
      if (this.controller) {
        this.controller.set('isFiltering', false);
      }
      return true;
    }
  },

  deactivate() {
    this.cancelLogUpdate();
    this.set('userHasPaged', false);
  },

  model(params) {
    this.cancelLogUpdate();

    let userStore = this.get('userStore');
    let resourceTypes = userStore.all('schema').filterBy('links.collection').map((schema) => schema.get('_id')).sort();

    return hash({
      query: this.loadAuditQuery(params),
      projects: userStore.find('project', null, {
        url: 'projects',
        filter: {all: 'true'},
        forceReload: true,
        removeMissing: true,
      }),
    }).then((result) => {
      return EmberObject.create({
        auditLog: result.query.auditLog,
        queryError: result.query.queryError,
        projects: result.projects,
        resourceTypes,
      });
    });
  },

  setupController(controller, model) {
    this._super(controller, model);
    controller.syncDraftFromQuery();
    this.scheduleLogUpdate();
  },

  loadAuditQuery(params) {
    return this.get('userStore').find('auditLog', null, this.parseFilters(params)).then(
      (auditLog) => ({auditLog, queryError: null}),
      (error) => {
        // Preserve passive authentication recovery. A rejected query is not
        // an empty successful collection, and must not hide the filter form.
        if (isAuthenticationFailure(error)) {
          throw error;
        }
        return {auditLog: null, queryError: auditQueryError(error)};
      }
    );
  },

  isCurrentQuery(generation, model) {
    return !this.isDestroying && !this.isDestroyed && this.controller &&
      generation === this.get('pollGeneration') && this.controller.get('model') === model;
  },

  applyQueryFailure(error, generation, model, authGeneration) {
    if (!this.isCurrentQuery(generation, model) || this.get('access').captureGeneration() !== authGeneration) {
      return;
    }
    this.cancelLogUpdate();
    this.controller.set('isFiltering', false);
    if (isAuthenticationFailure(error)) {
      this.send('sessionInvalid', null, true, null, authGeneration, 401);
      return;
    }
    // Never leave stale rows or a misleading zero-count summary visible as
    // the result of a failed query. Keep the query parameters for correction.
    this.controller.setProperties({
      'model.auditLog': null,
      'model.queryError': auditQueryError(error),
    });
  },

  scheduleLogUpdate() {
    cancel(this.get('timer'));
    this.set('timer', null);
    let model = this.controller && this.controller.get('model');

    if (!model || model.get('queryError') || !model.get('auditLog') || this.get('userHasPaged')) {
      return;
    }

    let generation = this.incrementProperty('pollGeneration');
    let authGeneration = this.get('access').captureGeneration();
    let timer = later(() => {
      var params = this.paramsFor('admin-tab.audit-logs');

      this.get('userStore').find('auditLog', null, this.parseFilters(params)).then((response) => {
        // Ignore a response from a poll that was cancelled by a new query,
        // sorting operation, pagination action, or route transition.
        if (this.isCurrentQuery(generation, model) && this.get('access').captureGeneration() === authGeneration &&
            this.get('timer') === timer && !this.get('userHasPaged')) {
          this.controller.set('model.auditLog', response);
          this.scheduleLogUpdate();
        }
      }, (error) => this.applyQueryFailure(error, generation, model, authGeneration));
    }, INTERVALCOUNT);

    this.set('timer', timer);
  },

  cancelLogUpdate() {
    cancel(this.get('timer'));
    this.set('timer', null);
    this.incrementProperty('pollGeneration');
  },

  parseFilters(params) {
    var returnValue = {
      filter      : {},
      limit       : 100,
      depaginate  : false,
      forceReload : true,
      url         : 'pasturestack/audit-logs',
    };

    if (!params) {
      return returnValue;
    }

    returnValue.sortBy = params.sortBy || 'created';
    returnValue.sortOrder = params.sortOrder || 'desc';

    this.addTextFilter(returnValue.filter, 'eventType', params.eventType, params.eventTypeOperator);
    this.addTextFilter(returnValue.filter, 'description', params.description, params.descriptionOperator);

    if (params.createdFrom) {
      returnValue.filter.created_gte = params.createdFrom;
    }
    if (params.createdTo) {
      returnValue.filter.created_lte = params.createdTo;
    }
    if (params.timeScope) {
      // The broker otherwise applies its default 24-hour window.
      returnValue.filter.timeScope = params.timeScope;
    }

    ['accountId', 'authenticatedAsAccountId', 'resourceType', 'resourceId', 'clientIp', 'authType', 'interactionChannel'].forEach((key) => {
      if (params[key]) {
        returnValue.filter[key] = params[key];
      }
    });

    return returnValue;
  },

  addTextFilter(filters, field, value, operator) {
    let trimmed = String(value || '').trim();
    let selectedOperator = TEXT_OPERATORS.indexOf(operator) >= 0 ? operator : 'contains';

    if (!trimmed) {
      return;
    }

    switch (selectedOperator) {
      case 'exact':
        filters[field] = trimmed;
        break;
      case 'startsWith':
        filters[`${field}_prefix`] = trimmed;
        break;
      case 'notEqual':
        filters[`${field}_ne`] = trimmed;
        break;
      case 'notContains':
        filters[`${field}_notlike`] = `%${trimmed}%`;
        break;
      default:
        filters[`${field}_like`] = `%${trimmed}%`;
        break;
    }
  },

});
