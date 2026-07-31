import Service from '@ember/service';
import BrowserStore from 'ui/utils/browser-storage';

export default Service.extend(BrowserStore, {
  backing: window.sessionStorage,
});
