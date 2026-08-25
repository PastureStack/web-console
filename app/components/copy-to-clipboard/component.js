import { computed } from '@ember/object';
import { later } from '@ember/runloop';
import $ from 'jquery';
import Component from '@ember/component';
import { isSafari } from 'ui/utils/platform';

const DELAY = 1000;
const DEFAULT_TEXT = 'copyToClipboard.tooltip';

export default Component.extend({
  tagName          : 'div',
  classNames       : ['copy-button-container', 'inline-block'],

  model            : null,

  /*Component Params*/
  buttonText       : null,
  tooltipText      : null,
  status           : null,
  size             : null,
  target           : null,
  clipboardText    : null,
  textChangedEvent : null,

  mouseEnter() {
    this.set('model', new Object({tooltipText: DEFAULT_TEXT}));
  },

  isSupported: function() {
    return this.get('clipboardText.length') && (
      (navigator.clipboard && window.isSecureContext) ||
      (!isSafari || document.queryCommandSupported('copy'))
    );
  }.property('clipboardText'),

  actions: {
    copy: function(evt) {
      let text = this.get('clipboardText') || '';
      let trigger = $(evt.currentTarget);
      let copyPromise;

      if (navigator.clipboard && window.isSecureContext) {
        copyPromise = navigator.clipboard.writeText(text);
      } else {
        let textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        let copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        copyPromise = copied ? Promise.resolve() : Promise.reject(new Error('copy command failed'));
      }

      copyPromise.then(() => {
        this.set('textChangedEvent', trigger);
        this.send('alertSuccess');
      });
    },

    alertSuccess: function() {
      this.set('status', 'success');
      let orig = this.get('model.tooltipText');
      this.set('model', new Object({tooltipText: 'copyToClipboard.copied'}));

      later(() =>{
        this.set('status', null);
        this.set('model', new Object({tooltipText: orig}));
      }, DELAY);
    },
  },

  buttonClasses: computed('status', function() {
    let status = this.get('status');
    let out = '';

    if (status) {
      out = `btn btn-success`;
    } else {
      out = `btn btn-primary`;
    }

    if (this.get('size')) {
      out = `${out} small btn-link`;
    }

    return out;

  }),
});
