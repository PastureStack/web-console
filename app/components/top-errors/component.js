import { later } from '@ember/runloop';
import Component from '@ember/component';

export default Component.extend({
  errors: null,

  classNames: ['top-errors','alert','alert-danger'],
  classNameBindings: ['errors.length::hide'],

  errorsDidChange: function() {
    if ( this.get('errors.length') )
    {
      later(() => {
        this.$().scrollIntoView();
      },100);
    }
  }.property('errors.[]'),
});
