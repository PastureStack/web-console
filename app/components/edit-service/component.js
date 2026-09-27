import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  service: null,

  primaryResource: alias('service'),

  editing: true,
  isService: true,

  actions: {
    done() {
      this.send('cancel');
    },
    setScale(scale) {
      this.set('service.scale', scale);
    },
    setServiceLinks(links) {
      this.set('serviceLinksArray', links);
    },

  },

  init() {
    this._super(...arguments);
    this.set('service', this.get('originalModel').clone());
  },

  doSave() {
    const service = this.get('service');
    const fields = {
      name: service.get('name'),
      description: service.get('description'),
      scale: service.get('scale'),
    };

    // Validation also visits the cloned launchConfig and upgrade strategy.
    // The edit form does not expose those fields, so keep them out of this PUT.
    return service.save({data: fields}).then(() => {
      const original = this.get('originalModel');
      original.setProperties(fields);
      return original;
    });
  },

  didSave() {
    var service = this.get('service');
    var ary = [];
    this.get('serviceLinksArray').forEach((row) => {
      if ( row.serviceId ) {
        ary.push({name: row.name, serviceId: row.serviceId});
      } else if ( row.service ) {
        ary.push({name: row.name, service: row.service});
      }
    });

    return service.doAction('setservicelinks', {serviceLinks: ary});
  },

  doneSaving() {
    this.send('cancel');
  }
});
