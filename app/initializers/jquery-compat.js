import Component from '@ember/component';
import jQuery from 'jquery';

export function initialize() {
  // Preserve the legacy DOM boundary while individual call sites migrate to
  // explicit jQuery imports and element-based component code.
  Component.reopen({
    $(selector) {
      if (!this.element) {
        return undefined;
      }

      return selector ? jQuery(selector, this.element) : jQuery(this.element);
    }
  });
}

export default {
  name: 'jquery-compat',
  initialize
};
