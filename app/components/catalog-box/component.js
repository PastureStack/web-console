import { service } from '@ember/service';
import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),

  classNames: ['catalog-box'],
  classNameBindings: ['active::inactive'],

  model: null,
  showIcon: true,
  showSource: false,
  showDescription: true,
  active: true,

  displayName: computed('model.{catalogDisplayName,name}', function() {
    let catalogName = this.get('model.catalogDisplayName');

    return catalogName === undefined ? this.get('model.name') : catalogName;
  })
});
