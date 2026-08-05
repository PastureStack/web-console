const MAX_SPEC_LENGTH = 4096;
const VOLUME_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._@-]*$/;
const MODE_PART = /^[a-zA-Z]+$/;
const ALLOWED_MODES = ['ro', 'rw', 'z', 'Z', 'nocopy'];

function naturalCompare(left, right) {
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parsedMode(value) {
  if ( !value ) {
    return {value: null, valid: true};
  }

  let parts = value.split(',');
  let seen = {};
  let valid = parts.every((part) => {
    if ( !MODE_PART.test(part) || ALLOWED_MODES.indexOf(part) === -1 || seen[part] ) {
      return false;
    }

    seen[part] = true;
    return true;
  });

  return {value, valid};
}

export function parseVolumeSpec(input) {
  let raw = String(input === null || input === undefined ? '' : input);
  let value = raw.trim();
  let result = {
    value,
    source: null,
    target: null,
    mode: null,
    kind: null,
    errors: [],
    valid: false,
  };

  if ( !value ) {
    result.errors.push('required');
    return result;
  }

  if ( value.length > MAX_SPEC_LENGTH ) {
    result.errors.push('tooLong');
  }

  if ( /[\u0000-\u001f\u007f]/.test(raw) ) {
    result.errors.push('controlCharacter');
  }

  let parts = value.split(':');
  if ( parts.length > 3 ) {
    result.errors.push('invalidFormat');
    return result;
  }

  if ( parts.length === 1 ) {
    result.target = parts[0];
    result.kind = 'anonymous';
  } else if ( parts.length === 2 ) {
    if ( parts[0].charAt(0) === '/' && parts[1].charAt(0) !== '/' ) {
      result.target = parts[0];
      result.mode = parts[1];
      result.kind = 'anonymous';
    } else {
      result.source = parts[0];
      result.target = parts[1];
      result.kind = result.source.charAt(0) === '/' ? 'bind' : 'named';
    }
  } else {
    result.source = parts[0];
    result.target = parts[1];
    result.mode = parts[2];
    result.kind = result.source.charAt(0) === '/' ? 'bind' : 'named';
  }

  if ( !result.target || result.target.charAt(0) !== '/' ) {
    result.errors.push('absoluteTarget');
  }

  if ( result.target && (result.target.indexOf('//') >= 0 || /(^|\/)\.\.?($|\/)/.test(result.target)) ) {
    result.errors.push('unsafeTarget');
  }

  if ( result.kind === 'named' && !VOLUME_NAME.test(result.source || '') ) {
    result.errors.push('invalidName');
  }

  if ( result.kind === 'bind' && (!result.source || result.source.charAt(0) !== '/') ) {
    result.errors.push('absoluteSource');
  }

  if ( result.kind === 'bind' && (result.source.indexOf('//') >= 0 || /(^|\/)\.\.?($|\/)/.test(result.source)) ) {
    result.errors.push('unsafeSource');
  }

  let mode = parsedMode(result.mode);
  if ( !mode.valid ) {
    result.errors.push('invalidMode');
  }

  result.errors = result.errors.filter((item, index, all) => all.indexOf(item) === index);
  result.valid = result.errors.length === 0;
  return result;
}

export function rankedVolumeSuggestions(suggestions, input, limit=8) {
  let query = String(input || '').trim().toLowerCase();
  let unique = {};

  (suggestions || []).forEach((item) => {
    let suggestion = typeof item === 'string' ? {value: item} : item;
    let value = String((suggestion && suggestion.value) || '').trim();
    let normalized = value.toLowerCase();

    if ( !value || normalized === query ) {
      return;
    }

    let position = query ? normalized.indexOf(query) : 0;
    if ( position < 0 ) {
      return;
    }

    let parsedPriority = parseInt(suggestion.priority, 10);
    let candidate = {
      value,
      source: suggestion.source || null,
      priority: Number.isFinite(parsedPriority) ? parsedPriority : 99,
      rank: position === 0 ? 0 : 1,
      suffix: position === 0 ? value.slice(query.length) : '',
    };
    let previous = unique[normalized];

    if ( !previous || candidate.priority < previous.priority ) {
      unique[normalized] = candidate;
    }
  });

  let values = Object.keys(unique).map((key) => unique[key]);
  values.sort((left, right) => left.rank - right.rank ||
    left.priority - right.priority || naturalCompare(left.value, right.value));
  return values.slice(0, Math.max(1, Math.min(8, parseInt(limit, 10) || 8)));
}

export { ALLOWED_MODES, MAX_SPEC_LENGTH, VOLUME_NAME };
