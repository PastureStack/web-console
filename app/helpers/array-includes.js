import { A } from '@ember/array';
import { observer } from '@ember/object';
import Helper from '@ember/component/helper';

export default Helper.extend({
  _haystack: null,

  shouldUpdate: observer('_haystack.[]', function(){
    this.recompute();
  }),

  compute(params) {
    let haystack = params[0];
    let needle = params[1];

    if (!haystack) {
      return;
    }

    let _haystack = this.get('_haystack');
    if (haystack !== _haystack) {
      _haystack = new A(haystack);
      this.set('_haystack', _haystack);
    }
    return _haystack.includes(needle);
  }
});
