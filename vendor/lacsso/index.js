/* jshint node: true */
'use strict';
var merge = require('merge');
var templateCompilationPlugin = require.resolve('babel-plugin-ember-template-compilation');
var templateCompiler = require.resolve('ember-source/ember-template-compiler/index.js');

module.exports = {
  name: 'lacsso',
  options: {
    babel: {
      plugins: [[
        templateCompilationPlugin,
        {
          compilerPath: templateCompiler,
          enableLegacyModules: [
            'ember-cli-htmlbars',
            'ember-cli-htmlbars-inline-precompile',
            'htmlbars-inline-precompile'
          ]
        },
        'lacsso-template-compilation'
      ]]
    }
  },
  included: function(app) {
    this._super.included(app);

    //app.import(app.bowerDirectory + '/pasturestack-icons/style.scss', {overwrite: true});
    //app.import(app.bowerDirectory + '/pasturestack-icons/fonts/pasturestack-icons.svg',{destDir: 'assets/fonts/', overwrite: true});
    //app.import(app.bowerDirectory + '/pasturestack-icons/fonts/pasturestack-icons.ttf',{destDir: 'assets/fonts/', overwrite: true});
    //app.import(app.bowerDirectory + '/pasturestack-icons/fonts/pasturestack-icons.woff',{destDir: 'assets/fonts/', overwrite: true});
    //app.import(app.bowerDirectory + '/pasturestack-icons/fonts/pasturestack-icons.woff2',{destDir: 'assets/fonts/', overwrite: true});
    //app.import('vendor/fonts/prompt-v1-latin-700.woff',{destDir: 'assets/fonts/', overwrite: true});
    //app.import('vendor/fonts/prompt-v1-latin-700.woff2',{destDir: 'assets/fonts/', overwrite: true});
    //app.import('vendor/fonts/prompt-v1-latin-regular.woff',{destDir: 'assets/fonts/', overwrite: true});
    //app.import('vendor/fonts/prompt-v1-latin-regular.woff2',{destDir: 'assets/fonts/', overwrite: true});
  },

};
