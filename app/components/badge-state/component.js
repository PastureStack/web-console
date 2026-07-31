import Component from '@ember/component';

export default Component.extend({
  tagName: 'SPAN',
  classNames: ['state', 'badge'],
  classNameBindings: ['model.stateColor', 'model.stateBackground'],
});
