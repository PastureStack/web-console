import { alias } from '@ember/object/computed';
import ManageLabels from 'ui/mixins/manage-labels';
import { flattenLabelArrays } from 'ui/mixins/manage-labels';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';
import C from 'ui/utils/constants';
import { debouncedObserver } from 'ui/utils/debounce';

import { observer } from '@ember/object';

export default ModalBase.extend(NewOrEdit, ManageLabels, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  model: null,
  editing: true,

  ips: null,
  requireAny: null,
  requiredIfAny: {[C.LABEL.SYSTEM_TYPE]: ''},
  readonlyLabels: [C.LABEL.PER_HOST_SUBNET,C.LABEL.PER_HOST_SUBNET_ROUTING_IP],
  systemLabels: null,
  userLabels: null,

  init() {
    this._super(...arguments);
    this.set('model', this.get('originalModel').clone());
    this.initLabels(this.get('model.labels'), null, [C.LABEL.SCHED_IPS, C.LABEL.REQUIRE_ANY]);

    let ips = [];
    let str = this.getLabel(C.LABEL.SCHED_IPS);
    if ( str ) {
      ips = str.split(/\s*,\s*/).filter(x => x.length);
    }
    this.set('ips', ips);

    this.set('requireAny', this.getLabel(C.LABEL.REQUIRE_ANY));
  },

  ipsChanged: observer('ips.[]', function() {
    let ips = (this.get('ips')||[]).map((x) => x.trim()).filter(x => x.length);
    this.setLabel(C.LABEL.SCHED_IPS, ips.join(', '));
  }),

  requireAnyChanged: observer('requireAny', function() {
    let any = this.get('requireAny');
    this.setLabel(C.LABEL.REQUIRE_ANY, any||undefined);
  }),

  updateLabels(labels) {
    this.set('systemLabels', labels);
  },

  mergeAllLabels: debouncedObserver(
    'systemLabels.@each.{key,value}',
    'userLabels.@each.{key,value}',
  function() {
    let out = flattenLabelArrays(
      this.get('systemLabels'),
      this.get('userLabels')
    );

    this.set('model.labels', out);
  }),

  actions: {
    setUserLabels(labels) {
      this.set('userLabels', labels);
    },
  },

  doneSaving() {
    this.send('cancel');
  },
});
