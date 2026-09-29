import ApiError from 'ember-api-store/models/error';

function nonEmptyString(value) {
  if ( typeof value !== 'string' ) {
    return null;
  }

  value = value.trim();
  return value.length ? value : null;
}

function parsedJSON(value) {
  let text = nonEmptyString(value);
  if ( !text || (text[0] !== '{' && text[0] !== '[') ) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function nestedMessage(value, seen, depth) {
  if ( depth > 4 || value === null || value === undefined ) {
    return null;
  }

  if ( typeof value === 'string' ) {
    let parsed = parsedJSON(value);
    return parsed ? nestedMessage(parsed, seen, depth + 1) : nonEmptyString(value);
  }

  if ( typeof value !== 'object' || seen.indexOf(value) >= 0 ) {
    return null;
  }
  seen.push(value);

  let message = nonEmptyString(value.message);
  let detail = nonEmptyString(value.detail);
  if ( message && detail && message !== detail ) {
    return `${message} (${detail})`;
  }
  if ( message || detail ) {
    return message || detail;
  }

  let nested = [
    value.body,
    value.responseJSON,
    value.response && value.response.data,
    value.response && value.response.body,
    value.xhr && value.xhr.responseJSON,
    value.xhr && value.xhr.responseText,
  ];
  for ( let item of nested ) {
    let result = nestedMessage(item, seen, depth + 1);
    if ( result ) {
      return result;
    }
  }

  return nonEmptyString(value.statusText) ||
    nonEmptyString(value.xhr && value.xhr.statusText) ||
    nonEmptyString(value.code) ||
    nonEmptyString(value.type);
}

function fieldValue(value, key) {
  if ( !value || typeof value !== 'object' ) {
    return null;
  }

  let direct = value[key];
  return direct === undefined && typeof value.get === 'function' ? value.get(key) : direct;
}

function nestedStringField(value, key, seen, depth) {
  if ( depth > 4 || value === null || value === undefined ) {
    return null;
  }
  if ( typeof value === 'string' ) {
    let parsed = parsedJSON(value);
    return parsed ? nestedStringField(parsed, key, seen, depth + 1) : null;
  }
  if ( typeof value !== 'object' || seen.indexOf(value) >= 0 ) {
    return null;
  }
  seen.push(value);

  let direct = nonEmptyString(fieldValue(value, key));
  if ( direct ) {
    return direct;
  }

  let response = fieldValue(value, 'response');
  let xhr = fieldValue(value, 'xhr');
  for ( let item of [
    fieldValue(value, 'body'),
    fieldValue(value, 'responseJSON'),
    response && fieldValue(response, 'data'),
    response && fieldValue(response, 'body'),
    xhr && fieldValue(xhr, 'responseJSON'),
    xhr && fieldValue(xhr, 'responseText'),
    response,
    xhr,
  ] ) {
    let result = nestedStringField(item, key, seen, depth + 1);
    if ( result ) {
      return result;
    }
  }
  return null;
}

function nestedStatus(value, seen, depth) {
  if ( depth > 4 || value === null || value === undefined ) {
    return null;
  }

  if ( typeof value === 'string' ) {
    let parsed = parsedJSON(value);
    return parsed ? nestedStatus(parsed, seen, depth + 1) : null;
  }

  if ( typeof value !== 'object' || seen.indexOf(value) >= 0 ) {
    return null;
  }
  seen.push(value);

  for ( let candidate of [fieldValue(value, 'status'), fieldValue(value, 'statusCode')] ) {
    let status = Number(candidate);
    if ( Number.isInteger(status) && status >= 100 && status <= 599 ) {
      return status;
    }
  }

  for ( let item of [value.body, value.responseJSON, value.response, value.xhr] ) {
    let result = nestedStatus(item, seen, depth + 1);
    if ( result ) {
      return result;
    }
  }

  return null;
}

export default {
  stringify(err, intl) {
    if ( intl && typeof intl.t === 'function' ) {
      let status = nestedStatus(err, [], 0);

      if ( status === 403 || status === 404 ) {
        // A denied resource and a missing resource must have the same visible
        // explanation. Client-created errors can supply a more specific key.
        let key = nonEmptyString(fieldValue(err, 'messageKey')) || 'resourceSaveError.unavailable';
        return intl.t(key);
      }

      if ( status === 422 ) {
        let intro = intl.t('resourceSaveError.validation');
        let field = nestedStringField(err, 'fieldName', [], 0);
        let detail = nestedStringField(err, 'detail', [], 0);
        let explanation = detail || nestedStringField(err, 'message', [], 0) ||
          nestedStringField(err, 'code', [], 0);
        let context = [field, explanation].filter(Boolean).join(': ');
        return context ? `${intro} ${context}` : intro;
      }
    }

    var str;
    if ( typeof err === 'string' )
    {
      str = err;
    }
    else if ( err instanceof ApiError )
    {
      if ( err.get('code') === 'ActionNotAvailable' )
      {
        str = 'This action is not currently available';
      }
      else if ( err.get('status') === 422 )
      {
        str = 'Validation failed in API:';
        var something = false;
        if ( err.get('fieldName') )
        {
          str += ' ' + err.get('fieldName');
          something = true;
        }

        if ( err.get('detail') )
        {
          str += ' (' + err.get('detail') + ')';
          something = true;
        }

        if ( !something )
        {
          if ( err.get('message') )
          {
            str += ' ' + err.get('message');
            something = true;
          }
        }

        if ( !something )
        {
          str += ' (' + err.get('code') + ')';
        }

        switch ( err.get('code') )
        {
          case 'MissingRequired':
            str += ' is required'; break;
          case 'NotUnique':
            str += ' is not unique'; break;
          case 'NotNullable':
            str += ' must be set'; break;
          case 'InvalidOption':
            str += ' is not a valid option'; break;
          case 'InvalidCharacters':
            str += ' contains invalid characters'; break;
          case 'MinLengthExceeded':
            str += ' is not long enough'; break;
          case 'MaxLengthExceeded':
            str += ' is too long'; break;
          case 'MinLimitExceeded':
            str += ' is too small'; break;
          case 'MaxLimitExceded':
            str += ' is too big'; break;
        }
      }
      else
      {
        str = err.get('message') || err.get('xhr.message');
        if ( err.get('detail') )
        {
          if ( str )
          {
            str += ' (' + err.get('detail') + ')';
          }
          else
          {
            str = err.get('detail');
          }
        }
      }
    }
    else if ( typeof err === 'object' )
    {
      if ( err.message )
      {
        str = err.message;
        if ( err.detail )
        {
          if ( str )
          {
            str += ' (' + err.detail + ')';
          }
          else
          {
            str = err.detail;
          }
        }
      }
      else if ( err.detail )
      {
        str = err.detail;
      }
    }
    else
    {
      // Good luck...
      str = err;
    }

    return nonEmptyString(str) || nestedMessage(err, [], 0) ||
      (intl && typeof intl.t === 'function' ? intl.t('resourceSaveError.failed') : null);
  },

  status(err) {
    return nestedStatus(err, [], 0);
  },
};
