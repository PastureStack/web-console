import Ember from 'ember';
import C from 'ui/utils/constants';

export default Ember.Helper.extend({
  intl: Ember.inject.service(),

  compute(params) {
    const type = params[0];
    const translationKey = C.AUTH_TYPES[type];

    return translationKey ? this.get('intl').t(translationKey) : type;
  }
});
