import Ember from 'ember';
import MultiStatsSocket from 'ui/utils/multi-stats';

export default Ember.Route.extend({
  statsSocket: null,

  model() {
    let host = this.modelFor('host').get('host');

    return host.followLink('instances').then((instances) => {
      return Ember.Object.create({
        host,
        instances,
      });
    });
  },

  afterModel() {
    this.bindVisibilityHandler();

    if ( !document.hidden ) {
      this.setupSocketConnection();
    }
  },

  setupSocketConnection: function() {
    this.closeStatsSocket();

    let stats = MultiStatsSocket.create({
      resource: this.modelFor('host').get('host'),
      linkName: 'containerStats',
    });

    this.set('statsSocket',stats);

    stats.on('dataPoint', (data) => {
      let controller = this.get('controller');

      if ( controller )
      {
        controller.onDataPoint(data);
      }
    });

  },

  bindVisibilityHandler() {
    if ( this._visibilityHandler ) {
      return;
    }

    this._visibilityHandler = () => {
      if ( document.hidden ) {
        this.closeStatsSocket();
      } else {
        this.setupSocketConnection();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  },

  closeStatsSocket() {
    let stats = this.get('statsSocket');

    if ( stats ) {
      stats.close();
      this.set('statsSocket', null);
    }
  },

  deactivate() {
    if ( this._visibilityHandler ) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }

    this.closeStatsSocket();
  }
});
