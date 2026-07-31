import { later } from '@ember/runloop';
import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  errors: null,

  classNames: ['top-errors','alert','alert-danger'],
  classNameBindings: ['errors.length::hide'],

  errorsDidChange: computed('errors.[]', function() {
    if ( this.get('errors.length') )
    {
      later(() => {
        this.$().scrollIntoView();
      },100);
    }
  }),
});
