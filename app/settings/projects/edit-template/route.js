import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  catalog: service(),

  model(params) {
    return hash({
      catalogInfo: this.get('catalog').fetchTemplates({templateBase: 'infra', category: 'all'}),
      originalProjectTemplate: this.get('userStore').find('projecttemplate', params.template_id),
    }).then((hash) => {
      hash.projectTemplate = hash.originalProjectTemplate.clone();
      return hash;
    });
  }
});
