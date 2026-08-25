import { cancel, later } from '@ember/runloop';
import { A } from '@ember/array';
import { computed } from '@ember/object';
import Component from '@ember/component';
import { rankedVolumeSuggestions } from 'ui/utils/volume-spec';

export default Component.extend({
  classNames: ['volume-path-autocomplete'],

  value: '',
  suggestions: null,
  placeholder: null,
  changed: null,
  inputValue: '',
  activeIndex: 0,
  isOpen: false,
  maxSuggestions: 8,

  init() {
    this._super(...arguments);
    this.set('inputValue', String(this.get('value') || ''));
    this._lastExternalValue = this.get('value');
    this._blurTimer = null;
  },

  didReceiveAttrs() {
    this._super(...arguments);
    let external = this.get('value');

    if ( external !== this._lastExternalValue ) {
      this._lastExternalValue = external;
      this.set('inputValue', String(external || ''));
    }
  },

  listboxId: computed('elementId', function() {
    return `${this.get('elementId')}-listbox`;
  }),

  visibleSuggestions: computed(
    'suggestions.[]',
    'inputValue',
    'maxSuggestions',
    function() {
      return A(rankedVolumeSuggestions(
        this.get('suggestions'),
        this.get('inputValue'),
        this.get('maxSuggestions')
      ));
    }
  ),

  activeSuggestion: computed('visibleSuggestions.[]', 'activeIndex', function() {
    return this.get('visibleSuggestions').objectAt(this.get('activeIndex')) || null;
  }),

  activeOptionId: computed('activeSuggestion', 'activeIndex', 'listboxId', function() {
    return this.get('activeSuggestion') ? `${this.get('listboxId')}-option-${this.get('activeIndex')}` : null;
  }),

  inlineCompletion: computed('activeSuggestion.{value,suffix}', 'inputValue', function() {
    let suggestion = this.get('activeSuggestion');

    if ( !suggestion || !suggestion.suffix ) {
      return null;
    }

    return {
      prefix: this.get('inputValue'),
      suffix: suggestion.suffix,
    };
  }),

  invokeChanged(value) {
    let callback = this.get('changed');

    if ( typeof callback === 'function' ) {
      callback(value);
    } else if ( callback ) {
      this.sendAction('changed', value);
    }
  },

  acceptSuggestion(suggestion) {
    if ( !suggestion ) {
      return;
    }

    this.setProperties({
      inputValue: suggestion.value,
      activeIndex: 0,
      isOpen: false,
    });
    this.invokeChanged(suggestion.value);
  },

  actions: {
    inputChanged(value) {
      this.setProperties({
        inputValue: value,
        activeIndex: 0,
        isOpen: true,
      });
      this.invokeChanged(value);
    },

    focusInput() {
      if ( this.get('visibleSuggestions.length') ) {
        this.set('isOpen', true);
      }
    },

    blurInput() {
      if ( this._blurTimer ) {
        cancel(this._blurTimer);
      }

      this._blurTimer = later(this, function() {
        if ( !this.get('isDestroyed') && !this.get('isDestroying') ) {
          this.set('isOpen', false);
        }
      }, 100);
    },

    keyDown(event) {
      let key = event.key;
      let count = this.get('visibleSuggestions.length');

      if ( (key === 'ArrowDown' || key === 'ArrowUp') && count ) {
        event.preventDefault();
        let delta = key === 'ArrowDown' ? 1 : -1;
        let next = (this.get('activeIndex') + delta + count) % count;

        this.setProperties({activeIndex: next, isOpen: true});
        return;
      }

      if ( (key === 'Enter' || key === 'Tab') && this.get('isOpen') && this.get('activeSuggestion') ) {
        if ( key === 'Enter' ) {
          event.preventDefault();
        }
        this.acceptSuggestion(this.get('activeSuggestion'));
        return;
      }

      if ( key === 'Escape' ) {
        event.preventDefault();
        this.set('isOpen', false);
      }
    },

    chooseSuggestion(suggestion, event) {
      if ( event ) {
        event.preventDefault();
      }

      this.acceptSuggestion(suggestion);
    },

    highlightSuggestion(index) {
      this.set('activeIndex', index);
    },
  },

  willDestroyElement() {
    if ( this._blurTimer ) {
      cancel(this._blurTimer);
      this._blurTimer = null;
    }

    this._super(...arguments);
  },
});
