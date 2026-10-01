import Resource from 'ember-api-store/models/resource';

export default Resource.extend({
  validationErrors() {
    let errors = this._super(...arguments);
    let min = parseInt(this.get('min'),10);
    let max = parseInt(this.get('max'),10);
    if ( min && max && min > max ) {
      let intl = this.get('intl');
      errors.push(intl.t('validation.number.max', {key: intl.t('newReceiver.min.label'), val: max}));
    }

    return errors;
  }
});
