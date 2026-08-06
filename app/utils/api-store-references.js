import { computed, get } from '@ember/object';

function getReference(store, referencedType, referencedId, thisType, thisId, computedKey) {
  if (!referencedId) {
    return null;
  }

  const watchKey = `${ referencedType }:${ referencedId }`;
  const result = store.getById(referencedType, referencedId);
  let list = store._state.watchReference[watchKey];

  if (!list) {
    list = [];
    store._state.watchReference[watchKey] = list;
  }

  list.push({
    type: thisType,
    id: thisId,
    field: computedKey,
  });

  if (result) {
    return result;
  }

  list = store._state.missingReference[watchKey];
  if (!list) {
    list = [];
    store._state.missingReference[watchKey] = list;
  }

  list.push({
    type: thisType,
    id: thisId,
    field: computedKey,
  });

  return null;
}

export function referenceTypeForField(field, isArray = false) {
  const suffix = isArray ? /Ids$/ : /Id$/;

  return field.replace(suffix, '');
}

export function denormalizeId(field, referencedType = null, storeName = 'store') {
  const type = referencedType || referenceTypeForField(field);

  return computed(field, {
    get(computedKey) {
      return getReference(
        this.get(storeName),
        type,
        this.get(field),
        this.get('type'),
        this.get('id'),
        computedKey
      );
    },

    // API responses can contain the expanded relationship under the computed
    // property name. Older Ember releases retained that direct value; Ember 6
    // requires an explicit setter to preserve the same behavior.
    set(_computedKey, value) {
      return value;
    },
  });
}

export function denormalizeIdArray(field, referencedType = null, storeName = 'store') {
  const type = referencedType || referenceTypeForField(field, true);

  return computed(`${ field }.[]`, {
    get(computedKey) {
      const store = this.get(storeName);
      const thisType = this.get('type');
      const thisId = this.get('id');
      const ids = this.get(field) || [];
      const length = get(ids, 'length') || 0;
      const out = [];

      for (let i = 0; i < length; i++) {
        const referencedId = typeof ids.objectAt === 'function' ? ids.objectAt(i) : ids[i];
        const entry = getReference(store, type, referencedId, thisType, thisId, computedKey);

        if (entry) {
          out.push(entry);
        }
      }

      return out;
    },

    set(_computedKey, value) {
      return value;
    },
  });
}
