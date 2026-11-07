import {CommandError} from './ai-command-contract';

export const ALIAS_WORKFLOW = Object.freeze(['create', 'update_targets', 'optional_start']);
export const ALIAS_CREATE_NEXT_STEP = 'Only an empty stopped Alias is being created; no targets are bound yet. After this create operation is verified, find the new dnsService by its exact name and Stack, then preview update_targets with the selected same-session serviceRefs for a separate human approval. Start is another optional approved plan. Do not report the complete Alias workflow as finished after create.';

export function aliasTargetIds(references, resolve) {
  if ( !Array.isArray(references) || references.length > 16 ) { throw new CommandError('INVALID_INPUT', 'parameters.serviceRefs'); }
  const ids = [];
  for ( const reference of references ) {
    const target = resolve(reference);
    if ( target.scope !== 'project' || !['service', 'dnsService', 'externalService', 'loadBalancerService'].includes(target.resourceType) || ids.includes(target.id) ) {
      throw new CommandError('INVALID_INPUT', 'parameters.serviceRefs');
    }
    ids.push(target.id);
  }
  return ids;
}

export function isServiceLinkName(value) {
  if ( value === null || value === '' ) { return true; }
  return typeof value === 'string' && value.length <= 253 && /^[A-Za-z0-9_.-]+$/.test(value) &&
    value.split('.').every(part => part.length >= 1 && part.length <= 63 && !part.startsWith('-') && !part.endsWith('-') && !part.includes('--'));
}

export function ordinaryServiceLinks(links, resolve) {
  if ( !Array.isArray(links) || links.length > 16 ) { throw new CommandError('INVALID_INPUT', 'parameters.links'); }
  const pairs = new Set();
  return links.map(link => {
    if ( !link || typeof link !== 'object' || Array.isArray(link) || ![Object.prototype, null].includes(Object.getPrototypeOf(link)) ||
      Object.keys(link).length !== 2 || !Object.prototype.hasOwnProperty.call(link, 'serviceRef') || !Object.prototype.hasOwnProperty.call(link, 'name') || !isServiceLinkName(link.name) ) {
      throw new CommandError('INVALID_INPUT', 'parameters.links');
    }
    const target = resolve(link.serviceRef), pair = JSON.stringify([target.id, link.name === null ? '' : link.name]);
    if ( target.scope !== 'project' || target.resourceType !== 'service' || pairs.has(pair) ) { throw new CommandError('INVALID_INPUT', 'parameters.links'); }
    pairs.add(pair);
    return {serviceId: target.id, name: link.name};
  });
}

export function safeAliasTargetSummary(value) {
  if ( value === null ) { return; }
  let names;
  try { names = JSON.parse(value); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
  if ( !Array.isArray(names) || names.length > 16 || names.some((name) => typeof name !== 'string' || name.length > 768) ) {
    throw new CommandError('INVALID_RESPONSE');
  }
  return names;
}
