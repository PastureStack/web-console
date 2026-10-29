import config from 'ui/config/environment';

export function initialize(instance) {
  // The build mode is a capability ceiling. Every new page starts disabled;
  // only an explicit choice in the collaboration panel enables native tools.
  // An off build does not instantiate services or attach listeners.
  if ( config.APP.webmcpMode === 'enabled' || config.APP.webmcpMode === 'read-only' ) {
    instance.lookup('application:main').set('webmcpAvailable', true);
    instance.lookup('service:webmcp-registry').setMode('off');
  }
}

export default {name: 'webmcp', after: 'user-store', initialize};
