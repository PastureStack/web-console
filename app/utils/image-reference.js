import { compare } from 'ui/utils/parse-version';

const PATH_PART = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/;
const TAG = /^[\w][\w.-]{0,127}$/;
const RELEASE_TAG = /^v?\d+\.\d+\.\d+$/;
const DIGEST = /^(sha256:[a-f0-9]{64}|sha384:[a-f0-9]{96}|sha512:[a-f0-9]{128})$/;

// No registry request: a tag alone never proves an immutable digest identity.
export function parseImageReference(input) {
  if ( typeof input !== 'string' ) { return null; }
  let value = input.trim().replace(/^docker:(?:\/\/)?/, '');
  if ( DIGEST.test(value) ) { return {repository: null, tag: null, digest: value}; }
  let parts = value.split('@');
  if ( parts.length > 2 || (parts.length === 2 && !DIGEST.test(parts[1])) ) { return null; }
  let name = parts[0];
  let digest = parts[1] || null;
  let colon = name.lastIndexOf(':');
  let tag = colon > name.lastIndexOf('/') ? name.slice(colon + 1) : null;
  if ( tag !== null ) { name = name.slice(0, colon); }
  if ( tag !== null && !TAG.test(tag) ) { return null; }
  let path = name.split('/');
  let registry = 'docker.io';
  if ( path.length > 1 && (/[.:]/.test(path[0]) || path[0] === 'localhost') ) {
    registry = path.shift().toLowerCase();
    if ( !/^(?:[a-z0-9]+(?:[.-][a-z0-9]+)*|\[[a-f0-9:]+\])(?::\d+)?$/.test(registry) ) { return null; }
  }
  if ( registry === 'index.docker.io' ) { registry = 'docker.io'; }
  if ( registry === 'docker.io' && path.length === 1 ) { path.unshift('library'); }
  if ( !path.length || !path.every((part) => PATH_PART.test(part)) || name.length > 255 ) { return null; }
  return {repository: registry + '/' + path.join('/'), tag: tag || (digest ? null : 'latest'), digest};
}

export function sameImageReference(left, right) {
  let a = parseImageReference(left);
  let b = parseImageReference(right);
  if ( !a || !b ) { return null; }
  if ( a.digest && b.digest ) { return a.digest === b.digest; }
  if ( a.digest || b.digest ) { return null; }
  return a.repository === b.repository && a.tag === b.tag;
}

export function loadBalancerImageCandidate(current, available, canUpgrade) {
  if ( !canUpgrade ) { return null; }
  let from = parseImageReference(current);
  let to = parseImageReference(available);
  // Explicit digest pins, custom repositories/tags and unknown identities are
  // preserved. A platform default is not permission to replace those choices.
  if ( !from || !to || !from.repository || from.repository !== to.repository || from.digest ||
       !RELEASE_TAG.test(from.tag || '') || !RELEASE_TAG.test(to.tag || '') ||
       compare(from.tag, to.tag) >= 0 ) { return null; }
  return {from: current.replace(/^docker:(?:\/\/)?/, ''), to: available.replace(/^docker:(?:\/\/)?/, ''),
    fromLabel: from.tag, toLabel: to.tag};
}
