import Mixin from '@ember/object/mixin';
import { htmlSafe } from '@ember/template';

import { computed } from '@ember/object';

export default Mixin.create({
  safeStyle: null,
  _safeStyle: computed('safeStyle', function() {
    if ( this.get('safeStyle') )
    {
      return htmlSafe(this.get('safeStyle'));
    }
    else
    {
      return htmlSafe('');
    }
  }),

  attributeBindings: ['_safeStyle:style'],
});
