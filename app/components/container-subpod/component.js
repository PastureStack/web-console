import Component from '@ember/component';
import C from 'ui/utils/constants';
import StrippedName from 'ui/mixins/stripped-name';

import { computed } from '@ember/object';

export default Component.extend(StrippedName, {
  model: null,
  children: null,
  groupHasChildren: false,

  classNames: ['subpod','instance'],
  classNameBindings: ['model.isManaged:managed'],

  stateBackground: computed('model.stateColor', function() {
    return 'bg-'+this.get('model.stateColor').substr(5);
  }),

  isKubernetes: computed('model.labels', function() {
    return !!this.get('model.labels')[C.LABEL.K8S_POD_NAME];
  }),
});
