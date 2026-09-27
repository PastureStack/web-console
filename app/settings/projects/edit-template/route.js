import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  catalog: service(),

  model(params) {
    return this.get('userStore').find('projecttemplate', params.template_id).then((originalProjectTemplate) => {
      if ( !originalProjectTemplate.get('canEdit') ) {
        throw {status: 403, code: 'Forbidden'};
      }

      return hash({
        catalogInfo: this.get('catalog').fetchTemplates({templateBase: 'infra', category: 'all'}),
        originalProjectTemplate,
      }).then((model) => {
        model.projectTemplate = originalProjectTemplate.clone();
        return model;
      });
    });
  }
});
