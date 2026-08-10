import Component from '@ember/component';
import { get, set } from '@ember/object';

export function readContextProperty(context, key) {
  return context ? get(context, key) : undefined;
}

export function writeContextProperty(context, key, value) {
  if (!context) {
    return value;
  }

  set(context, key, value);

  return value;
}

export function dispatchContextAction(context, actionName, args) {
  if (!context || typeof context.send !== 'function') {
    return { handled: false };
  }

  return {
    handled: true,
    value: context.send(actionName, ...(args || []))
  };
}

export default Component.extend({
  tagName: '',
  context: null,
  // Ember's CoreView initializer reads this field with native property syntax.
  // Declare it on the proxy target so business-context delegation never
  // intercepts the framework's own view lifecycle state.
  parentView: null,
  elementId: null,

  unknownProperty(key) {
    return readContextProperty(this.get('context'), key);
  },

  setUnknownProperty(key, value) {
    return writeContextProperty(this.get('context'), key, value);
  },

  send(actionName, ...args) {
    let result = dispatchContextAction(this.get('context'), actionName, args);

    if (result.handled) {
      return result.value;
    }

    return this._super(actionName, ...args);
  }
});
