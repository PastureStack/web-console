import { computed } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),
  intl: service(),

  title: computed('intl._locale', function() {
    return this.get('intl').t('helpBtn.title');
  }),
  link: '',
  target: '_blank',

  tagName: 'A',
  attributeBindings: ['title','href', 'target'],
  classNames: ['small'],

  href: computed('link', function() {
    return this.get('settings.docsBase') + this.get('link');
  })

});
