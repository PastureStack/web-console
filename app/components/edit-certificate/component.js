import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import CertificateKeyValidation from 'ui/mixins/certificate-key-validation';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, CertificateKeyValidation, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  editing: true,
  model: null,

  init() {
    this._super(...arguments);
    this.set('model', this.get('originalModel').clone());
  },

  isMetadataOnlyUpdate() {
    const model = this.get('model');
    const original = this.get('originalModel');
    const value = (record, field) => record?.get?.(field);
    const normalize = (material) => typeof material === 'string' ? material.trim() : material == null ? '' : material;
    const cert = value(original, 'cert');

    // Schema validation trims the clone. Compare both sides consistently, but
    // never send those trimmed, unchanged PEM values back in a metadata PUT.
    return Boolean(value(original, 'id') && value(model, 'id') === value(original, 'id') &&
      value(model, 'type') === 'certificate' && value(original, 'type') === 'certificate' &&
      typeof cert === 'string' && cert.trim() && normalize(value(model, 'cert')) === normalize(cert) &&
      normalize(value(model, 'certChain')) === normalize(value(original, 'certChain')) &&
      normalize(value(original, 'key')) === '' &&
      normalize(value(model, 'key')) === '');
  },

  validate() {
    return this._super(this.isMetadataOnlyUpdate() ? {updateOmittedFields: ['key']} : undefined);
  },

  doSave() {
    const model = this.get('model');
    const data = {
      name: model.get('name'),
      description: model.get('description'),
    };
    if ( !this.isMetadataOnlyUpdate() ) {
      data.cert = model.get('cert');
      data.key = model.get('key');
      data.certChain = model.get('certChain');
    }

    return this._super({data});
  },

  doneSaving() {
    this.send('cancel');
  },
});
