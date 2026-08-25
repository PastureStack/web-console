import Helper from '@ember/component/helper';
import { service } from '@ember/service';

export default Helper.extend({
  router: service(),

  compute(params) {
    return this.get('router').urlFor(...params);
  },
});
