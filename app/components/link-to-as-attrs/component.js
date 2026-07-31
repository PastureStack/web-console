import { LinkComponent } from '@ember/legacy-built-in-components';

import { computed } from '@ember/object';

// This is a link-to where models (path components) and query-params can be set as attribtues instead of positional params
export default LinkComponent.extend({
  attributeBindings: ['role','aria-haspopup','aria-expanded'],

  'current-when': computed('moreCurrentWhen', function() {
    let base = this.get('qualifiedRouteName');
    if ( this.get('moreCurrentWhen.length') ) {
      return this.get('moreCurrentWhen').concat(base).join(' ');
    }
  }),

  willRender() {
    this._super(...arguments);
    this.set('models', this.get('attrs.models.value')||[]);
    this.set('queryParams', {
      isQueryParams: true,
      values: this.get('attrs.queryParams.value')||{}
    });
  }
});
