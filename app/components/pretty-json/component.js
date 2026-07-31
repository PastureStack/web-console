import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  value: null,

  json: computed('value', function() {
    var value = (this.get('value')||'')+'';
    if ( ['[','{'].indexOf(value.substr(0,1)) >= 0 )
    {
      try {
        var pretty = JSON.stringify(JSON.parse(value),null,2);
        return pretty;
      } catch (e) {
      }
    }

    return null;
  }),
});
