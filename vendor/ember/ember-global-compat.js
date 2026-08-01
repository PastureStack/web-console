(function(global) {
  if (typeof requireModule !== 'function') {
    return;
  }

  var emberModule = requireModule('ember');
  var Ember = global.Ember || (emberModule && (emberModule.default || emberModule));

  if (!Ember) {
    return;
  }

  global.Ember = Ember;

  var computedModule = requireModule('@ember/object/computed');
  Object.keys(computedModule).forEach(function(name) {
    if (name !== 'default' && Ember.computed[name] === undefined) {
      Ember.computed[name] = computedModule[name];
    }
  });

  var runloopModule = requireModule('@ember/runloop');
  Object.keys(runloopModule).forEach(function(name) {
    // Ember.run is itself a function. `bind` therefore resolves to the native
    // Function.prototype method unless the public runloop export is installed
    // as an own property.
    if (name !== 'default' && !Object.prototype.hasOwnProperty.call(Ember.run, name)) {
      Ember.run[name] = runloopModule[name];
    }
  });

  var templateModule = requireModule('@ember/template');
  Ember.String = Ember.String || {};

  function decamelize(value) {
    return String(value)
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }

  function dasherize(value) {
    return decamelize(value).replace(/_/g, '-');
  }

  function underscore(value) {
    return decamelize(value).replace(/-/g, '_');
  }

  function classify(value) {
    return String(value).split(/[._-]/).map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');
  }

  Ember.String.dasherize = Ember.String.dasherize || dasherize;
  Ember.String.underscore = Ember.String.underscore || underscore;
  Ember.String.classify = Ember.String.classify || classify;

  if (Ember.String.htmlSafe === undefined) {
    Ember.String.htmlSafe = templateModule.htmlSafe;
  }

  if (!String.prototype.htmlSafe && typeof templateModule.htmlSafe === 'function') {
    Object.defineProperty(String.prototype, 'htmlSafe', {
      configurable: true,
      value: function() {
        return templateModule.htmlSafe(this.toString());
      },
      writable: true,
    });
  }

  if (!Array.prototype.findBy && Ember.NativeArray) {
    Ember.NativeArray.apply(Array.prototype);
  }

  if (!Ember.$ && global.jQuery) {
    Ember.$ = global.jQuery;
  }

  function legacySendAction(actionProperty) {
    var propertyName = actionProperty || 'action';
    var args = Array.prototype.slice.call(arguments, 1);
    var action = this.get(propertyName);

    if (typeof action === 'function') {
      return action.apply(this, args);
    }

    // Ember 6 still assigns the classic component action target internally,
    // but no longer exposes Component#sendAction. Keep that retained classic
    // boundary in this one audited shim while closure actions migrate normally.
    var target = this.get('target') || this._target;
    if (action && target && typeof target.send === 'function') {
      return target.send.apply(target, [action].concat(args));
    }
  }

  if (Ember.Component && typeof Ember.Component.prototype.sendAction !== 'function') {
    Ember.Component.reopen({
      sendAction: legacySendAction,
    });
  }

  if (Ember.Component && Ember.$ && typeof Ember.Component.prototype.$ !== 'function') {
    Ember.Component.reopen({
      $: function(selector) {
        if (!this.element) {
          return Ember.$();
        }

        var root = Ember.$(this.element);

        return selector ? root.find(selector) : root;
      },
    });
  }

  var objectModule = requireModule('@ember/object');
  var eventedModule = requireModule('@ember/object/evented');

  function installFunctionDecorator(name, decorator) {
    if (Function.prototype[name] || typeof decorator !== 'function') {
      return;
    }

    Object.defineProperty(Function.prototype, name, {
      configurable: true,
      value: function() {
        var args = Array.prototype.slice.call(arguments);
        args.push(this);
        return decorator.apply(null, args);
      },
      writable: true,
    });
  }

  installFunctionDecorator('property', objectModule.computed);
  installFunctionDecorator('observes', objectModule.observer);
  installFunctionDecorator('on', eventedModule.on);

  function textValueDidChange() {
    if (this.element) {
      this.set('value', this.element.value);
    }
  }

  function sendInputAction(component, actionName, event) {
    component.sendAction(actionName, component.get('value'), event);
  }

  function legacyTextInput(tagName, attributeBindings) {
    return Ember.Component.extend({
      tagName: tagName,
      attributeBindings: attributeBindings,
      value: '',

      _elementValueDidChange: textValueDidChange,

      input: function(event) {
        this._elementValueDidChange();
        sendInputAction(this, 'input', event);
      },

      change: function(event) {
        this._elementValueDidChange();
        sendInputAction(this, 'change', event);
      },

      focusIn: function(event) {
        this.sendAction('focus-in', this.get('value'), event);
      },

      focusOut: function(event) {
        this._elementValueDidChange();
        this.sendAction('focus-out', this.get('value'), event);
      },

      keyDown: function(event) {
        this.sendAction('key-down', this.get('value'), event);
      },

      keyPress: function(event) {
        this.sendAction('key-press', this.get('value'), event);
      },

      keyUp: function(event) {
        this._elementValueDidChange();
        this.sendAction('key-up', this.get('value'), event);

        if (event && event.keyCode === 13) {
          this.sendAction('enter', this.get('value'), event);
          this.sendAction('insert-newline', this.get('value'), event);
        } else if (event && event.keyCode === 27) {
          this.sendAction('escape-press', this.get('value'), event);
        }
      },
    });
  }

  if (!Ember.TextField) {
    Ember.TextField = legacyTextInput('input', [
      'accept', 'autocapitalize', 'autocomplete', 'autofocus', 'disabled',
      'form', 'formaction', 'formenctype', 'formmethod', 'formnovalidate',
      'formtarget', 'height', 'inputmode', 'max', 'maxlength', 'min',
      'minlength', 'multiple', 'name', 'pattern', 'placeholder', 'readonly',
      'required', 'size', 'step', 'type', 'value', 'width',
    ]);
  }

  if (!Ember.TextArea) {
    Ember.TextArea = legacyTextInput('textarea', [
      'autocapitalize', 'autocomplete', 'autofocus', 'cols', 'disabled',
      'form', 'maxlength', 'minlength', 'name', 'placeholder', 'readonly',
      'required', 'rows', 'value', 'wrap',
    ]);
  }

  if (!Ember.Checkbox) {
    Ember.Checkbox = Ember.Component.extend({
      tagName: 'input',
      type: 'checkbox',
      attributeBindings: [
        'autofocus', 'checked', 'disabled', 'form', 'name', 'required',
        'type', 'value',
      ],
      checked: false,

      change: function(event) {
        var checked = !!(this.element && this.element.checked);
        this.set('checked', checked);
        this.sendAction('change', checked, event);
      },
    });
  }
})(this);
