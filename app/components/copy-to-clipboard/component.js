import { computed } from '@ember/object';
import { later, cancel } from '@ember/runloop';
import { service } from '@ember/service';
import $ from 'jquery';
import Component from '@ember/component';
import { isSafari } from 'ui/utils/platform';

const DELAY = 1000;
const DEFAULT_TEXT = 'copyToClipboard.tooltip';

export default Component.extend({
  tagName          : 'div',
  classNames       : ['copy-button-container', 'inline-block'],

  intl             : service(),
  feedbackTimer    : null,

  /*Component Params*/
  buttonText       : null,
  tooltipText      : null,
  status           : null,
  size             : null,
  target           : null,
  clipboardText    : null,
  textChangedEvent : null,

  tooltipLabel: computed('status', 'tooltipText', 'intl._locale', function() {
    const status = this.get('status');
    if (status) {
      return this.get('intl').t(status === 'success' ? 'copyToClipboard.copied' : 'copyToClipboard.failed');
    }
    // Callers may supply an already translated literal. An empty literal uses
    // the default, including before hover and for keyboard activation.
    return this.get('tooltipText') || this.get('intl').t(DEFAULT_TEXT);
  }),

  willDestroyElement() {
    cancel(this.get('feedbackTimer'));
    this._super(...arguments);
  },

  showFeedback(status, trigger) {
    if (this.isDestroyed || this.isDestroying) {
      return;
    }
    cancel(this.get('feedbackTimer'));
    this.set('status', status);
    this.set('textChangedEvent', trigger);
    this.set('feedbackTimer', later(this, function() {
      if (!this.isDestroyed && !this.isDestroying) {
        this.setProperties({status: null, feedbackTimer: null});
      }
    }, status === 'success' ? DELAY : 5000));
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

      try {
        // Keep the write in the user gesture, including the HTTP fallback.
        if (navigator.clipboard && window.isSecureContext) {
          copyPromise = navigator.clipboard.writeText(text);
        } else {
          let textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          try {
            textarea.select();
            let copied = document.execCommand('copy');
            copyPromise = copied ? Promise.resolve() : Promise.reject(new Error('copy command failed'));
          } finally {
            textarea.remove();
          }
        }
      } catch (error) {
        copyPromise = Promise.reject(error);
      }

      return Promise.resolve(copyPromise).then(
        () => this.showFeedback('success', trigger),
        () => this.showFeedback('error', trigger)
      );
    },
  },

  buttonClasses: computed('status', 'size', function() {
    let status = this.get('status');
    let out = '';

    if (status === 'error') {
      out = 'btn btn-danger';
    } else if (status) {
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
