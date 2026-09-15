import Service from '@ember/service';
import BrowserStore from 'ui/utils/browser-storage';

export default Service.extend(BrowserStore, {
  backing: window.localStorage,

  // Multiple browser windows to the same URL will send 'storage' events
  // between each other when a setting changes.
  init: function() {
    this._super();
    $(window).on('storage', (event) => {
      var key = event.originalEvent.key;
      var old = event.originalEvent.oldValue;
      var neu = event.originalEvent.newValue;

      if ( old !== neu )
      {
        this.notifyPropertyChange(key);

        // Authentication ownership is coordinated by auth-session.  A
        // localStorage notification is only evidence that another tab wrote
        // something; it is never authority to revoke the current cookie.
      }
    });
  },
});
