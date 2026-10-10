import { once, next, cancel } from '@ember/runloop';
import Component from '@ember/component';

export default Component.extend({
  // Inputs
  // You can either set model or name+description
  model                  : null,
  name                   : null,
  description            : null,

  _name                  : '',
  _description           : '',

  nameLabel              : 'formNameDescription.name.label',
  namePlaceholder        : 'formNameDescription.name.placeholder',
  nameHelpText           : '',
  nameRequired           : false,
  nameDisabled           : false,

  descriptionLabel       : 'formNameDescription.description.label',
  descriptionHelp        : '',
  descriptionPlaceholder : 'formNameDescription.description.placeholder',
  descriptionRequired    : false,
  descriptionDisabled    : false,
  descriptionShown       : true,
  autoFocus              : true,

  init() {
    this._super(...arguments);

    if ( this.get('model') ) {
      this.modelChanged();
    } else {
      this.setProperties({
        _name: this.get('name'),
        _description: this.get('description'),
      });
    }
  },

  modelChanged: function() {
    this.setProperties({
      _name: this.get('model.name'),
      _description: this.get('model.description'),
    });
  }.observes('model'),

  nameChanged: function() {
   once(() => {
    let val = this.get('_name');
    if ( this.get('model') ) {
      this.set('model.name', val);
    } else {
      this.set('name', val);
    }
   });
  }.observes('_name'),

  descriptionChanged: function() {
   once(() => {
    let val = this.get('_description');
    if ( this.get('model') ) {
      this.set('model.description', val);
    } else {
      this.set('description', val);
    }
   });
  }.observes('_description'),

  didInsertElement() {
    if ( !this.get('autoFocus') ) {
      return;
    }

    this._autoFocusTimer = next(() => {
      this._autoFocusTimer = null;
      if ( this.isDestroyed || this.isDestroying ) {
        return;
      }

      const firstEditableField = this.$('INPUT:enabled, TEXTAREA:enabled')[0];
      if ( firstEditableField ) {
        firstEditableField.focus();
      }
    });
  },

  willDestroyElement() {
    if ( this._autoFocusTimer ) { cancel(this._autoFocusTimer); this._autoFocusTimer = null; }
    this._super(...arguments);
  },

  willDestroy() {
    if ( this._autoFocusTimer ) { cancel(this._autoFocusTimer); this._autoFocusTimer = null; }
    this._super(...arguments);
  },
});
