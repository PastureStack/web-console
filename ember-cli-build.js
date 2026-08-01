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


module.exports = function(defaults) {
  // Pull in a few useful environment settings for index.html to use
  var appConfig = require('./config/environment')(env).APP;
  var inline    = {};

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
        css: {
          'app-light': '/assets/ui-light.css',
          'app-dark': '/assets/ui-dark.css'
        }
      }
    },
    nodeAssets: {
      'lacsso': {
        import: ['lacsso.css']
      }
    },

    // ember-auto-import stages two generated entry modules in a temporary
    // Broccoli directory. Webpack's production default hashes those absolute
    // paths into module IDs, so identical clean builds can receive different
    // chunk fingerprints. Natural entry-module IDs are stable for an identical
    // graph, while deterministic chunk IDs retain cache-safe output names.
    autoImport: {
      webpack: {
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
  app.import('node_modules/qunit/qunit/qunit.css', { type: 'test' });
  app.import('node_modules/qunit/qunit/qunit.js', { type: 'test' });
  app.import('vendor/qunit-module-shim.js', { type: 'test' });
  app.import('vendor/ember/ember-global-compat.js');
  app.import('node_modules/@xterm/xterm/css/xterm.css');
  app.import('node_modules/@xterm/xterm/lib/xterm.js');
  app.import('node_modules/@xterm/addon-fit/lib/addon-fit.js');
  // Bootstrap 3 is out of support.  Keep its reviewed styles during the
  // compatibility migration, but only ship the two JavaScript behaviours the
  // console still uses.  In particular, do not re-introduce button.js,
  // tooltip.js, popover.js, or the aggregate bootstrap.js bundle.
  app.import('vendor/bootstrap-sass/assets/javascripts/bootstrap/transition.js');
  app.import('vendor/bootstrap-sass/assets/javascripts/bootstrap/collapse.js');
  app.import('vendor/bootstrap-sass/assets/javascripts/bootstrap/dropdown.js');
  app.import('node_modules/jgrowl/jquery.jgrowl.js');
  app.import('node_modules/jgrowl/jquery.jgrowl.css');
  app.import('node_modules/jquery.cookie/jquery.cookie.js');
  app.import('node_modules/d3/d3.js');
  app.import('node_modules/c3/c3.js');
  app.import('node_modules/c3/c3.css');
  //app.import('vendor/term.js/src/term.js');
  //app.import('bower_components/xterm.js/src/xterm.css');
  app.import('vendor/bootstrap-multiselect/bootstrap-multiselect.js');
  app.import('vendor/bootstrap-multiselect/bootstrap-multiselect.css');
  app.import('node_modules/prismjs/prism.js');
  app.import('node_modules/prismjs/components/prism-yaml.js');
  app.import('node_modules/prismjs/components/prism-bash.js');
  app.import('node_modules/lodash/lodash.js');
  app.import('node_modules/graphlib/dist/graphlib.core.js');
  app.import('node_modules/dagre/dist/dagre.core.js');
  app.import('node_modules/async/dist/async.js');
  app.import('vendor/position-calculator.js');
  app.import('vendor/aws-sdk-ec2.js');
  app.import('node_modules/identicon.js/pnglib.js');
  app.import('node_modules/identicon.js/identicon.js');
  app.import('node_modules/md5-jkmyers/md5.js');
  app.import('vendor/dagre-d3/dagre-d3.core.js');
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

  return mergeTrees([app.toTree(), translationJson, emberLegalSource], {overwrite: true});
};
