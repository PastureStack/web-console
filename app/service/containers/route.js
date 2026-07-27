import Ember from 'ember';
import MultiStatsSocket from 'ui/utils/multi-stats';

export default Ember.Route.extend({
  statsSocket: null,

  model() {
    // Load the hosts for the instances if they're not already there
    var service = this.modelFor('service').get('service');
    return service;
  },

  setupController() {
    this._super.apply(this,arguments);
    this.bindVisibilityHandler();

    if ( !document.hidden ) {
      this.connectStats();
    }
  },

  connectStats() {
    this.closeStatsSocket();

    let stats = MultiStatsSocket.create({
      resource: this.modelFor('service').get('service'),
      linkName: 'containerStats',
    });

    this.set('statsSocket', stats);
    stats.on('dataPoint', (data) => {
      var controller = this.get('controller');
      if (controller) {
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
        this.connectStats();
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
