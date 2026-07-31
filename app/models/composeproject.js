import Stack from 'ui/models/stack';

import { computed } from '@ember/object';

export default Stack.extend({
  type: 'composeProject',
  grouping: 'swarm',

  availableActions: computed('actionLinks.{remove}', function() {
    var a = this.get('actionLinks');

    var out = [
      { label   : 'action.remove',     icon : 'icon icon-trash',          action : 'promptDelete',  enabled  : !!a.remove, altAction : 'delete'},
      { label   : 'action.viewInApi',  icon : 'icon icon-external-link',  action : 'goToApi',       enabled  : true },
    ];

    return out;
  }),

});
