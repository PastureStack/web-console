import { Checkbox, TextArea, TextField } from '@ember/legacy-built-in-components';
import SafeStyle from 'ui/mixins/safe-style';

export function initialize(/*application */) {
  // Allow style to be bound on inputs
  TextField.reopen(SafeStyle);
  TextArea.reopen(SafeStyle);
  Checkbox.reopen(SafeStyle);

  // Disable iOS auto-capitalization
  TextField.reopen({
    attributeBindings: ['autocapitalize'],
    autocapitalize: 'none',
  });
}

export default {
  name: 'extend-ember-input',
  initialize: initialize
};
