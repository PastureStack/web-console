'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'app');
const issues = [];

const nativeElements = new Set(`
  a abbr address area article aside audio b base bdi bdo blockquote body br
  button canvas caption cite code col colgroup data datalist dd del details dfn
  dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4
  h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li
  link main map mark menu meta meter nav noscript object ol optgroup option
  output p picture pre progress q rp rt ruby s samp script search section select
  slot small source span strong style sub summary sup table tbody td template
  textarea tfoot th thead time title tr track u ul var video wbr svg animate
  animatemotion animatetransform circle clippath defs desc ellipse feblend
  fecolormatrix fecomponenttransfer fecomposite feconvolvematrix
  fediffuselighting fedisplacementmap fedistantlight fedropshadow feflood
  fefunca fefuncb fefuncg fefuncr fegaussianblur feimage femerge femergenode
  femorphology feoffset fepointlight fespecularlighting fespotlight fetile
  feturbulence filter foreignobject g image line lineargradient marker mask
  metadata mpath path pattern polygon polyline radialgradient rect set stop
  switch symbol text textpath tspan use view
`.trim().split(/\s+/));

function filesUnder(directory, extension) {
  let output = [];

  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const fullPath = path.join(directory, entry.name);

    if ( entry.isDirectory() ) {
      output = output.concat(filesUnder(fullPath, extension));
    } else if ( entry.isFile() && fullPath.endsWith(extension) ) {
      output.push(fullPath);
    }
  }

  return output.sort();
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walkTemplate(node, scope, seen, elements, sourceFile) {
  if ( !node || typeof node !== 'object' ) {
    return;
  }

  if ( Array.isArray(node) ) {
    node.forEach((child) => walkTemplate(child, scope, seen, elements, sourceFile));
    return;
  }

  if ( seen.has(node) ) {
    return;
  }
  seen.add(node);

  if ( node.type === 'Program' ) {
    const nextScope = scope.concat(node.blockParams || []);
    walkTemplate(node.body || [], nextScope, seen, elements, sourceFile);
    return;
  }

  if ( node.type === 'ElementNode' ) {
    const rawTag = node.tag || (node.path && node.path.original) || '';
    const tag = String(rawTag).toLowerCase();
    const shadow = scope.find((name) => String(name).toLowerCase() === tag);

    if ( tag ) {
      elements.add(tag);
    }

    if ( shadow && nativeElements.has(tag) ) {
      const line = node.loc && node.loc.start ? node.loc.start.line : '?';
      issues.push(`${relative(sourceFile)}:${line}: <${rawTag}> shadows lexical |${shadow}|`);
    }

    const nextScope = scope.concat(node.blockParams || []);
    walkTemplate(node.attributes || [], scope, seen, elements, sourceFile);
    walkTemplate(node.modifiers || [], scope, seen, elements, sourceFile);
    walkTemplate(node.comments || [], scope, seen, elements, sourceFile);
    walkTemplate(node.children || [], nextScope, seen, elements, sourceFile);
    return;
  }

  Object.entries(node).forEach(([key, value]) => {
    if ( key !== 'loc' && key !== 'type' && key !== 'parent' && value && typeof value === 'object' ) {
      walkTemplate(value, scope, seen, elements, sourceFile);
    }
  });
}

async function main() {
const compiler = await import('ember-source/ember-template-compiler/index.js');
const templateElements = new Map();
const templateFiles = filesUnder(appRoot, '.hbs');

for (const file of templateFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const moduleName = relative(file);

  try {
    compiler.precompile(source, {moduleName});
    const ast = compiler._preprocess(source, {moduleName});
    const elements = new Set();

    walkTemplate(ast, [], new WeakSet(), elements, file);
    templateElements.set(moduleName, elements);
  } catch (error) {
    issues.push(`${moduleName}: template compilation failed: ${error.message}`);
  }
}

const requiredNativeElements = {
  'app/components/new-select/template.hbs': ['option', 'optgroup'],
  'app/components/schema/input-enum/template.hbs': ['select', 'option'],
  'app/components/schema/input-secret/template.hbs': ['select', 'option'],
  'app/components/schema/input-service/template.hbs': ['select', 'option', 'optgroup'],
};

Object.entries(requiredNativeElements).forEach(([file, required]) => {
  const actual = templateElements.get(file) || new Set();

  required.forEach((tag) => {
    if ( !actual.has(tag) ) {
      issues.push(`${file}: expected native <${tag}> control is missing`);
    }
  });
});

const constantsSource = fs.readFileSync(path.join(appRoot, 'utils/constants.js'), 'utf8');
const supportedBlock = constantsSource.match(/C\.SUPPORTED_SCHEMA_INPUTS\s*=\s*\[([\s\S]*?)\];/);

if ( !supportedBlock ) {
  issues.push('app/utils/constants.js: supported Catalog input list is missing');
}

const supportedInputs = supportedBlock ?
  Array.from(supportedBlock[1].matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]) : [];

supportedInputs.forEach((type) => {
  const componentPath = path.join(appRoot, 'components/schema', `input-${type}`, 'component.js');

  if ( !fs.existsSync(componentPath) ) {
    issues.push(`${relative(componentPath)}: supported Catalog input component is missing`);
  }
});

const catalogTemplate = fs.readFileSync(path.join(appRoot, 'components/new-catalog/template.hbs'), 'utf8');
if ( !catalogTemplate.includes('{{component question.inputComponent field=question value=question.answer}}') ) {
  issues.push('app/components/new-catalog/template.hbs: dynamic Catalog question renderer contract changed');
}

function memberChain(node) {
  if ( !node ) {
    return [];
  }

  if ( node.type === 'Identifier' ) {
    return [node.name];
  }

  if ( node.type === 'ThisExpression' ) {
    return ['this'];
  }

  if ( node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier' ) {
    return memberChain(node.object).concat(node.property.name);
  }

  return [];
}

function isComputedDescriptor(node) {
  if ( !node || node.type !== 'CallExpression' ) {
    return false;
  }

  const chain = memberChain(node.callee);
  return chain[0] === 'Ember' && chain[1] === 'computed';
}

function objectContainsComputedDescriptor(node) {
  if ( !node || node.type !== 'ObjectExpression' ) {
    return false;
  }

  return node.properties.some((property) => property && isComputedDescriptor(property.value));
}

function walkJavaScript(node, file, seen) {
  if ( !node || typeof node !== 'object' || seen.has(node) ) {
    return;
  }
  seen.add(node);

  if ( node.type === 'AssignmentExpression' && memberChain(node.left)[0] === 'this' && isComputedDescriptor(node.right) ) {
    issues.push(`${relative(file)}:${node.loc.start.line}: computed descriptor assigned directly to an instance`);
  }

  if ( node.type === 'CallExpression' ) {
    const chain = memberChain(node.callee);
    const isInstanceSet = chain[0] === 'this' && chain[1] === 'set';
    const isInstanceSetProperties = chain[0] === 'this' && chain[1] === 'setProperties';

    if ( isInstanceSet && node.arguments.some(isComputedDescriptor) ) {
      issues.push(`${relative(file)}:${node.loc.start.line}: computed descriptor passed to this.set()`);
    }

    if ( isInstanceSetProperties && node.arguments.some(objectContainsComputedDescriptor) ) {
      issues.push(`${relative(file)}:${node.loc.start.line}: computed descriptor passed to this.setProperties()`);
    }
  }

  Object.entries(node).forEach(([key, value]) => {
    if ( key !== 'loc' && key !== 'tokens' && key !== 'comments' && value && typeof value === 'object' ) {
      if ( Array.isArray(value) ) {
        value.forEach((child) => walkJavaScript(child, file, seen));
      } else {
        walkJavaScript(value, file, seen);
      }
    }
  });
}

const javascriptFiles = filesUnder(appRoot, '.js');
for (const file of javascriptFiles) {
  try {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module',
      plugins: ['decorators-legacy', 'classProperties', 'objectRestSpread', 'dynamicImport'],
    });
    walkJavaScript(ast, file, new WeakSet());
  } catch (error) {
    issues.push(`${relative(file)}: JavaScript parse failed: ${error.message}`);
  }
}

if ( issues.length ) {
  issues.forEach((issue) => console.error(`CATALOG_FORM_CONTRACT_ERROR ${issue}`));
  process.exit(1);
}

console.log(
  `UI_CATALOG_FORM_CONTRACT_OK templates=${templateFiles.length} ` +
  `javascript=${javascriptFiles.length} inputs=${supportedInputs.length} ` +
  'native_shadow=0 runtime_computed_assignment=0'
);
}

main().catch((error) => {
  console.error(`UI_CATALOG_FORM_CONTRACT_ERROR ${error.stack || error}`);
  process.exitCode = 1;
});
