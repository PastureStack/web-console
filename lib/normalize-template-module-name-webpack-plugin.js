'use strict';

var babelPluginPath = require.resolve('./normalize-template-module-name-babel-plugin');

function pluginPath(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function addNormalizerToUse(use) {
  var entries = Array.isArray(use) ? use : [use];
  var additions = 0;

  entries.forEach(function(entry) {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    var loader = entry.loader || '';
    if (loader !== 'babel-loader-8' && !/[\\/]babel-loader(?:[\\/]|$)/.test(loader)) {
      return;
    }

    entry.options = entry.options || {};
    entry.options.plugins = entry.options.plugins || [];
    if (!entry.options.plugins.some(function(plugin) {
      return pluginPath(plugin) === babelPluginPath;
    })) {
      entry.options.plugins.unshift(babelPluginPath);
      additions += 1;
    }
  });

  return additions;
}

function injectNormalizer(rules) {
  var additions = 0;

  (rules || []).forEach(function(rule) {
    if (!rule || typeof rule !== 'object') {
      return;
    }

    if (rule.use) {
      additions += addNormalizerToUse(rule.use);
    }
    if (rule.rules) {
      additions += injectNormalizer(rule.rules);
    }
    if (rule.oneOf) {
      additions += injectNormalizer(rule.oneOf);
    }
  });

  return additions;
}

function NormalizeTemplateModuleNameWebpackPlugin() {}

NormalizeTemplateModuleNameWebpackPlugin.prototype.apply = function(compiler) {
  var moduleOptions = compiler.options && compiler.options.module;
  var additions = injectNormalizer(moduleOptions && moduleOptions.rules);

  if (additions === 0) {
    throw new Error('PastureStack template module-name normalizer found no Babel rules');
  }
};

NormalizeTemplateModuleNameWebpackPlugin.injectNormalizer = injectNormalizer;
NormalizeTemplateModuleNameWebpackPlugin.babelPluginPath = babelPluginPath;

module.exports = NormalizeTemplateModuleNameWebpackPlugin;
