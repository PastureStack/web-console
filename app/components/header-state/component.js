import Component from '@ember/component';

export default Component.extend({
  classNames: ['header-state','section','r-mt5'],
  classNameBindings: ['model.stateColor'],
});
