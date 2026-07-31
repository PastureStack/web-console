import Route from '@ember/routing/route';
import MultiStatsSocket from 'ui/utils/multi-stats';

export default Route.extend({
  statsSocket: null,

  model() {
    return this.modelFor('host').get('host');
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
