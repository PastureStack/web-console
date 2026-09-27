import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';

export default Route.extend({
  catalog: service(),

  model() {
    return hash({
      catalogInfo: this.get('catalog').fetchTemplates({templateBase: C.EXTERNAL_ID.KIND_INFRA, category: C.EXTERNAL_ID.KIND_ALL}),
    }).then((hash) => {
      let existing = this.modelFor('settings.projects').projectTemplates;

      let def = existing.find((tpl) => (tpl.get('name')||'').toLowerCase() === C.PROJECT_TEMPLATE.DEFAULT);
      if ( def ) {
        // Only copy editable stack content. A new private template must not
        // inherit Default's catalog identity or top-level lifecycle data.
        hash.projectTemplate = this.get('userStore').createRecord({
          type: 'projectTemplate',
          name: '',
          description: '',
          isPublic: false,
          externalId: null,
          stacks: JSON.parse(JSON.stringify(def.get('stacks') || [])),
        });
      } else {
        hash.projectTemplate = this.get('userStore').createRecord({
          type: 'projectTemplate',
          stacks: [],
          isPublic: false,
        });
      }

      hash.originalProjectTemplate = hash.projectTemplate;
      return hash;
    });
  }
});
