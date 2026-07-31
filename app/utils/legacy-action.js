import { get } from '@ember/object';

const MODIFIER_KEYS = ['alt', 'ctrl', 'meta', 'shift'];

function isEvent(value) {
  return value &&
    typeof value === 'object' &&
    typeof value.preventDefault === 'function';
}

function modifierKeysAreAllowed(event, allowedKeys) {
  if (!event) {
    return true;
  }

  let allowed = String(allowedKeys || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (allowed.includes('any')) {
    return true;
  }

  return MODIFIER_KEYS.every((key) => !event[`${key}Key`] || allowed.includes(key));
}

function actionTarget(context, configuredTarget) {
  if (!configuredTarget) {
    return context;
  }

  if (typeof configuredTarget === 'string') {
    return get(context, configuredTarget);
  }

  return configuredTarget;
}

function invoke(target, action, args) {
  if (typeof action === 'function') {
    return action.apply(target, args);
  }

  if (target && typeof target.send === 'function') {
    return target.send(action, ...args);
  }

  if (target && target.actions && typeof target.actions[action] === 'function') {
    return target.actions[action].apply(target, args);
  }

  if (target && typeof target[action] === 'function') {
    return target[action](...args);
  }

  throw new Error(`The action '${action}' was not found on its target.`);
}

export function legacyAction(positional, named = {}, options = {}) {
  let [context, action, ...curriedArgs] = positional;
  let target = actionTarget(context, named.target);

  return function(...invocationArgs) {
    let event = isEvent(invocationArgs[0]) ? invocationArgs[0] : null;

    if (!modifierKeysAreAllowed(event, named.allowedKeys)) {
      return true;
    }

    if (event && (options.preventDefaultByDefault || named.preventDefault === true)) {
      event.preventDefault();
    }

    if (event && named.bubbles === false && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }

    let runtimeArgs = invocationArgs;
    if (named.value && event) {
      runtimeArgs = [get(event, named.value)];
    }

    return invoke(target, action, [...curriedArgs, ...runtimeArgs]);
  };
}
