import { and } from '@ember/object/computed';
import Mixin from '@ember/object/mixin';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Mixin.create({
  stripProject: true,
  prefixLength: computed('name', function() {
    var name = this.get('model.displayName');
    var stackName = (this.get('model.labels')||{})[C.LABEL.STACK_NAME];
    if ( stackName && name.indexOf(stackName) === 0 )
    {
      return stackName.length + 1;
    }

    return 0;
  }),
  showEllipsis: and('stripProject','prefixLength'),

  displayName: computed('stripProject', 'prefixLength', 'model.displayName', function() {
    var name = this.get('model.displayName')||'';
    if ( this.get('stripProject') )
    {
      var len = this.get('prefixLength');
      return name.substr(len);
    }
    else
    {
      return name;
    }
  }),
});
