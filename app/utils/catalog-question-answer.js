export function isCatalogQuestionAnswerMissing(value) {
  if ( value === null || value === undefined ) {
    return true;
  }

  if ( typeof value === 'string' ) {
    return value.trim().length === 0;
  }

  if ( Array.isArray(value) ) {
    return value.length === 0;
  }

  return false;
}
