import { modifier } from 'ember-modifier';
import {
  invokeLegacyModifierAction,
  isAllowedActionEvent,
} from 'ui/utils/legacy-template-action';

export default modifier(function action(element, [implicitTarget, actionName, ...actionArgs], named) {
  const eventName = named.on || 'click';
  const target = named.target === undefined ? implicitTarget : named.target;
  const handler = (event) => {
    if (!isAllowedActionEvent(event, named.allowedKeys)) {
      return true;
    }

    if (named.preventDefault !== false) {
      event.preventDefault();
    }
    if (named.bubbles === false) {
      event.stopPropagation();
    }

    invokeLegacyModifierAction(target, actionName, actionArgs);
    return named.bubbles !== false;
  };

  element.addEventListener(eventName, handler);

  return () => element.removeEventListener(eventName, handler);
});
