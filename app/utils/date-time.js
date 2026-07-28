export const DEFAULT_DATE_TIME_FORMAT = 'MMM DD, YYYY hh:mm:ss A';
export const TAIWAN_DATE_TIME_FORMAT = 'YYYY年M月D日 Ahh點mm分ss秒';
export const TAIWAN_TIME_FORMAT = 'Ahh點mm分ss秒';
export const PHILIPPINES_DATE_TIME_FORMAT = 'LL h:mm:ss A';
export const PHILIPPINES_TIME_FORMAT = 'h:mm:ss A';

const LOCALIZED_MOMENT_LOCALES = [
  'de', 'fa', 'fr', 'hu', 'ja', 'ko', 'pt-br', 'ru', 'tl-ph', 'uk', 'zh-cn'
];

const SECOND_LABELS = {
  de: 'Sek.',
  en: 'sec',
  fa: 'ثانیه',
  fr: 's',
  hu: 'mp',
  ja: '秒',
  ko: '초',
  'pt-br': 's',
  ru: 'с',
  'tl-ph': 'segundo',
  uk: 'с',
  'zh-cn': '秒',
  'zh-tw': '秒',
};

const COMPACT_SECOND_LOCALES = ['ja', 'ko', 'zh-cn', 'zh-tw'];

function currentMomentLocale() {
  let locale = moment.locale();

  return typeof locale === 'string' ? locale.toLowerCase() : 'en';
}

export function isTraditionalChinese() {
  return currentMomentLocale() === 'zh-tw';
}

export function formatDateTime(value, format) {
  let resolvedFormat = format || DEFAULT_DATE_TIME_FORMAT;
  const locale = currentMomentLocale();

  if ( locale === 'zh-tw' ) {
    if ( !format || format === DEFAULT_DATE_TIME_FORMAT ) {
      resolvedFormat = TAIWAN_DATE_TIME_FORMAT;
    } else if ( format === 'hh:mm:ss A' ) {
      resolvedFormat = TAIWAN_TIME_FORMAT;
    }
  } else if ( locale === 'tl-ph' ) {
    if ( !format || format === DEFAULT_DATE_TIME_FORMAT ) {
      resolvedFormat = PHILIPPINES_DATE_TIME_FORMAT;
    } else if ( format === 'hh:mm:ss A' ) {
      resolvedFormat = PHILIPPINES_TIME_FORMAT;
    }
  } else if ( LOCALIZED_MOMENT_LOCALES.includes(locale) ) {
    if ( !format || format === DEFAULT_DATE_TIME_FORMAT ) {
      resolvedFormat = 'LL LTS';
    } else if ( format === 'hh:mm:ss A' ) {
      resolvedFormat = 'LTS';
    }
  }

  // Moment instances retain the locale they were created with. Always apply
  // the active interface locale so switching languages updates existing rows.
  return moment(value).locale(locale).format(resolvedFormat);
}

export function formatDurationSeconds(value) {
  const locale = currentMomentLocale();
  const unit = SECOND_LABELS[locale] || SECOND_LABELS.en;
  const separator = COMPACT_SECOND_LOCALES.includes(locale) ? '' : ' ';

  return `${value}${separator}${unit}`;
}
