import { get } from '@ember/object';
import { normalizeType } from './normalize';

// Request-local metadata: not a resource field, payload key, or store cache.
const callbackKey = Symbol('create-only first delivery');

export function bindCreateOnlyDelivery(options, callback) {
  Object.defineProperty(options, callbackKey, { value: callback, configurable: true });
}

export function takeCreateOnlyDelivery(options) {
  const callback = options[callbackKey];
  delete options[callbackKey];
  return typeof callback === 'function' ? callback : null;
}

export function cloneCreateOnlyDelivery(resource, delivery) {
  if ( !delivery ) {
    return resource.clone();
  }

  const fields = delivery.fields;
  delivery.fields = null; // Consume even when identity validation or cloning fails.
  const store = get(resource, 'store');
  if ( !fields || store !== delivery.store || get(resource, 'id') !== delivery.id ||
       normalizeType(get(resource, 'type')) !== delivery.type ||
       get(resource, 'accountId') !== delivery.accountId ||
       get(store, 'generation') !== delivery.generation ||
       get(store, 'baseUrl') !== delivery.baseUrl ) {
    throw new Error('Create-only delivery no longer belongs to this save');
  }

  const clone = resource.clone();
  clone.setProperties(fields);
  return clone;
}
