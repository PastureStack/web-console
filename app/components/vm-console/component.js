import { next } from '@ember/runloop';
import Component from '@ember/component';
import parseUri from 'ui/utils/parse-uri';
import Util from 'ui/utils/util';

import { observer, computed } from '@ember/object';

export default Component.extend({
  classNames: ['vm-console'],
  instance : null,

  status   : 'Connecting...',
  rfb      : null,
  rfbState : null,
  showProtip: true,
  embedded: false,

  actions: {
    outsideClick() {
    },

    cancel() {
      this.disconnect();
      this.sendAction('dismiss');
    },

    ctrlAltDelete() {
      this.get('rfb').sendCtrlAltDel();
    },
  },

  didInsertElement() {
    this._super();
    next(this, 'exec');
  },

  willDestroyElement() {
    this.disconnect();
    this._super();
  },


  exec() {
    var instance = this.get('instance');
    instance.doAction('console').then((exec) => {
      exec.set('instance', instance);
      this.connect(exec);
    }).catch((err) => {
      this.set('status', 'Error:', err);
    });
  },

  connect(exec) {
    var parts = parseUri(exec.get('url'));

    var self = this;
    function updateState(rfb, state, oldstate, msg) {
      if ( self.isDestroyed || self.isDestroying || self.get('userClosed') ) {
        return;
      }

      if (typeof msg !== 'undefined')
      {
        self.set('status', (msg+'').replace(/ \(unencrypted\)/,''));
      }

      self.set('rfbState', state);
      self.sendAction('stateChanged', state, msg);
    }

    var rfb = new NoVNC.RFB({
      target: this.$('.console-canvas')[0],
      encrypt: parts.protocol === 'wss',
      true_color: true,
      local_cursor: true,
      shared: true,
      view_only: false,
      onUpdateState: updateState,
      wsProtocols: ['binary'],
    });

    var path = Util.addQueryParam(parts.path.substr(1), 'token', exec.get('token'));

    rfb.connect(parts.host, parts.port, null, path);

    this.set('rfb', rfb);
  },

  rfbStateChanged: observer('rfbState', function() {
    if ( this.get('rfbState') === 'disconnected' && !this.get('userClosed') )
    {
      this.send('cancel');
    }

    if ( this.get('rfbState') === 'normal' )
    {
      var $body = this.$('.console-body');
      var width = this.$('CANVAS').width() + parseInt($body.css('padding-left'),10) + parseInt($body.css('padding-right'),10);
      $body.width(width);
    }
  }),

  disconnect() {
    this.set('status','Closed');
    this.set('userClosed',true);

    var rfb = this.get('rfb');
    if (rfb)
    {
      rfb.disconnect();
      this.set('rfb', null);
    }
  },

  ctrlAltDeleteDisabled: computed('rfbState', function() {
    return this.get('rfbState') !== 'normal';
  }),

});
