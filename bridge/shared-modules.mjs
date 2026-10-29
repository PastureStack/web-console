import {readFileSync} from 'node:fs';

// Ember owns these sources and their extensionless imports. Load the same files
// for Node without changing browser module IDs or maintaining a second engine.
// The list and directory are fixed: no config, tool input, or user JavaScript.
const sources = Object.freeze({
  'ai-command-contract': new URL('../app/utils/ai-command-contract.js', import.meta.url),
  'ai-command-context': new URL('../app/utils/ai-command-context.js', import.meta.url),
  'ai-command-engine': new URL('../app/utils/ai-command-engine.js', import.meta.url),
});
const urls = new Map();
const loading = new Set();

function moduleUrl(name) {
  if (!Object.hasOwn(sources, name) || loading.has(name)) throw new Error('Unsupported shared command dependency');
  if (urls.has(name)) return urls.get(name);
  loading.add(name);
  const source = readFileSync(sources[name], 'utf8').replace(/\bfrom\s+(['"])([^'"]+)\1/g, (_match, _quote, specifier) => {
    if (!specifier.startsWith('./')) throw new Error('Unsupported shared command dependency');
    const dependency = specifier.slice(2).replace(/\.js$/, '');
    return `from '${moduleUrl(dependency)}'`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  loading.delete(name);
  urls.set(name, url);
  return url;
}

const [contract, context, engine] = await Promise.all([
  import(moduleUrl('ai-command-contract')),
  import(moduleUrl('ai-command-context')),
  import(moduleUrl('ai-command-engine')),
]);
export const {COMMANDS, CommandError} = contract;
export const {CommandContext} = context;
export const {CommandEngine} = engine;
