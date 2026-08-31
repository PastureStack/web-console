import { A } from '@ember/array';
import Controller from '@ember/controller';
import EmberObject, { computed } from '@ember/object';
import { service } from '@ember/service';
import moment from 'moment';

const OPTIONAL_FILTER_KEYS = ['eventType', 'description'];
const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (unused, index) => ({
  label: String(index + 1).padStart(2, '0'),
  value: index + 1,
}));
const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (unused, index) => ({
  label: String(index).padStart(2, '0'),
  value: index,
}));

function emptyFilters() {
  return {
    createdFrom        : null,
    createdTo          : null,
    level              : null,
    instanceId         : null,
    logScope           : 'all',
    eventType          : null,
    eventTypeOperator  : 'contains',
    description        : null,
    descriptionOperator: 'contains',
  };
}

function defaultTimeRange() {
  let end = moment();

  return {
    createdFrom : end.clone().subtract(24, 'hours').format('YYYY-MM-DDTHH:mm:ss'),
    createdTo   : end.format('YYYY-MM-DDTHH:mm:ss'),
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

function matchingTimePreset(fromValue, toValue) {
  if (!fromValue && !toValue) {
    return 'all';
  }
  let from = moment(fromValue);
  let to = moment(toValue);

  if (!from.isValid() || !to.isValid() || Math.abs(moment().diff(to, 'seconds')) > 90) {
    return 'custom';
  }
  return ({ 15: 'minutes15', 60: 'hour', 1440: 'day', 10080: 'week' })[to.diff(from, 'minutes')] || 'custom';
}

function selectedTimePart(value, part) {
  let current = moment(value);

  if (!current.isValid()) {
    return null;
  }
  switch (part) {
    case 'date':
      return current.format('YYYY-MM-DD');
    case 'hour':
      return current.hour() % 12 || 12;
    case 'minute':
      return current.minute();
    case 'period':
      return current.hour() >= 12 ? 'pm' : 'am';
    default:
      return null;
  }
}

export default Controller.extend({
  queryParams: [
    'createdFrom',
    'createdTo',
    'level',
    'instanceId',
    'logScope',
    'eventType',
    'eventTypeOperator',
    'description',
    'descriptionOperator',
  ],

  intl: service(),

  createdFrom         : null,
  createdTo           : null,
  level               : null,
  instanceId          : null,
  logScope            : 'all',
  eventType           : null,
  eventTypeOperator   : 'contains',
  description         : null,
  descriptionOperator : 'contains',
  filters             : null,
  optionalFilters     : null,
  filterError         : null,
  isFiltering         : false,
  isTimePickerOpen    : false,
  openDateCalendar    : null,
  activeTimePreset    : 'all',
  hourOptions         : TIME_HOUR_OPTIONS,
  minuteOptions       : TIME_MINUTE_OPTIONS,

  init() {
    this._super(...arguments);
    this.set('filters', emptyFilters());
    this.set('optionalFilters', A());
  },

  runFilterQuery(queryProperties) {
    let refreshIfUnchanged = Object.keys(queryProperties).every((key) => this.get(key) === queryProperties[key]);

    this.set('isFiltering', true);
    this.setProperties(queryProperties);
    this.send('filterLogs', { refreshIfUnchanged });
  },

  updateDatePart(field, value) {
    if (['createdFrom', 'createdTo'].indexOf(field) === -1) {
      return false;
    }
    let current = moment(this.get(`filters.${field}`));
    let selected = moment(value, 'YYYY-MM-DD', true);

    if (!current.isValid() || !selected.isValid()) {
      return false;
    }
    current.year(selected.year()).month(selected.month()).date(selected.date());
    this.set(`filters.${field}`, current.format('YYYY-MM-DDTHH:mm:ss'));
    this.set('activeTimePreset', 'custom');
    this.set('filterError', null);
    return true;
  },

  updateTimePart(field, part, value) {
    if (['createdFrom', 'createdTo'].indexOf(field) === -1) {
      return false;
    }
    let current = moment(this.get(`filters.${field}`));

    if (!current.isValid()) {
      return false;
    }
    if (part === 'hour') {
      let hour = Number(value);

      if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
        return false;
      }
      current.hour((hour % 12) + (current.hour() >= 12 ? 12 : 0));
    } else if (part === 'minute') {
      let minute = Number(value);

      if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
        return false;
      }
      current.minute(minute);
    } else if (part === 'period' && ['am', 'pm'].indexOf(value) >= 0) {
      if (value === 'pm' && current.hour() < 12) {
        current.add(12, 'hours');
      } else if (value === 'am' && current.hour() >= 12) {
        current.subtract(12, 'hours');
      }
    } else {
      return false;
    }
    this.set(`filters.${field}`, current.format('YYYY-MM-DDTHH:mm:ss'));
    this.set('activeTimePreset', 'custom');
    this.set('filterError', null);
    return true;
  },

  actions: {
    addFilter(key) {
      if (OPTIONAL_FILTER_KEYS.indexOf(key) >= 0 && this.get('optionalFilters').indexOf(key) === -1) {
        this.get('optionalFilters').pushObject(key);
      }
    },

    removeFilter(key) {
      this.get('optionalFilters').removeObject(key);
      this.set(`filters.${key}`, null);
      this.set(`filters.${key}Operator`, 'contains');
      this.set('filterError', null);
    },

    selectTextOperator(field, operatorOrEvent) {
      if (OPTIONAL_FILTER_KEYS.indexOf(field) === -1) {
        return;
      }
      let operator = operatorOrEvent && operatorOrEvent.target ? operatorOrEvent.target.value : operatorOrEvent;

      if (['contains', 'exact', 'startsWith', 'notEqual', 'notContains'].indexOf(operator) >= 0) {
        this.set(`filters.${field}Operator`, operator);
      }
    },

    selectLevel(option) {
      this.set('filters.level', option ? option.get('value') : null);
    },

    selectInstance(option) {
      this.set('filters.instanceId', option ? option.get('id') : null);
    },

    selectScope(option) {
      this.set('filters.logScope', option ? option.get('value') : 'all');
    },

    openTimePicker() {
      if (!this.get('filters.createdFrom') && !this.get('filters.createdTo')) {
        let range = defaultTimeRange();

        this.set('filters.createdFrom', range.createdFrom);
        this.set('filters.createdTo', range.createdTo);
        this.set('activeTimePreset', 'day');
      }
      this.setProperties({ isTimePickerOpen: true, openDateCalendar: null });
    },

    closeTimePicker() {
      this.setProperties({
        isTimePickerOpen : false,
        openDateCalendar : null,
        'filters.createdFrom': localDateTime(this.get('createdFrom')),
        'filters.createdTo': localDateTime(this.get('createdTo')),
      });
      this.set('activeTimePreset', matchingTimePreset(this.get('createdFrom'), this.get('createdTo')));
    },

    acceptTimePicker() {
      if (this.get('timeRangeInvalid')) {
        this.set('filterError', this.get('intl').t('servicePage.logTab.filter.rangeError'));
        return;
      }
      this.setProperties({ isTimePickerOpen: false, openDateCalendar: null, filterError: null });
    },

    setTimePreset(amount, unit) {
      let end = moment();

      this.set('filters.createdFrom', end.clone().subtract(amount, unit).format('YYYY-MM-DDTHH:mm:ss'));
      this.set('filters.createdTo', end.format('YYYY-MM-DDTHH:mm:ss'));
      this.set('activeTimePreset', ({
        '15-minutes': 'minutes15',
        '1-hour': 'hour',
        '24-hours': 'day',
        '7-days': 'week',
      })[`${amount}-${unit}`] || 'custom');
      this.set('filterError', null);
    },

    setTimePart(field, part, value) {
      this.updateTimePart(field, part, value);
    },

    toggleDateCalendar(field, open) {
      if (['createdFrom', 'createdTo'].indexOf(field) >= 0) {
        this.set('openDateCalendar', open ? field : null);
      }
    },

    setDatePart(field, value) {
      if (this.updateDatePart(field, value)) {
        this.set('openDateCalendar', null);
      }
    },

    applyShortcut(preset) {
      let range = defaultTimeRange();

      this.set('filters.createdTo', range.createdTo);
      if (preset === 'recent') {
        this.set('filters.createdFrom', moment().subtract(1, 'hour').format('YYYY-MM-DDTHH:mm:ss'));
        this.set('activeTimePreset', 'hour');
      } else if (preset === 'restarts') {
        this.set('filters.createdFrom', range.createdFrom);
        this.set('filters.eventType', 'service.instance.restart');
        this.set('filters.eventTypeOperator', 'exact');
        this.set('activeTimePreset', 'day');
        if (this.get('optionalFilters').indexOf('eventType') === -1) {
          this.get('optionalFilters').pushObject('eventType');
        }
      } else if (preset === 'errors') {
        this.set('filters.createdFrom', range.createdFrom);
        this.set('filters.level', 'error');
        this.set('activeTimePreset', 'day');
      } else {
        return;
      }
      this.send('search');
    },

    search() {
      if (this.get('timeRangeInvalid')) {
        this.set('filterError', this.get('intl').t('servicePage.logTab.filter.rangeError'));
        return;
      }
      this.set('filterError', null);
      this.runFilterQuery({
        createdFrom         : isoDateTime(this.get('filters.createdFrom')),
        createdTo           : isoDateTime(this.get('filters.createdTo')),
        level               : this.get('filters.level'),
        instanceId          : this.get('filters.instanceId'),
        logScope            : this.get('filters.logScope') || 'all',
        eventType           : this.get('filters.eventType'),
        eventTypeOperator   : this.get('filters.eventTypeOperator') || 'contains',
        description         : this.get('filters.description'),
        descriptionOperator : this.get('filters.descriptionOperator') || 'contains',
      });
    },

    clearAll() {
      this.set('filters', emptyFilters());
      this.set('optionalFilters', A());
      this.set('activeTimePreset', 'all');
      this.runFilterQuery({
        createdFrom         : null,
        createdTo           : null,
        level               : null,
        instanceId          : null,
        logScope            : 'all',
        eventType           : null,
        eventTypeOperator   : 'contains',
        description         : null,
        descriptionOperator : 'contains',
      });
    },
  },

  syncDraftFromQuery() {
    let filters = emptyFilters();

    filters.createdFrom = localDateTime(this.get('createdFrom'));
    filters.createdTo = localDateTime(this.get('createdTo'));
    filters.level = this.get('level');
    filters.instanceId = this.get('instanceId');
    filters.logScope = this.get('logScope') || 'all';
    filters.eventType = this.get('eventType');
    filters.eventTypeOperator = this.get('eventTypeOperator') || 'contains';
    filters.description = this.get('description');
    filters.descriptionOperator = this.get('descriptionOperator') || 'contains';

    let optionalFilters = A();

    if (filters.eventType) {
      optionalFilters.pushObject('eventType');
    }
    if (filters.description) {
      optionalFilters.pushObject('description');
    }
    this.setProperties({
      filters,
      optionalFilters,
      activeTimePreset : matchingTimePreset(filters.createdFrom, filters.createdTo),
      filterError      : null,
      isFiltering      : false,
    });
  },

  filterDefinitions: function() {
    let intl = this.get('intl');

    return OPTIONAL_FILTER_KEYS.map((key) => EmberObject.create({
      key,
      label: intl.t(`servicePage.logTab.filter.conditions.${key}`),
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

  levelOptions: function() {
    let intl = this.get('intl');

    return ['info', 'warn', 'error'].map((value) => EmberObject.create({
      value,
      label: intl.t(`servicePage.logTab.filter.levels.${value}`),
    }));
  }.property('intl._locale'),

  scopeOptions: function() {
    let intl = this.get('intl');

    return ['all', 'root', 'sub'].map((value) => EmberObject.create({
      value,
      label: intl.t(`servicePage.logTab.filter.scopes.${value}`),
    }));
  }.property('intl._locale'),

  instanceOptions: function() {
    return (this.get('model.service.instances') || []).map((instance) => {
      let label = String(instance.get('displayName') || instance.get('name') || '').trim();

      if (!label) {
        return null;
      }
      return EmberObject.create({ id: instance.get('id'), label, searchText: label });
    }).filter(Boolean).sort((a, b) => a.get('label').localeCompare(b.get('label')));
  }.property('model.service.instances.[]', 'model.service.instances.@each.{displayName,name}'),

  selectedLevel: function() {
    return this.get('levelOptions').findBy('value', this.get('filters.level'));
  }.property('levelOptions.[]', 'filters.level'),

  selectedInstance: function() {
    return this.get('instanceOptions').findBy('id', this.get('filters.instanceId'));
  }.property('instanceOptions.[]', 'filters.instanceId'),

  selectedScope: function() {
    return this.get('scopeOptions').findBy('value', this.get('filters.logScope') || 'all');
  }.property('scopeOptions.[]', 'filters.logScope'),

  timeRangeSummary: function() {
    let from = moment(this.get('filters.createdFrom'));
    let to = moment(this.get('filters.createdTo'));

    if (!from.isValid() || !to.isValid()) {
      return this.get('intl').t('servicePage.logTab.filter.allTime');
    }
    return `${from.format('YYYY/MM/DD HH:mm')} – ${to.format('YYYY/MM/DD HH:mm')}`;
  }.property('filters.createdFrom', 'filters.createdTo', 'intl._locale'),

  appliedRangeSummary: function() {
    let from = moment(this.get('createdFrom'));
    let to = moment(this.get('createdTo'));

    if (!from.isValid() || !to.isValid()) {
      return this.get('intl').t('servicePage.logTab.filter.allTime');
    }
    return `${from.format('YYYY/MM/DD HH:mm')} – ${to.format('YYYY/MM/DD HH:mm')}`;
  }.property('createdFrom', 'createdTo', 'intl._locale'),

  createdFromDate: computed('filters.createdFrom', {
    get() { return selectedTimePart(this.get('filters.createdFrom'), 'date'); },
    set(key, value) { this.updateDatePart('createdFrom', value); return value; },
  }),

  createdToDate: computed('filters.createdTo', {
    get() { return selectedTimePart(this.get('filters.createdTo'), 'date'); },
    set(key, value) { this.updateDatePart('createdTo', value); return value; },
  }),

  createdFromHour: function() { return selectedTimePart(this.get('filters.createdFrom'), 'hour'); }.property('filters.createdFrom'),
  createdFromMinute: function() { return selectedTimePart(this.get('filters.createdFrom'), 'minute'); }.property('filters.createdFrom'),
  createdFromPeriod: function() { return selectedTimePart(this.get('filters.createdFrom'), 'period'); }.property('filters.createdFrom'),
  createdToHour: function() { return selectedTimePart(this.get('filters.createdTo'), 'hour'); }.property('filters.createdTo'),
  createdToMinute: function() { return selectedTimePart(this.get('filters.createdTo'), 'minute'); }.property('filters.createdTo'),
  createdToPeriod: function() { return selectedTimePart(this.get('filters.createdTo'), 'period'); }.property('filters.createdTo'),

  periodOptions: function() {
    return [
      { label: this.get('intl').t('auditLogsPage.filterBuilder.timeDialog.am'), value: 'am' },
      { label: this.get('intl').t('auditLogsPage.filterBuilder.timeDialog.pm'), value: 'pm' },
    ];
  }.property('intl._locale'),

  timeZoneLabel: function() {
    return `UTC${moment().format('Z')}`;
  }.property(),

  timeRangeInvalid: function() {
    let fromValue = this.get('filters.createdFrom');
    let toValue = this.get('filters.createdTo');

    if (!fromValue && !toValue) {
      return false;
    }
    let from = moment(fromValue);
    let to = moment(toValue);

    return !fromValue || !toValue || !from.isValid() || !to.isValid() || !from.isBefore(to);
  }.property('filters.createdFrom', 'filters.createdTo'),

  activeFilterCount: function() {
    let count = 0;

    if (this.get('createdFrom') && this.get('createdTo')) { count++; }
    if (this.get('level')) { count++; }
    if (this.get('instanceId')) { count++; }
    if (this.get('logScope') && this.get('logScope') !== 'all') { count++; }
    if (this.get('eventType')) { count++; }
    if (this.get('description')) { count++; }
    return count;
  }.property('createdFrom', 'createdTo', 'level', 'instanceId', 'logScope', 'eventType', 'description'),

  resultCount: function() {
    return this.get('model.logs.length') || 0;
  }.property('model.logs.length'),

  showPagination: function() {
    let pagination = this.get('model.logs.pagination');

    return Boolean(pagination && pagination.next);
  }.property('model.logs.pagination'),
});
