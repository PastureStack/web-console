import { CommandError, COMMAND_VERSION } from './ai-command-contract';

function randomReference() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// References are capabilities only inside this page's current command context.
// The server must still authorize every request; no token is persisted here.
export class CommandContext {
  constructor(readSnapshot, random = randomReference) {
    this.readSnapshot = readSnapshot;
    this.random = random;
    this.mode = 'off';
    this.epoch = 0;
    this.references = new Map();
    this.signature = null;
  }

  invalidate() { this.epoch++; this.references.clear(); this.signature = null; }
  setMode(mode) {
    mode = ['enabled', 'read-only'].includes(mode) ? mode : 'off';
    if ( mode !== this.mode ) { this.mode = mode; this.invalidate(); }
  }

  snapshot() {
    const value = this.readSnapshot();
    const signature = JSON.stringify([value.generation, value.accountId, value.projectId,
      value.schemaProjectId, value.schemaGeneration, value.route, COMMAND_VERSION]);
    if ( signature !== this.signature ) {
      this.epoch++;
      this.references.clear();
      this.signature = signature;
    }
    return Object.freeze(Object.assign({}, value, {epoch: this.epoch, mode: this.mode, signature}));
  }

  capture() {
    const value = this.snapshot();
    if ( value.mode === 'off' || !value.generation || !value.accountId || !value.projectId ||
      value.projectId !== value.schemaProjectId ) { throw new CommandError('UNAVAILABLE'); }
    return value;
  }

  assertCurrent(captured, signal) {
    const current = this.snapshot();
    if ( !captured || captured.epoch !== current.epoch || captured.signature !== current.signature ||
      current.mode === 'off' || current.mode !== captured.mode ) { throw new CommandError('CONTEXT_CHANGED'); }
    if ( signal && signal.aborted ) { throw new CommandError('CANCELLED'); }
  }

  reference(kind, data, captured) {
    this.assertCurrent(captured);
    const reference = `${kind}_${this.random()}`;
    this.references.set(reference, {kind, data, epoch: captured.epoch});
    return reference;
  }

  resolve(reference, kind, captured) {
    this.assertCurrent(captured);
    const entry = this.references.get(reference);
    if ( !entry || entry.kind !== kind || entry.epoch !== captured.epoch ) { throw new CommandError('STALE_REFERENCE', kind === 'cursor' ? 'cursor' : `${kind}Ref`); }
    return entry.data;
  }
}
