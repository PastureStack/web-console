import Component from '@ember/component';
import { computed, observer } from '@ember/object';
import { service } from '@ember/service';

const FIRST_WEEKDAY = {
  'de-de'   : 1,
  'en-us'   : 0,
  'fa-ir'   : 6,
  'fil-ph'  : 0,
  'fr-fr'   : 1,
  'hu-hu'   : 1,
  'ja-jp'   : 0,
  'ko-kr'   : 0,
  'pt-br'   : 0,
  'ru-ru'   : 1,
  'uk-ua'   : 1,
  'zh-hans' : 1,
  'zh-tw'   : 0,
};

function normalizedLocale(locale) {
  let value = Array.isArray(locale) ? locale[0] : locale;

  return String(value || 'en-us').replace(/_/g, '-').toLowerCase();
}

function formatterLocale(locale) {
  let candidate = normalizedLocale(locale);

  try {
    new Intl.DateTimeFormat(candidate).format(new Date(0));
    return candidate;
  } catch (error) {
    return 'en-us';
  }
}

function parseIsoDate(value) {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));

  if (!match) {
    return null;
  }

  let year = Number(match[1]);
  let month = Number(match[2]) - 1;
  let day = Number(match[3]);
  let date = new Date(Date.UTC(year, month, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

function isoDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function localToday() {
  let now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function calendarWeekStart(locale) {
  return FIRST_WEEKDAY[normalizedLocale(locale)] ?? 1;
}

export function localizedWeekdays(locale) {
  let resolvedLocale = formatterLocale(locale);
  let formatter = new Intl.DateTimeFormat(resolvedLocale, {
    weekday  : 'short',
    timeZone : 'UTC',
  });
  let firstDay = calendarWeekStart(locale);
  let sunday = Date.UTC(2024, 0, 7);

  return Array.from({ length: 7 }, (unused, index) => {
    let weekday = (firstDay + index) % 7;

    return formatter.format(new Date(sunday + (weekday * 86400000)));
  });
}

export function localizedMonthLabel(year, month, locale) {
  return new Intl.DateTimeFormat(formatterLocale(locale), {
    month    : 'long',
    timeZone : 'UTC',
    year     : 'numeric',
  }).format(new Date(Date.UTC(year, month, 1)));
}

export function localizedDateLabel(value, locale) {
  let date = parseIsoDate(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(formatterLocale(locale), {
    day      : '2-digit',
    month    : '2-digit',
    timeZone : 'UTC',
    year     : 'numeric',
  }).format(date);
}

export function buildCalendarWeeks(year, month, locale, selectedValue, todayValue = localToday()) {
  let firstOfMonth = new Date(Date.UTC(year, month, 1));
  let leadingDays = (firstOfMonth.getUTCDay() - calendarWeekStart(locale) + 7) % 7;
  let firstVisible = new Date(Date.UTC(year, month, 1 - leadingDays));
  let resolvedLocale = formatterLocale(locale);
  let dayFormatter = new Intl.NumberFormat(resolvedLocale, { useGrouping: false });
  let ariaFormatter = new Intl.DateTimeFormat(resolvedLocale, {
    day      : 'numeric',
    month    : 'long',
    timeZone : 'UTC',
    weekday  : 'long',
    year     : 'numeric',
  });
  let days = Array.from({ length: 42 }, (unused, index) => {
    let date = new Date(firstVisible.getTime() + (index * 86400000));
    let value = isoDate(date);

    return {
      ariaLabel  : ariaFormatter.format(date),
      dayLabel   : dayFormatter.format(date.getUTCDate()),
      inMonth    : date.getUTCMonth() === month,
      isSelected : value === selectedValue,
      isToday    : value === todayValue,
      value,
    };
  });

  return Array.from({ length: 6 }, (unused, index) => days.slice(index * 7, (index + 1) * 7));
}

export default Component.extend({
  intl : service(),

  tagName   : 'div',
  classNames: ['audit-date-picker'],

  value      : null,
  isOpen     : false,
  label      : '',
  dataTestId : null,
  onChange   : null,
  onToggle   : null,
  visibleYear: null,
  visibleMonth: null,

  init() {
    this._super(...arguments);
    this.syncVisibleMonth();
  },

  currentLocale: computed('intl._locale', function() {
    return normalizedLocale(this.get('intl._locale'));
  }),

  isRtl: computed('currentLocale', function() {
    return this.get('currentLocale') === 'fa-ir';
  }),

  displayValue: computed('value', 'currentLocale', function() {
    return localizedDateLabel(this.get('value'), this.get('currentLocale'));
  }),

  monthLabel: computed('visibleYear', 'visibleMonth', 'currentLocale', function() {
    return localizedMonthLabel(this.get('visibleYear'), this.get('visibleMonth'), this.get('currentLocale'));
  }),

  weekdayLabels: computed('currentLocale', function() {
    return localizedWeekdays(this.get('currentLocale'));
  }),

  calendarWeeks: computed('visibleYear', 'visibleMonth', 'value', 'currentLocale', function() {
    return buildCalendarWeeks(
      this.get('visibleYear'),
      this.get('visibleMonth'),
      this.get('currentLocale'),
      this.get('value')
    );
  }),

  openDidChange: observer('isOpen', function() {
    if (this.get('isOpen')) {
      this.syncVisibleMonth();
    }
  }),

  syncVisibleMonth() {
    let selected = parseIsoDate(this.get('value')) || parseIsoDate(localToday());

    this.setProperties({
      visibleYear  : selected.getUTCFullYear(),
      visibleMonth : selected.getUTCMonth(),
    });
  },

  moveMonth(offset) {
    let next = new Date(Date.UTC(this.get('visibleYear'), this.get('visibleMonth') + offset, 1));

    this.setProperties({
      visibleYear  : next.getUTCFullYear(),
      visibleMonth : next.getUTCMonth(),
    });
  },

  choose(value) {
    if (!parseIsoDate(value)) {
      return;
    }

    let onChange = this.get('onChange');
    let onToggle = this.get('onToggle');

    if (typeof onChange === 'function') {
      onChange(value);
    }
    if (typeof onToggle === 'function') {
      onToggle(false);
    }
  },

  keyDown(event) {
    if (event.key === 'Escape' && this.get('isOpen')) {
      let onToggle = this.get('onToggle');

      if (typeof onToggle === 'function') {
        onToggle(false);
      }
      event.preventDefault();
    }
  },

  actions: {
    toggle() {
      let nextOpen = !this.get('isOpen');
      let onToggle = this.get('onToggle');

      if (nextOpen) {
        this.syncVisibleMonth();
      }
      if (typeof onToggle === 'function') {
        onToggle(nextOpen);
      }
    },

    previousMonth() {
      this.moveMonth(-1);
    },

    nextMonth() {
      this.moveMonth(1);
    },

    selectDate(value) {
      this.choose(value);
    },

    selectToday() {
      this.choose(localToday());
    },
  },
});
