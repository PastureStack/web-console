import { modifier } from 'ember-modifier';
import { legacyAction } from 'ui/utils/legacy-action';

export default modifier((element, positional, named) => {
  let eventName = named.on || 'click';
  let handler = legacyAction(positional, named, {
    preventDefaultByDefault: true,
  });

  element.addEventListener(eventName, handler);

  return () => {
    element.removeEventListener(eventName, handler);
  };
});
