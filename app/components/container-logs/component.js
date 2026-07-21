import Ember from 'ember';
import ThrottledResize from 'ui/mixins/throttled-resize';
import Util from 'ui/utils/util';
import { alternateLabel } from 'ui/utils/platform';
import { formatDateTime } from 'ui/utils/date-time';

function createAnsiUp() {
  let AnsiUpModule = window.rc16AnsiUp || {};
  let AnsiUp = AnsiUpModule.AnsiUp || window.AnsiUp;
  let ansiUp = new AnsiUp();

  // The log message is escaped before ANSI conversion. ansi_up 6 escapes by
  // default, so disable that layer to avoid rendering &lt; as &amp;lt;.
  if ( 'escape_html' in ansiUp ) {
    ansiUp.escape_html = false;
  }

  return ansiUp;
}

var ansiUp = createAnsiUp();

var typeClass = {
  0: 'log-combined',
  1: 'log-stdout',
  2: 'log-stderr',
};

export default Ember.Component.extend(ThrottledResize, {
  intl: Ember.inject.service(),
  instance: null,
  alternateLabel: alternateLabel,
  showProtip: true,

  status: 'connecting',
  socket: null,

  logHeight: 300,

  onlyCombinedLog: Ember.computed.alias('instance.tty'),
  which: 'combined',
  isCombined: Ember.computed.equal('which','combined'),
  isStdOut: Ember.computed.equal('which','stdout'),
  isStdErr: Ember.computed.equal('which','stderr'),

  stdErrVisible: true,
  stdOutVisible: true,

  actions: {

    cancel: function() {
      this.disconnect();
      this.sendAction('dismiss');
    },

    clear: function() {
      var body = this.$('.log-body')[0];
      body.innerHTML = '';
      body.scrollTop = 0;
    },

    scrollToTop: function() {
      this.$('.log-body').animate({ scrollTop: '0px'});
    },

    scrollToBottom: function() {
      var body = this.$('.log-body');
      body.stop().animate({ scrollTop: (body[0].scrollHeight+1000)+'px'});
    },

    changeShow: function(which) {
      this.set('which',which);
      this.set('stdErrVisible', (which === 'combined' || which === 'stderr') );
      this.set('stdOutVisible', (which === 'combined' || which === 'stdout') );
      Ember.run.next(this, function() {
        this.send('scrollToBottom');
      });
    },
  },

  didInsertElement: function() {
    this._super();
    Ember.run.next(this, 'exec');
  },

  exec: function() {
    var instance = this.get('instance');
    var opt = {
      follow: true,
      lines: 500,
    };

    instance.doAction('logs',opt).then((logs) => {
      logs.set('instance', instance);
      this.connect(logs);
    });
  },

  connect: function(logs) {
    var url = logs.get('url') +'?token='+ encodeURIComponent(logs.get('token'));
    var socket = new WebSocket(url);
    this.set('socket', socket);

    var body = this.$('.log-body')[0];
    var $body = $(body);

    this.set('status','initializing');

    socket.onopen = () => {
      this.set('status','connected');
    };

    socket.onmessage = (message) => {
      this.set('status','connected');

      var isFollow = ($body.scrollTop() + $body.outerHeight() + 10) >= body.scrollHeight;

      //var framingVersion = message.data.substr(0,1); -- Always 0
      var type = parseInt(message.data.substr(1,1),10); // 0 = combined, 1 = stdout, 2 = stderr

      message.data.substr(2).trim().split(/\n/).forEach((line) => {
        var match = line.match(/^\[?([^ \]]+)\]?\s?/);
        var dateStr, msg;
        if ( match )
        {
          msg = line.substr(match[0].length);
          dateStr = '<span class="log-date">' + Util.escapeHtml(formatDateTime(match[1])) + '</span>';
        }
        else
        {
          msg = line;
          dateStr = '<span class="log-date">' +
            Util.escapeHtml(this.get('intl').t('containerLogs.unknownDate')) + '</span>';
        }

        body.insertAdjacentHTML('beforeend',
          '<div class="log-msg '+ typeClass[type]  +'">' +
            dateStr +
            ansiUp.ansi_to_html(Util.escapeHtml(msg)) +
          '</div>'
        );
      });

      if ( isFollow )
      {
        Ember.run.next(() => {
          this.send('scrollToBottom');
        });
      }
    };

    socket.onclose = () => {
      if ( this.isDestroyed || this.isDestroying ) {
        return;
      }

      this.set('status','disconnected');
    };
  },

  disconnect: function() {
    this.set('status','closed');

    var socket = this.get('socket');
    if (socket)
    {
      socket.close();
      this.set('socket', null);
    }
  },

  onResize: function() {
    this.$('.log-body').css('height', Math.max(200, ($(window).height() - this.get('logHeight'))) + 'px');
  },

  willDestroyElement: function() {
    this.disconnect();
    this._super();
  }
});
