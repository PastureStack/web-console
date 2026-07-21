export function localizedCatalogField(labels, locale, field, fallback) {
  let selected = Array.isArray(locale) ? locale[0] : locale;

  selected = (selected || '').toLowerCase().replace(/_/g, '-');
  if (!selected || !labels || !field) {
    return fallback;
  }

  let value = labels[`io.pasturestack.catalog.${field}.${selected}`];
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  return value.trim();
}
