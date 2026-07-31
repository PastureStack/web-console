import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),

  classNames: ['catalog-box'],
  classNameBindings: ['active::inactive'],

  model: null,
  showIcon: true,
  showSource: false,
  showDescription: true,
  active: true
});
