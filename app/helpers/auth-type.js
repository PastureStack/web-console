import { service } from '@ember/service';
import Helper from '@ember/component/helper';
import C from 'ui/utils/constants';

export default Helper.extend({
  intl: service(),

  compute(params) {
    const type = params[0];
    const translationKey = C.AUTH_TYPES[type];

    return translationKey ? this.get('intl').t(translationKey) : type;
  }
});
