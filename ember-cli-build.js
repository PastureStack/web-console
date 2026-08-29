/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');
var BroccoliFunnel = require('broccoli-funnel');
var BroccoliMergeTrees = require('broccoli-merge-trees');
var Funnel   = BroccoliFunnel.default || BroccoliFunnel;
var mergeTrees = BroccoliMergeTrees.default || BroccoliMergeTrees;
var util     = require('util');
var env      = EmberApp.env();
var dartSass = require('sass');
var TranslationJsonTree = require('./lib/translation-json-tree');
var RtlCssTree = require('./lib/rtl-css-tree');
var NormalizeTemplateModuleNameWebpackPlugin = require('./lib/normalize-template-module-name-webpack-plugin');


module.exports = function(defaults) {
  // Pull in a few useful environment settings for index.html to use
  var appConfig = require('./config/environment')(env).APP;
  var inline    = {};
  var themeCssOutputPaths = {
    'app-light': '/assets/ui-light.css',
    'app-dark': '/assets/ui-dark.css'
  };

  ['version', 'appName', 'baseAssets'].forEach(function(key) {
    var val = appConfig[key];

    if (val) {
      inline[key] = {
        content: val
      };
    }
  });

  var app = new EmberApp(defaults, {
    // The legacy Ember application resolves internal imports through the neutral
    // `ui/` module prefix. Keep that runtime contract while package metadata uses
    // the public @pasturestack/web-console identity.
    name: 'ui',
    storeConfigInMeta: false,
    inlineContent: inline,
    sassOptions: {
      implementation: dartSass
    },
    outputPaths: {
      app: {
        js: '/assets/ui.js',
        css: themeCssOutputPaths
      }
    },
    // ember-auto-import stages two generated entry modules in a temporary
    // Broccoli directory. Webpack's production default hashes those absolute
    // paths into module IDs, so identical clean builds can receive different
    // chunk fingerprints. Natural entry-module IDs are stable for an identical
    // graph, while deterministic chunk IDs retain cache-safe output names.
    autoImport: {
      webpack: {
        // Inline-template compilation otherwise records the absolute build
        // workspace in module metadata. Inject the normalizer after Ember Auto
        // Import assembles its strict Babel rules so clean production builds are
        // byte-for-byte reproducible and do not disclose a builder path.
        plugins: [new NormalizeTemplateModuleNameWebpackPlugin()],
        optimization: {
          moduleIds: 'natural',
          chunkIds: 'deterministic'
        }
      }
    },


    fingerprint: {
      exclude: [
        // These can be bind-mounted in
        'assets/images/logos',

        // These get version added to the query string so JS doesn't have to know the fingerprint
        'assets/intl',
        'ui-light.css', 'ui-light.rtl.css',
        'ui-dark.css',  'ui-dark.rtl.css',
        'ui.css',       'ui.rtl.css',
        'vendor.css',   'vendor.rtl.css',
      ],
      extensions: (appConfig.fingerprint === 'no' ? [] : ['js', 'css', 'png', 'jpg', 'gif', 'svg', 'map', 'woff', 'woff2', 'ttf']),
    },

    sourcemaps: {
      // Production artifacts are public and must not expose application source.
      // Keep maps for development and tests, where they remain useful for
      // diagnostics, and omit them from release candidates.
      enabled: env !== 'production',
      extensions: ['js']
    },
  });

  // Ember CLI recreates outputPaths after merging constructor options.
  // Mutate the active CSS map in place because the default packager and the
  // Sass preprocessor both retain this exact object reference. Replacing the
  // object would leave the packager pointing at the empty app.scss output and
  // silently omit the two runtime theme stylesheets.
  var activeCssOutputPaths = app.options.outputPaths.app.css;
  Object.keys(activeCssOutputPaths).forEach(function(entry) {
    delete activeCssOutputPaths[entry];
  });
  Object.assign(activeCssOutputPaths, themeCssOutputPaths);

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.
  // Tests now bundle QUnit directly instead of pulling the legacy
  // ember-cli-qunit -> ember-qunit -> ember-test-helpers chain.
  app.import('vendor/jquery/jquery.js');
  app.import('vendor/ember/ember-global-compat.js', {
    outputFile: 'assets/ember-classic-compat.js'
  });
  app.import('node_modules/qunit/qunit/qunit.css', { type: 'test' });
  app.import('node_modules/qunit/qunit/qunit.js', { type: 'test' });
  app.import('vendor/qunit-module-shim.js', { type: 'test' });
  app.import('node_modules/@xterm/xterm/css/xterm.css');
  app.import('node_modules/@xterm/xterm/lib/xterm.js');
  app.import('node_modules/@xterm/addon-fit/lib/addon-fit.js');
  // Bootstrap 5 remains the maintained interaction runtime. Its JavaScript is
  // imported from app/app.js. The console's established visual contract is
  // emitted by the theme-specific presentation bridge instead of Bootstrap 5's
  // global reboot/layout stylesheet, which is incompatible with the existing
  // application DOM and would restyle every authenticated page.
  app.import('node_modules/jgrowl/jquery.jgrowl.js');
  app.import('node_modules/jgrowl/jquery.jgrowl.css');
  app.import('node_modules/jquery.cookie/jquery.cookie.js');
  app.import('vendor/lacsso/lacsso.css');
  app.import('node_modules/billboard.js/dist/billboard.css');
  app.import('node_modules/bootstrap-multiselect/dist/js/bootstrap-multiselect.js');
  app.import('node_modules/bootstrap-multiselect/dist/css/bootstrap-multiselect.css');
  app.import('node_modules/prismjs/prism.js');
  app.import('node_modules/prismjs/components/prism-yaml.js');
  app.import('node_modules/prismjs/components/prism-bash.js');
  app.import('node_modules/lodash/lodash.js');
  app.import('node_modules/async/dist/async.js');
  app.import('vendor/position-calculator.js');
  app.import('vendor/aws-sdk-ec2.js');
  app.import('node_modules/identicon.js/pnglib.js');
  app.import('node_modules/identicon.js/identicon.js');
  app.import('node_modules/md5-jkmyers/md5.js');
  app.import('vendor/novnc.js');
  app.import('node_modules/commonmark/dist/commonmark.js');
  // Generate TOTP enrollment QR codes entirely in the browser.  The
  // provisioning secret never leaves the PastureStack origin.
  app.import('node_modules/qrcode-generator/dist/qrcode.js');
  app.import('node_modules/moment/moment.js');
  app.import('node_modules/moment/locale/de.js');
  app.import('node_modules/moment/locale/fa.js');
  app.import('node_modules/moment/locale/fr.js');
  app.import('node_modules/moment/locale/hu.js');
  app.import('node_modules/moment/locale/ja.js');
  app.import('node_modules/moment/locale/ko.js');
  app.import('node_modules/moment/locale/pt-br.js');
  app.import('node_modules/moment/locale/ru.js');
  app.import('node_modules/moment/locale/tl-ph.js');
  app.import('node_modules/moment/locale/uk.js');
  app.import('node_modules/moment/locale/zh-cn.js');
  app.import('node_modules/moment/locale/zh-tw.js');
  app.import('vendor/moment-default-locale.js');
  app.import('vendor/ansi-up/ansi-up-global.js');
  app.import('vendor/semver/semver-global.js');
  app.import('vendor/shell-quote/shell-quote-global.js');


  app.import('vendor/icons/style.css');
  app.import('vendor/icons/fonts/pasturestack-icons.svg', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/icons/fonts/pasturestack-icons.ttf', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/icons/fonts/pasturestack-icons.woff', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/icons/fonts/pasturestack-icons.woff2', {
    destDir: 'assets/fonts'
  });


  // Google Font Downloader thing: https://google-webfonts-helper.herokuapp.com/
  app.import('vendor/lato/lato-v11-latin-300.woff', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/lato/lato-v11-latin-300.woff2', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/lato/lato-v11-latin-700.woff', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/lato/lato-v11-latin-700.woff2', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/lato/lato-v11-latin-regular.woff', {
    destDir: 'assets/fonts'
  });
  app.import('vendor/lato/lato-v11-latin-regular.woff2', {
    destDir: 'assets/fonts'
  });

  var translationSource = new Funnel('translations', {
    include: ['*.yaml']
  });
  var translationJson = new TranslationJsonTree(translationSource);
  var emberLegalSource = new Funnel('vendor/ember', {
    include: ['LICENSE', 'UPSTREAM.md'],
    destDir: 'licenses/ember'
  });
  var emberFetchLegalSource = new Funnel('vendor/ember-fetch-compat', {
    include: ['LICENSE.md', 'UPSTREAM.md'],
    destDir: 'licenses/ember-fetch'
  });
  var runtimeLegalPackages = [
    'bootstrap3-layout-compat',
    'bootstrap-multiselect',
    'ember-power-select',
    'ember-basic-dropdown',
    'ember-concurrency',
    'ember-modifier'
  ];
  var runtimeLegalSources = runtimeLegalPackages.map(function(packageName) {
    return new Funnel('vendor/runtime-licenses/' + packageName, {
      include: ['LICENSE.md', 'UPSTREAM.md'],
      destDir: 'licenses/runtime/' + packageName
    });
  });

  var appTree = app.toTree();
  var rtlCss = new RtlCssTree(appTree);

  return mergeTrees([
    appTree,
    rtlCss,
    translationJson,
    emberLegalSource,
    emberFetchLegalSource
  ].concat(runtimeLegalSources), {overwrite: true});
};
