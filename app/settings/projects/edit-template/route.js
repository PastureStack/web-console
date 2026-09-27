import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import Errors from 'ui/utils/errors';

export default Route.extend({
  catalog: service(),
  intl: service(),

  templateUnavailable() {
    let messageKey = 'resourceLoadError.projectTemplateUnavailable';
    return {status: 404, message: this.get('intl').t(messageKey), messageKey};
  },

  model(params) {
    return this.get('userStore').find('projecttemplate', params.template_id).catch((err) => {
      let status = Errors.status(err);
      if ( status === 403 || status === 404 ) {
        throw this.templateUnavailable();
      }
      throw err;
    }).then((originalProjectTemplate) => {
      if ( !originalProjectTemplate.get('canEdit') ) {
        throw this.templateUnavailable();
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
