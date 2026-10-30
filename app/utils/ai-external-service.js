import {CommandError} from './ai-command-contract';

export function isExternalHostname(value) {
  if ( typeof value !== 'string' || !value || value.length > 253 ) { return false; }
  const host = value.endsWith('.') ? value.slice(0, -1) : value;
  return !!host && host.split('.').every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
}

export function isExternalAddress(value) {
  if ( typeof value !== 'string' || value.length > 45 ) { return false; }
  const ipv4 = (text) => text.split('.').length === 4 && text.split('.').every((part) => /^(?:0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
  if ( !value.includes(':') ) { return ipv4(value); }
  if ( !/^[0-9A-Fa-f:.]+$/.test(value) || (value.match(/:/g) || []).length < 2 ) { return false; }
  let normalized = value;
  if ( value.includes('.') ) {
    const last = value.lastIndexOf(':'), tail = value.slice(last + 1);
    if ( !ipv4(tail) ) { return false; }
    normalized = `${value.slice(0, last)}:0:0`;
  }
  if ( normalized.includes(':::') || normalized.split('::').length > 2 ) { return false; }
  const parts = normalized.split(':').filter(Boolean);
  return parts.every((part) => /^[0-9A-Fa-f]{1,4}$/.test(part)) &&
    (normalized.includes('::') ? parts.length < 8 : parts.length === 8 && !normalized.startsWith(':') && !normalized.endsWith(':'));
}

export function validateExternalServiceParameters(operation, parameters) {
  if ( !['create', 'update_targets'].includes(operation) ) { return; }
  const hasHost = Object.prototype.hasOwnProperty.call(parameters, 'hostname');
  const hasIps = Object.prototype.hasOwnProperty.call(parameters, 'externalIpAddresses');
  if ( hasHost === hasIps ) { throw new CommandError('INVALID_INPUT', 'parameters'); }
  if ( hasHost && !isExternalHostname(parameters.hostname) ) { throw new CommandError('INVALID_INPUT', 'parameters.hostname'); }
  const ips = parameters.externalIpAddresses;
  if ( hasIps && (!Array.isArray(ips) || ips.length < 1 || ips.length > 16 || ips.some((item) => !isExternalAddress(item)) || new Set(ips).size !== ips.length) ) {
    throw new CommandError('INVALID_INPUT', 'parameters.externalIpAddresses');
  }
}
