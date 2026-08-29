import { cancel, later } from '@ember/runloop';
import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { hash } from 'rsvp';

const INTERVALCOUNT = 15000;
const TEXT_OPERATORS = ['exact', 'contains', 'startsWith', 'notEqual', 'notContains'];

export default Route.extend({
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

  actions: {
    filterLogs() {
      this.cancelLogUpdate();
    },

    logsSorted() {
      this.cancelLogUpdate();
    },

    next() {
      this.cancelLogUpdate();
      this.set('userHasPaged', true);

      this.controller.model.auditLog.followPagination('next').then((response) => {
        this.controller.set('model.auditLog', response);
      });
    },

    first() {
      this.set('userHasPaged', false);
      this.refresh();
      this.scheduleLogUpdate();
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
      accounts: userStore.find('account', null, {
        filter: {kind_ne: ['service', 'agent']},
        forceReload: true,
      }),
      auditLog: userStore.find('auditLog', null, this.parseFilters(params)),
      passwords: userStore.find('password'),
      projects: userStore.find('project', null, {
        url: 'projects',
        filter: {all: 'true'},
        forceReload: true,
        removeMissing: true,
      }),
    }).then((result) => {
      return EmberObject.create({
        accounts: result.accounts,
        auditLog: result.auditLog,
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

  scheduleLogUpdate() {
    cancel(this.get('timer'));

    this.set('timer', later(() => {
      var params = this.paramsFor('admin-tab.audit-logs');

      this.get('userStore').find('auditLog', null, this.parseFilters(params)).then((response) => {
        // We can get into a state where the user paged but we have an unresolved promise from the previous
        // run. If thats the case we dont want to replace the page with this unresolved promise.
        if (!this.get('userHasPaged')) {

          this.controller.set('model.auditLog', response);
          if ( this.get('timer') ) {
            this.scheduleLogUpdate();
          }
        }
      }, (/* error */) => {});
    }, INTERVALCOUNT));
  },

  cancelLogUpdate() {
    cancel(this.get('timer'));
    this.set('timer', null);
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

    returnValue.sortBy = params.sortBy || 'id';
    returnValue.sortOrder = params.sortOrder || 'desc';

    this.addTextFilter(returnValue.filter, 'eventType', params.eventType, params.eventTypeOperator);
    this.addTextFilter(returnValue.filter, 'description', params.description, params.descriptionOperator);

    if (params.createdFrom) {
      returnValue.filter.created_gte = params.createdFrom;
    }
    if (params.createdTo) {
      returnValue.filter.created_lte = params.createdTo;
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
