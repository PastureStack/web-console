'use strict';

function normalizeModuleName(rawValue) {
  var normalized = rawValue.replace(/\\+/g, '/');
  var marker = '/node_modules/';
  var markerIndex = normalized.lastIndexOf(marker);

  if (markerIndex < 0) {
    return rawValue;
  }

  return normalized.slice(markerIndex + 1);
}

function propertyNamed(types, property, name) {
  return types.isObjectProperty(property) &&
    ((types.isIdentifier(property.key) && property.key.name === name) ||
     (types.isStringLiteral(property.key) && property.key.value === name));
}

function setStringProperty(types, objectExpression, name, value) {
  var property = objectExpression.properties.find(function(candidate) {
    return propertyNamed(types, candidate, name);
  });

  if (property) {
    property.value = types.stringLiteral(value);
  } else {
    objectExpression.properties.push(
      types.objectProperty(types.identifier(name), types.stringLiteral(value))
    );
  }
}

function normalizePrecompileCalls(babel, file) {
  var types = babel.types;
  var filename = file.opts.filename || '';
  var normalized = normalizeModuleName(filename);

  if (normalized === filename) {
    return;
  }

  babel.traverse(file.ast, {
    Program: function(programPath) {
      var precompileNames = new Set();

      programPath.get('body').forEach(function(statementPath) {
        if (
          !statementPath.isImportDeclaration() ||
          statementPath.node.source.value !== '@ember/template-compilation'
        ) {
          return;
        }

        statementPath.get('specifiers').forEach(function(specifierPath) {
          if (
            specifierPath.isImportSpecifier() &&
            specifierPath.node.imported.name === 'precompileTemplate'
          ) {
            precompileNames.add(specifierPath.node.local.name);
          }
        });
      });

      programPath.traverse({
        CallExpression: function(callPath) {
          var callee = callPath.node.callee;
          if (!types.isIdentifier(callee) || !precompileNames.has(callee.name)) {
            return;
          }

          var options = callPath.node.arguments[1];
          if (!options) {
            options = types.objectExpression([]);
            callPath.node.arguments.push(options);
          }
          if (!types.isObjectExpression(options)) {
            throw callPath.buildCodeFrameError(
              'Cannot normalize an inline template with non-literal options'
            );
          }

          setStringProperty(types, options, 'moduleName', normalized);
          setStringProperty(types, options, 'filename', normalized);

          var metaProperty = options.properties.find(function(property) {
            return propertyNamed(types, property, 'meta');
          });
          if (!metaProperty) {
            metaProperty = types.objectProperty(
              types.identifier('meta'),
              types.objectExpression([])
            );
            options.properties.push(metaProperty);
          }
          if (!types.isObjectExpression(metaProperty.value)) {
            throw callPath.buildCodeFrameError(
              'Cannot normalize inline-template metadata with a non-literal meta option'
            );
          }
          setStringProperty(types, metaProperty.value, 'moduleName', normalized);
        }
      });
    }
  });
}

function normalizeTemplateModuleNameBabelPlugin(babel) {
  var types = babel.types;

  return {
    name: 'pasturestack-normalize-template-module-name',
    pre: function(file) {
      // The upstream template compiler performs its own traversal from a pre
      // hook. This plugin is injected before it, so normalize template options
      // here before the compiler derives both the module name and template ID.
      normalizePrecompileCalls(babel, file);
    },
    visitor: {
      Program: {
        exit: function(programPath) {
          programPath.traverse({
            ObjectProperty: function(propertyPath) {
              var key = propertyPath.node.key;
              var value = propertyPath.node.value;
              var isModuleName =
                (types.isIdentifier(key) && key.name === 'moduleName') ||
                (types.isStringLiteral(key) && key.value === 'moduleName');

              if (!isModuleName || !types.isStringLiteral(value)) {
                return;
              }

              var normalized = normalizeModuleName(value.value);
              if (normalized !== value.value) {
                value.value = normalized;
              }
            }
          });
        }
      }
    }
  };
}

normalizeTemplateModuleNameBabelPlugin.normalizeModuleName = normalizeModuleName;

module.exports = normalizeTemplateModuleNameBabelPlugin;
