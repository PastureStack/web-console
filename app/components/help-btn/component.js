import Ember from 'ember';

export default Ember.Component.extend({
  settings: Ember.inject.service(),
  intl: Ember.inject.service(),

  title: Ember.computed('intl._locale', function() {
    return this.get('intl').t('helpBtn.title');
  }),
  link: '',
  target: '_blank',

  tagName: 'A',
  attributeBindings: ['title','href', 'target'],
  classNames: ['small'],

  href: function() {
    return this.get('settings.docsBase') + this.get('link');
  }.property('link')

});
