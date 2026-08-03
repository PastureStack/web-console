export function normalizeCatalogLocale(locale) {
  let selected = Array.isArray(locale) ? locale[0] : locale;

  selected = (selected || '').toLowerCase().replace(/_/g, '-');
  return selected;
}

export function mergeCatalogLocalizationLabels(cachedLabels, currentLabels) {
  return Object.assign({}, cachedLabels || {}, currentLabels || {});
}

export function localizedCatalogField(labels, locale, field, fallback) {
  let selected = normalizeCatalogLocale(locale);

  if (!selected || !labels || !field) {
    return fallback;
  }

  let value = labels[`io.pasturestack.catalog.${field}.${selected}`];
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

export function localizedCatalogQuestionField(labels, locale, variable, field, fallback) {
  if (!variable || !field) {
    return fallback;
  }

  return localizedCatalogField(
    labels,
    locale,
    `question.${String(variable).toLowerCase()}.${field}`,
    fallback
  );
}

export function localizedCatalogReadme(files, locale) {
  let selected = normalizeCatalogLocale(locale);

  if (!selected || !files) {
    return null;
  }

  let keys = Object.keys(files);
  let key = keys.find((candidate) => {
    return String(candidate).toLowerCase() === `readme.${selected}.md`;
  });

  if (!key) {
    key = keys.find((candidate) => {
      return String(candidate).toLowerCase() === 'readme.md';
    });
  }

  if (!key || typeof files[key] !== 'string' || !files[key].trim()) {
    return null;
  }

  return files[key];
}
