import { once, next } from '@ember/runloop';
import Component from '@ember/component';

import { observer } from '@ember/object';

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

  modelChanged: observer('model', function() {
    this.setProperties({
      _name: this.get('model.name'),
      _description: this.get('model.description'),
    });
  }),

  nameChanged: observer('_name', function() {
   once(() => {
    let val = this.get('_name');
    if ( this.get('model') ) {
      this.set('model.name', val);
    } else {
      this.set('name', val);
    }
   });
  }),

  descriptionChanged: observer('_description', function() {
   once(() => {
    let val = this.get('_description');
    if ( this.get('model') ) {
      this.set('model.description', val);
    } else {
      this.set('description', val);
    }
   });
  }),

  didInsertElement() {
    next(() => {
      if ( this.isDestroyed || this.isDestroying ) {
        return;
      }

      this.$('INPUT')[0].focus();
    });
  },
});
