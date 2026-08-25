import { get } from '@ember/object';

const TOKEN_PATTERN = /(\d+)/g;

function descriptor(value) {
  let text = String(value || '');
  let descending = text.slice(-5) === ':desc';
  let ascending = text.slice(-4) === ':asc';

  return {
    field: descending ? text.slice(0, -5) : (ascending ? text.slice(0, -4) : text),
    direction: descending ? -1 : 1,
  };
}

function tokens(value) {
  return String(value).toLocaleLowerCase().split(TOKEN_PATTERN).filter((part) => part !== '');
}

export function naturalCompare(left, right) {
  if ( left === right ) {
    return 0;
  }

  if ( left === undefined || left === null || left === '' ) {
    return -1;
  }

  if ( right === undefined || right === null || right === '' ) {
    return 1;
  }

  if ( typeof left === 'number' && typeof right === 'number' ) {
    return left - right;
  }

  if ( left instanceof Date && right instanceof Date ) {
    return left.getTime() - right.getTime();
  }

  let leftTokens = tokens(left);
  let rightTokens = tokens(right);
  let length = Math.max(leftTokens.length, rightTokens.length);

  for ( let index = 0 ; index < length ; index++ ) {
    if ( leftTokens[index] === undefined ) {
      return -1;
    }

    if ( rightTokens[index] === undefined ) {
      return 1;
    }

    if ( leftTokens[index] === rightTokens[index] ) {
      continue;
    }

    let leftNumber = Number(leftTokens[index]);
    let rightNumber = Number(rightTokens[index]);
    let bothNumbers = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

    if ( bothNumbers ) {
      if ( leftNumber !== rightNumber ) {
        return leftNumber - rightNumber;
      }

      return leftTokens[index].length - rightTokens[index].length;
    }

    return leftTokens[index].localeCompare(rightTokens[index]);
  }

  return 0;
}

/**
 * Stable natural sorting with optional hysteresis for live metrics.
 *
 * Values within the hysteresis ratio retain their previous relative order, so
 * two nearly equal live measurements do not trade places every refresh.
 */
export function naturalSort(items, fields, options={}) {
  let source = (items || []).slice();
  let sortFields = (fields && fields.length ? fields : ['id']).map(descriptor);
  let previousOrder = options.previousOrder || [];
  let previousRanks = {};
  let hysteresis = Number(options.hysteresis) || 0;
  let primaryField = sortFields[0].field;
  let direction = options.descending ? -1 : 1;

  previousOrder.forEach((id, index) => {
    previousRanks[id] = index;
  });

  let decorated = source.map((item, index) => ({item, index}));

  decorated.sort((leftEntry, rightEntry) => {
    let left = leftEntry.item;
    let right = rightEntry.item;

    for ( let fieldIndex = 0 ; fieldIndex < sortFields.length ; fieldIndex++ ) {
      let sortField = sortFields[fieldIndex];
      let leftValue = get(left, sortField.field);
      let rightValue = get(right, sortField.field);
      let comparison = naturalCompare(leftValue, rightValue);

      if (
        fieldIndex === 0 &&
        sortField.field === primaryField &&
        hysteresis > 0 &&
        typeof leftValue === 'number' &&
        typeof rightValue === 'number'
      ) {
        let threshold = Math.max(Math.abs(leftValue), Math.abs(rightValue), 1) * hysteresis;

        if ( Math.abs(leftValue - rightValue) <= threshold ) {
          let leftRank = previousRanks[get(left, 'id')];
          let rightRank = previousRanks[get(right, 'id')];

          if ( leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank ) {
            return leftRank - rightRank;
          }

          comparison = 0;
        }
      }

      if ( comparison !== 0 ) {
        return comparison * sortField.direction * direction;
      }
    }

    return leftEntry.index - rightEntry.index;
  });

  return decorated.map((entry) => entry.item);
}
