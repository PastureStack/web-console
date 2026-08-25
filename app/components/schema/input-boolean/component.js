import Component from '@ember/component';

export default Component.extend({
  classNames: ['form-control-static'],

  didReceiveAttrs() {
    if ( this.get('value') === 'false' ) {
      this.set('value', false);
    }
    else if ( this.get('value') === 'true' ) {
      this.set('value', true);
    }
  }
});
