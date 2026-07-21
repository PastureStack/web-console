"use strict";

var FIELDS = ["second", "minute", "hour", "day", "month", "year"];
var STYLES = ["best fit", "numeric"];
var DEFAULT_THRESHOLDS = {
  second: 45,
  minute: 45,
  hour: 22,
  day: 26,
  month: 11,
};

function isArray(value) {
  return Array.isArray(value);
}

function normalizeLocales(locales) {
  if (typeof locales === "string") {
    return [locales];
  }
  if (isArray(locales)) {
    return locales.slice();
  }
  return [];
}

function dateNow() {
  return Date.now ? Date.now() : new Date().getTime();
}

function daysToYears(days) {
  return days * 400 / 146097;
}

function diffReport(from, to) {
  from = +from;
  to = +to;

  var millisecond = Math.round(to - from);
  var second = Math.round(millisecond / 1000);
  var minute = Math.round(second / 60);
  var hour = Math.round(minute / 60);
  var day = Math.round(hour / 24);
  var rawYears = daysToYears(day);
  var month = Math.round(rawYears * 12);
  var year = Math.round(rawYears);

  return {
    millisecond: millisecond,
    second: second,
    minute: minute,
    hour: hour,
    day: day,
    month: month,
    year: year,
  };
}

function canonicalizeLocale(locale) {
  if (typeof Intl !== "undefined" && typeof Intl.getCanonicalLocales === "function") {
    try {
      return Intl.getCanonicalLocales(locale)[0];
    } catch (err) {
      return locale;
    }
  }
  return locale;
}

function hasNativeRelativeTimeFormat() {
  return typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function";
}

function fallbackFormat(value, unit, style) {
  var abs = Math.abs(value);
  if (style !== "numeric") {
    if (unit === "second" && value === 0) {
      return "now";
    }
    if (unit === "day" && value === -1) {
      return "yesterday";
    }
    if (unit === "day" && value === 1) {
      return "tomorrow";
    }
  }

  var label = abs === 1 ? unit : unit + "s";
  if (value < 0) {
    return abs + " " + label + " ago";
  }
  if (value > 0) {
    return "in " + abs + " " + label;
  }
  return "now";
}

function IntlRelativeFormat(locales, options) {
  options = options || {};
  this._locales = normalizeLocales(locales);
  this._locale = this._resolveLocale(this._locales);
  this._options = {
    style: this._resolveStyle(options.style),
    units: this._isValidUnits(options.units) && options.units,
  };

  var self = this;
  this.format = function format(date, formatOptions) {
    return self._format(date, formatOptions);
  };
}

IntlRelativeFormat.__localeData__ = Object.create(null);
IntlRelativeFormat.__addLocaleData = function addLocaleData(data) {
  if (!(data && data.locale)) {
    throw new Error("Locale data provided to IntlRelativeFormat is missing a `locale` property value");
  }
  IntlRelativeFormat.__localeData__[String(data.locale).toLowerCase()] = data;
};
IntlRelativeFormat.defaultLocale = "en";
IntlRelativeFormat.thresholds = DEFAULT_THRESHOLDS;

IntlRelativeFormat.prototype.resolvedOptions = function resolvedOptions() {
  return {
    locale: this._locale,
    style: this._options.style,
    units: this._options.units,
  };
};

IntlRelativeFormat.prototype._format = function format(date, options) {
  var now = options && options.now !== undefined ? options.now : dateNow();
  if (date === undefined) {
    date = now;
  }
  if (!isFinite(now)) {
    throw new RangeError("The `now` option provided to IntlRelativeFormat#format() is not in valid range.");
  }
  if (!isFinite(date)) {
    throw new RangeError("The date value provided to IntlRelativeFormat#format() is not in valid range.");
  }

  var report = diffReport(now, date);
  var units = this._options.units || this._selectUnits(report);
  var value = report[units];
  var numeric = this._options.style === "numeric" ? "always" : "auto";

  if (hasNativeRelativeTimeFormat()) {
    return new Intl.RelativeTimeFormat(this._locale, {
      numeric: numeric,
      style: "long",
    }).format(value, units);
  }

  return fallbackFormat(value, units, this._options.style);
};

IntlRelativeFormat.prototype._isValidUnits = function isValidUnits(units) {
  if (!units || FIELDS.indexOf(units) >= 0) {
    return true;
  }
  if (typeof units === "string") {
    var suggestion = /s$/.test(units) && units.substr(0, units.length - 1);
    if (suggestion && FIELDS.indexOf(suggestion) >= 0) {
      throw new Error('"' + units + '" is not a valid IntlRelativeFormat `units` value, did you mean: ' + suggestion);
    }
  }
  throw new Error('"' + units + '" is not a valid IntlRelativeFormat `units` value, it must be one of: "' + FIELDS.join('", "') + '"');
};

IntlRelativeFormat.prototype._resolveLocale = function resolveLocale(locales) {
  var candidates = normalizeLocales(locales).concat(IntlRelativeFormat.defaultLocale);
  for (var i = 0; i < candidates.length; i++) {
    var locale = candidates[i];
    if (!locale) {
      continue;
    }
    if (hasNativeRelativeTimeFormat()) {
      var supported = Intl.RelativeTimeFormat.supportedLocalesOf([locale]);
      if (supported.length) {
        return canonicalizeLocale(supported[0]);
      }
    }
    var parts = String(locale).toLowerCase().split("-");
    while (parts.length) {
      var data = IntlRelativeFormat.__localeData__[parts.join("-")];
      if (data) {
        return data.locale;
      }
      parts.pop();
    }
  }
  return "en";
};

IntlRelativeFormat.prototype._resolveStyle = function resolveStyle(style) {
  if (!style) {
    return STYLES[0];
  }
  if (STYLES.indexOf(style) >= 0) {
    return style;
  }
  throw new Error('"' + style + '" is not a valid IntlRelativeFormat `style` value, it must be one of: "' + STYLES.join('", "') + '"');
};

IntlRelativeFormat.prototype._selectUnits = function selectUnits(report) {
  for (var i = 0; i < FIELDS.length; i++) {
    var units = FIELDS[i];
    if (Math.abs(report[units]) < IntlRelativeFormat.thresholds[units]) {
      return units;
    }
  }
  return "year";
};

module.exports = IntlRelativeFormat;
module.exports.default = IntlRelativeFormat;
