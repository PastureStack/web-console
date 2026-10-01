import Component from '@ember/component';
import { computed } from '@ember/object';
import { service } from '@ember/service';

const TRANSLATED_STATES = ['active', 'running', 'stopped', 'stopping', 'created', 'exited', 'error'];

export default Component.extend({
  intl: service(),
  tagName: 'SPAN',
  classNames: ['state', 'badge'],
  classNameBindings: ['model.stateColor', 'model.stateBackground'],

  displayState: computed('model.displayState', 'intl._locale', function() {
    let original = this.get('model.displayState');
    let state = String(original || '').toLowerCase();

    if ( TRANSLATED_STATES.includes(state) ) {
      return this.get('intl').t(`formPorts.preflight.state.${state}`);
    }

    return original;
  }),
});
