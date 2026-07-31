import { equal } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import { parsePortSpec } from 'ui/utils/parse-port';

import { on } from '@ember/object/evented';
import { computed } from '@ember/object';

export default Component.extend({
  intl: service(),

  service: null,
  ruleType: 'portRule',
  showListeners: equal('ruleType','portRule'),

  rules: null,
  protocolChoices: null,
  showBackend: null,
  showIp: null,
  showRegion: null,
  hasRegion: null,

  onInit: on('init', function() {
    let rules = this.get('service.lbConfig.portRules');
    if ( !rules ) {
      rules = [];
      this.set('service.lbConfig.portRules', rules);
    }

    rules.forEach((rule) => {
      rule.isSelector = !!rule.selector;
    });

    this.set('rules', rules);
    if ( rules.length === 0 ) {
      this.send('addRule');
    }

    let protos = this.get('store').getById('schema','portrule').optionsFor('protocol');
    protos.removeObject('udp');
    protos.sort();
    this.set('protocolChoices', protos);

    const regions = this.get('userStore').all('region');
    this.set('hasRegion', regions.get('length') > 0);

    if ( this.get('showBackend') === null ) {
      let hasName = !!rules.findBy('backendName');
      this.set('showBackend', hasName);
    }

    if ( this.get('showIp') === null ) {
      this.get('service.launchConfig.ports').forEach((port) => {
        let parsed = parsePortSpec(port,'tcp');
        if ( parsed.hostIp ) {
          this.set('showIp', true);
        }
      });
    }

    if ( this.get('showRegion') === null ) {
      rules.forEach((rule) => {
        if ( rule.environment ) {
          this.set('showRegion', true);
        }
      });
    }
  }),

  actions: {
    addRule(isSelector) {
      let max = 0;
      let rules = this.get('rules');
      rules.forEach((rule) => {
        max = Math.max(rule.priority,max);
      });

      rules.pushObject(this.get('store').createRecord({
        type: this.get('ruleType'),
        access: 'public',
        isSelector: isSelector,
        protocol: 'http',
        priority: max+1,
      }));
    },

    moveUp(rule) {
      let rules = this.get('rules');
      let idx = rules.indexOf(rule);
      if ( idx <= 0 ) {
        return;
      }

      rules.removeAt(idx);
      rules.insertAt(idx-1, rule);
      this.updatePriorities();
    },

    moveDown(rule) {
      let rules = this.get('rules');
      let idx = rules.indexOf(rule);
      if ( idx < 0 || idx-1 >= rules.get('length') ) {
        return;
      }

      rules.removeAt(idx);
      rules.insertAt(idx+1, rule);
      this.updatePriorities();
    },

    removeRule(rule) {
      this.get('rules').removeObject(rule);
    },

    showBackend() {
      this.set('showBackend', true);
    },

    showIp() {
      this.set('showIp', true);
    },

    showRegion() {
      this.set('showRegion', true);
    },
  },

  updatePriorities() {
    let pri = 1;
    this.get('rules').forEach((rule) => {
      rule.set('priority', pri);
      pri++;
    });
  },

  minPriority: computed('rules.@each.priority', function() {
    let val = null;
    this.get('rules').forEach((rule) => {
      let cur = rule.get('priority');
      if ( val === null ) {
        val = cur;
      } else {
        val = Math.min(val, cur);
      }
    });

    return val;
  }),

  maxPriority: computed('rules.@each.priority', function() {
    let val = 0;
    this.get('rules').forEach((rule) => {
      val = Math.max(val, rule.get('priority'));
    });

    return val;
  }),
});
