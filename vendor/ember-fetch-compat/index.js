'use strict';

const path = require('path');

module.exports = {
  name: 'ember-fetch',

  included(app) {
    this._super.included.apply(this, arguments);

    let target = app;
    if (typeof this.import === 'function') {
      target = this;
    } else if (typeof this._findHost === 'function') {
      target = this._findHost();
    }

    target.import('vendor/ember-fetch.js', {
      exports: {
        default: [
          'default',
          'Headers',
          'Request',
          'Response',
          'AbortController'
        ]
      }
    });
  },

  treeForVendor() {
    return this.treeGenerator(path.join(__dirname, 'vendor'));
  }
};
