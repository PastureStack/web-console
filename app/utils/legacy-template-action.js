import { get } from '@ember/object';
import { join } from '@ember/runloop';

const MODIFIER_KEYS = ['alt', 'shift', 'meta', 'ctrl'];
const POINTER_EVENT = /^(click|mouse|touch)/;

function actionFunction(target, actionName) {
  if (!target) {
    throw new Error(`Cannot invoke action '${ actionName }' without a target`);
  }

  const actions = target.actions || get(target, 'actions');
  const fn = actions && actions[actionName];

  if (typeof fn === 'function') {
    return fn;
  }

  return null;
}

export function isAllowedActionEvent(event, allowedKeys) {
  let allowed = allowedKeys;

  if (allowed === undefined || allowed === null) {
    if (POINTER_EVENT.test(event.type)) {
      return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    }
    allowed = '';
  }

  allowed = String(allowed);
  if (allowed.includes('any')) {
    return true;
  }

  return MODIFIER_KEYS.every((key) => !event[`${ key }Key`] || allowed.includes(key));
}

export function processActionArguments(curriedArgs, invocationArgs, valuePath) {
  const args = curriedArgs.concat(invocationArgs);

  if (valuePath && args.length > 0) {
    args[0] = get(args[0], valuePath);
  }

  return args;
}

export function createLegacyClosureAction(context, actionName, curriedArgs = [], named = {}) {
  const target = named.target === undefined ? context : named.target;
  const valuePath = named.value || null;

  return (...invocationArgs) => {
    const args = processActionArguments(curriedArgs, invocationArgs, valuePath);

    if (typeof actionName === 'function') {
      return join(context, actionName, ...args);
    }

    if (typeof actionName !== 'string') {
      throw new Error('Template action must resolve to a function or a quoted action name');
    }

    const fn = actionFunction(target, actionName);
    if (fn) {
      return join(target, fn, ...args);
    }
    if (typeof target.send === 'function') {
      return join(target, target.send, actionName, ...args);
    }

    throw new Error(`Action '${ actionName }' was not found on its target`);
  };
}

export function invokeLegacyModifierAction(target, actionName, args) {
  if (typeof actionName === 'function') {
    return join(target, actionName, ...args);
  }

  if (typeof actionName !== 'string') {
    throw new Error('Template action modifier must resolve to a function or a quoted action name');
  }

  if (target && typeof target.send === 'function') {
    return join(target, target.send, actionName, ...args);
  }

  const fn = actionFunction(target, actionName);
  if (fn) {
    return join(target, fn, ...args);
  }

  const direct = target && target[actionName];
  if (typeof direct === 'function') {
    return join(target, direct, ...args);
  }

  throw new Error(`Action '${ actionName }' was not found on its target`);
}
