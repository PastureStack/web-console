import Service, { service } from '@ember/service';
import { registerCommandTools } from 'ui/utils/webmcp-tools';

export function nativeWebMCP() {
  if ( typeof window === 'undefined' || typeof document === 'undefined' || !window.isSecureContext ||
    typeof window.AbortController !== 'function' ) { return null; }
  const modelContext = document.modelContext;
  return modelContext && typeof modelContext.registerTool === 'function' ? modelContext : null;
}

export default Service.extend({
  commandContext: service('ai-command-context'),
  commands: service('ai-command-service'),
  mode: 'off',
  status: 'disabled',

  init() {
    this._super(...arguments);
    this.get('commandContext').on('changed', this, this.refresh);
  },

  setMode(mode) {
    this.set('mode', ['enabled', 'read-only'].includes(mode) ? mode : 'off');
    return this.refresh();
  },

  async refresh() {
    if ( this.isDestroying || this.isDestroyed ) { return; }
    const refreshEpoch = this._refreshEpoch = (this._refreshEpoch || 0) + 1;
    const context = this.get('commandContext').context;
    let registration;
    try {
      if ( this._registration ) { this._registration.dispose(); this._registration = null; }
      context.setMode('off');
      this.get('commands').dismissPendingPlan();
      if ( this.get('mode') === 'off' ) { this.set('status', 'disabled'); return; }
      // This is the sole browser API boundary. No polyfill, remote SDK, probe
      // request, API credential export, or ordinary UI authentication change.
      const modelContext = nativeWebMCP();
      if ( !modelContext ) { this.set('status', 'unsupported'); return; }
      context.setMode(this.get('mode'));
      registration = registerCommandTools({modelContext, engine: this.get('commands').engine, context});
      this._registration = registration;
      this.set('status', 'registering');
      await registration.ready;
      if ( refreshEpoch !== this._refreshEpoch || this.isDestroying || this.isDestroyed ) {
        registration.dispose();
        return;
      }
      this.set('status', 'enabled');
    } catch (error) {
      if ( registration ) { registration.dispose(); }
      // An old rejection must not disable or remove a newer registration.
      if ( refreshEpoch !== this._refreshEpoch || this.isDestroying || this.isDestroyed ) { return; }
      this._registration = null;
      context.setMode('off');
      this.set('status', 'unavailable');
    }
  },

  willDestroy() {
    this._refreshEpoch = (this._refreshEpoch || 0) + 1;
    this.get('commandContext').off('changed', this, this.refresh);
    this.get('commandContext').context.setMode('off');
    if ( this._registration ) { this._registration.dispose(); this._registration = null; }
    this._super(...arguments);
  },
});
