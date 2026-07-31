import Ember from 'ember';

function isEditableTarget(target) {
  if (!target) {
    return false;
  }

  let tag = (target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
}

function normalizeEventKey(event) {
  let key = (event.key || '').toLowerCase();

  if (!key && event.which) {
    key = String.fromCharCode(event.which).toLowerCase();
  }

  return key;
}

function shortcutMatches(shortcut, event) {
  let parts = shortcut.toLowerCase().split('+');
  let key = parts.pop();
  let wanted = {
    shift: parts.indexOf('shift') >= 0,
    ctrl: parts.indexOf('ctrl') >= 0 || parts.indexOf('control') >= 0,
    alt: parts.indexOf('alt') >= 0,
    meta: parts.indexOf('meta') >= 0 || parts.indexOf('cmd') >= 0 || parts.indexOf('command') >= 0,
  };

  return normalizeEventKey(event) === key &&
    event.shiftKey === wanted.shift &&
    event.ctrlKey === wanted.ctrl &&
    event.altKey === wanted.alt &&
    event.metaKey === wanted.meta;
}

export default Ember.Object.extend({
  enabled: true,

  init() {
    this._super(...arguments);
    this.bindings = [];
    this._handler = (event) => this.handleKeyDown(event);
    Ember.$(document).on('keydown.pasturestack-shortcuts', this._handler);
  },

  willDestroy() {
    Ember.$(document).off('keydown.pasturestack-shortcuts', this._handler);
    this._super(...arguments);
  },

  register(context, shortcuts) {
    if (!context || !shortcuts) {
      return;
    }

    this.unregister(context);
    this.bindings.push({ context, shortcuts });
  },

  unregister(context) {
    this.bindings = (this.bindings || []).filter((binding) => binding.context !== context);
  },

  enable() {
    this.set('enabled', true);
  },

  disable() {
    this.set('enabled', false);
  },

  handleKeyDown(event) {
    if (!this.get('enabled') || isEditableTarget(event.target)) {
      return true;
    }

    let bindings = this.bindings || [];
    for (let i = bindings.length - 1; i >= 0; i--) {
      let binding = bindings[i];
      let shortcuts = binding.shortcuts || {};
      let keys = Object.keys(shortcuts);

      for (let j = 0; j < keys.length; j++) {
        let shortcut = keys[j];
        if (shortcutMatches(shortcut, event)) {
          this.triggerAction(binding.context, shortcuts[shortcut]);
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }
    }

    return true;
  },

  triggerAction(context, action) {
    Ember.run(() => {
      if (typeof action === 'function') {
        action.call(context);
      } else if (context && typeof context.send === 'function') {
        context.send(action);
      }
    });
  },
});
