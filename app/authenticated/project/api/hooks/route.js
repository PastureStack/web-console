import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  webhookStore: service(),

  model: function() {
    return this.get('webhookStore').findAll('schema', {url: 'schemas'}).then((schemas) => {
      let receiverSchema = schemas.findBy('id','receiver');
      receiverSchema.resourceFields.name.required = true;
      schemas.findBy('id','scaleservice').resourceFields.serviceId.required = true;
      schemas.findBy('id','scalehost').resourceFields.hostSelector.required = true;
      schemas.findBy('id','serviceupgrade').resourceFields.serviceSelector.required = true;

      return hash({
        receiverSchema,
        receivers: this.get('webhookStore').findAll('receiver', {forceReload: true}),
      });
    });
  },
});
