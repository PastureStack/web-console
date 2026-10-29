import config from 'ui/config/environment';
import { nativeWebMCP } from 'ui/services/webmcp-registry';

export function initialize(instance) {
  // Default-off does not instantiate services, attach listeners or request
  // data. QA/release owners must explicitly opt in at build time.
  if ( (config.APP.webmcpMode === 'enabled' || config.APP.webmcpMode === 'read-only') && nativeWebMCP() ) {
    instance.lookup('application:main').set('webmcpAvailable', true);
    instance.lookup('service:webmcp-registry').setMode(config.APP.webmcpMode);
  }
}

export default {name: 'webmcp', after: 'user-store', initialize};
