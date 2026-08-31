import { cancel, later } from '@ember/runloop';
import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

const INTERVALCOUNT = 15000;
const TEXT_OPERATORS = ['exact', 'contains', 'startsWith', 'notEqual', 'notContains'];

export default Route.extend({
  queryParams: {
    createdFrom: { refreshModel: true },
    createdTo: { refreshModel: true },
    level: { refreshModel: true },
    instanceId: { refreshModel: true },
    logScope: { refreshModel: true },
    eventType: { refreshModel: true },
    eventTypeOperator: { refreshModel: true },
    description: { refreshModel: true },
    descriptionOperator: { refreshModel: true },
  },

  timer          : null,
  userHasPaged   : false,
  pollGeneration : 0,

  actions: {
    filterLogs(options = {}) {
      this.cancelLogUpdate();
      this.set('userHasPaged', false);
      if (options.refreshIfUnchanged) {
        this.refresh();
      }
    },

    next() {
      this.cancelLogUpdate();
      this.set('userHasPaged', true);
      this.controller.model.logs.followPagination('next').then((response) => {
        this.controller.set('model.logs', response);
      });
    },

    first() {
      this.set('userHasPaged', false);
      this.refresh();
      this.scheduleLogUpdate();
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
    },
  },

  deactivate() {
    this.cancelLogUpdate();
    this.set('userHasPaged', false);
  },

  model(params) {
    this.cancelLogUpdate();
    let parent = this.modelFor('service');
    let service = parent.get('service');
    let serviceId = service.get('id');

    return this.get('store').find('serviceLog', null, this.parseFilters(serviceId, params)).then((logs) => {
      return EmberObject.create({
        service,
        stack : parent.get('stack'),
        logs,
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
    let generation = this.incrementProperty('pollGeneration');
    let timer = later(() => {
      let parent = this.modelFor('service');
      let serviceId = parent.get('service.id');
      let params = this.paramsFor('service.log');

      this.get('store').find('serviceLog', null, this.parseFilters(serviceId, params)).then((response) => {
        if (generation === this.get('pollGeneration') && this.get('timer') === timer && !this.get('userHasPaged')) {
          this.controller.set('model.logs', response);
          this.scheduleLogUpdate();
        }
      }, () => {});
    }, INTERVALCOUNT);

    this.set('timer', timer);
  },

  cancelLogUpdate() {
    cancel(this.get('timer'));
    this.set('timer', null);
    this.incrementProperty('pollGeneration');
  },

  parseFilters(serviceId, params = {}) {
    let query = {
      filter      : { serviceId },
      sortBy      : 'created',
      sortOrder   : 'desc',
      depaginate  : false,
      forceReload : true,
      limit       : 100,
    };

    if (params.createdFrom) {
      query.filter.created_gte = params.createdFrom;
    }
    if (params.createdTo) {
      query.filter.created_lte = params.createdTo;
    }
    if (params.level) {
      query.filter.level = params.level;
    }
    if (params.instanceId) {
      query.filter.instanceId = params.instanceId;
    }
    if (params.logScope === 'root') {
      query.filter.subLog = 'false';
    } else if (params.logScope === 'sub') {
      query.filter.subLog = 'true';
    }

    this.addTextFilter(query.filter, 'eventType', params.eventType, params.eventTypeOperator);
    this.addTextFilter(query.filter, 'description', params.description, params.descriptionOperator);
    return query;
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
