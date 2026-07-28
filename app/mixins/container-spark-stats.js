import Ember from 'ember';
import RollingRms, { DEFAULT_WINDOW_SIZE } from 'ui/utils/rolling-rms';

const SORT_REFRESH_INTERVAL = 10000;
const METRICS = {
  cpu: {
    rmsProperty: 'cpuRms',
    sample(point) {
      return point.cpu_total || 0;
    },
  },
  memory: {
    rmsProperty: 'memoryRms',
    sample(point) {
      return point.mem_used_mb || 0;
    },
  },
  network: {
    rmsProperty: 'networkRms',
    sample(point) {
      return (point.net_rx_kb || 0) + (point.net_tx_kb || 0);
    },
  },
  storage: {
    rmsProperty: 'storageRms',
    sample(point) {
      return (point.disk_read_kb || 0) + (point.disk_write_kb || 0);
    },
  },
};
const METRIC_KEYS = Object.keys(METRICS);

function instanceStatsIds(instance) {
  if ( !instance ) {
    return [];
  }

  return [instance.get('externalId'), instance.get('id')].filter((id, index, values) => {
    return id && values.indexOf(id) === index;
  });
}

export default Ember.Mixin.create({
  sparkInstances: Ember.computed.alias('model.instances'),

  cpuMax: 0,
  memoryMax: 0,
  networkMax: 0,
  storageMax: 0,
  statsSortRevision: 0,

  init() {
    this._super(...arguments);
    this._statsById = Object.create(null);
    this._visibleStatsIds = Object.create(null);
    this._statsSortTimer = null;
  },

  actions: {
    setVisibleStatsInstances(instances) {
      this.setVisibleStatsInstances(instances);
    },
  },

  onDataPoint(point) {
    let id = point.id;

    if ( !id ) {
      return;
    }

    let state = this._statsById[id];

    if ( !state ) {
      state = {};
      METRIC_KEYS.forEach((key) => {
        state[key] = new RollingRms(DEFAULT_WINDOW_SIZE);
      });
      this._statsById[id] = state;
    }

    let instance = this.instanceForStatsId(id);
    let values = {};

    METRIC_KEYS.forEach((key) => {
      let value = METRICS[key].sample(point);

      values[key] = value;
      state[key].push(value);
    });

    if ( instance ) {
      let rmsProperties = {};

      METRIC_KEYS.forEach((key) => {
        rmsProperties[METRICS[key].rmsProperty] = state[key].rms;
      });
      instance.setProperties(rmsProperties);

      if ( this._visibleStatsIds[id] ) {
        METRIC_KEYS.forEach((key) => {
          this.updateVisibleSpark(instance, key, state[key]);
        });
      }
    }

    this.updateMetricMax('cpu', Math.max(values.cpu, (point.cpu_count || 0) * 100));
    this.updateMetricMax('memory', values.memory);
    this.updateMetricMax('network', values.network);
    this.updateMetricMax('storage', values.storage);
    this.scheduleStatsSort();
  },

  setVisibleStatsInstances(instances) {
    let visible = Object.create(null);

    (instances || []).forEach((instance) => {
      instanceStatsIds(instance).forEach((id) => {
        visible[id] = true;
      });
    });

    (this.get('sparkInstances') || []).forEach((instance) => {
      let ids = instanceStatsIds(instance);
      let stateId = ids.find((id) => this._statsById[id]);
      let isVisible = ids.some((id) => visible[id]);

      METRIC_KEYS.forEach((key) => {
        let property = `${key}Spark`;

        if ( isVisible && stateId ) {
          if ( !instance.get(property) ) {
            instance.set(property, Ember.A(this._statsById[stateId][key].toArray(true)));
          }
        } else if ( instance.get(property) ) {
          instance.set(property, null);
        }
      });
    });

    this._visibleStatsIds = visible;
  },

  updateVisibleSpark(instance, key, window) {
    let property = `${key}Spark`;
    let row = instance.get(property);

    if ( !row ) {
      instance.set(property, Ember.A(window.toArray(true)));
      return;
    }

    row.replace(0, row.length, window.toArray(true));
  },

  updateMetricMax(key, value) {
    let property = `${key}Max`;

    if ( value > this.get(property) ) {
      this.set(property, value);
    }
  },

  scheduleStatsSort() {
    if ( this._statsSortTimer ) {
      return;
    }

    this._statsSortTimer = Ember.run.later(this, function() {
      this._statsSortTimer = null;

      if ( !this.get('isDestroyed') && !this.get('isDestroying') ) {
        this.incrementProperty('statsSortRevision');
      }
    }, SORT_REFRESH_INTERVAL);
  },

  instanceForStatsId(id) {
    return this.get(`instancesByExternalId.${id}`) || this.get(`instancesById.${id}`);
  },

  // for 1.2+
  instancesByExternalId: Ember.computed('sparkInstances.@each.{id,externalId}', function() {
    let output = Ember.Object.create();

    (this.get('sparkInstances') || []).forEach((instance) => {
      let id = instance.get('externalId');

      if ( id ) {
        output.set(id, instance);
      }
    });

    return output;
  }),

  // for 1.1
  instancesById: Ember.computed('sparkInstances.@each.id', function() {
    let output = Ember.Object.create();

    (this.get('sparkInstances') || []).forEach((instance) => {
      let id = instance.get('id');

      if ( id ) {
        output.set(id, instance);
      }
    });

    return output;
  }),

  willDestroy() {
    if ( this._statsSortTimer ) {
      Ember.run.cancel(this._statsSortTimer);
      this._statsSortTimer = null;
    }

    this._statsById = null;
    this._visibleStatsIds = null;
    this._super(...arguments);
  },
});

export { METRIC_KEYS, SORT_REFRESH_INTERVAL };
