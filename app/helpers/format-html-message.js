import Helper from '@ember/component/helper';
import { service } from '@ember/service';

export default Helper.extend({
  intl: service(),

  compute([key], options) {
    return this.get('intl').tHtml(key, options);
  },
});
