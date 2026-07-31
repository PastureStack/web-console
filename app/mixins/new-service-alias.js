import { alias } from '@ember/object/computed';
import Mixin from '@ember/object/mixin';
import NewOrEdit from 'ui/mixins/new-or-edit';


export default Mixin.create(NewOrEdit, {
  service         : null,
  existing        : null,
  targetResources : null,
  targetsArray    : null,
  primaryResource : alias('service'),

  init() {
    this._super(...arguments);

    this.set('targetsArray',[]);
    this.set('targetResources',[]);
  },
  actions: {
    setTargets(array, resources) {
      this.set('targetsArray', array);
      this.set('targetResources', resources);
    },
  },
  // ----------------------------------
  // Save
  // ----------------------------------

  didSave() {
    // Set balancer targets
    return this.get('service').doAction('setservicelinks', {
      serviceLinks: this.get('targetResources'),
    });
  },


});
