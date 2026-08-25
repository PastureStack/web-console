import { resolve } from 'rsvp';
import {
  next,
  scheduleOnce,
  cancel,
  debounce
} from '@ember/runloop';
import { service } from '@ember/service';
import Component from '@ember/component';
import { isArray, A } from '@ember/array';
import EmberObject, {
  get,
  observer,
  setProperties,
  set
} from '@ember/object';
import { parsePortSpec } from 'ui/utils/parse-port';

const PREFLIGHT_DELAY = 350;
const VALID_STATUSES = ['available', 'warning', 'unknown', 'blocked'];
const STATUS_META = {
  checking: {
    icon: 'icon icon-spinner icon-spin',
    rowClass: 'port-preflight-row-checking',
    statusClass: 'port-preflight-status-checking',
  },
  available: {
    icon: 'icon icon-check',
    rowClass: 'port-preflight-row-available',
    statusClass: 'port-preflight-status-available',
  },
  warning: {
    icon: 'icon icon-alert',
    rowClass: 'port-preflight-row-warning',
    statusClass: 'port-preflight-status-warning',
  },
  unknown: {
    icon: 'icon icon-help',
    rowClass: 'port-preflight-row-unknown',
    statusClass: 'port-preflight-status-unknown',
  },
  blocked: {
    icon: 'icon icon-alert',
    rowClass: 'port-preflight-row-blocked',
    statusClass: 'port-preflight-status-blocked',
  },
};
const STATUS_RANK = {
  available: 1,
  checking: 2,
  unknown: 3,
  warning: 4,
  blocked: 5,
};
const protocolOptions = [
  {label: 'TCP', value: 'tcp'},
  {label: 'UDP', value: 'udp'}
];

function value(target, key) {
  if ( !target ) {
    return undefined;
  }

  if ( typeof target.get === 'function' ) {
    return target.get(key);
  }

  return get(target, key);
}

function asArray(items) {
  if ( !items ) {
    return [];
  }

  if ( typeof items.toArray === 'function' ) {
    return items.toArray();
  }

  return isArray(items) ? items : [];
}

function portNumber(input) {
  if ( input === null || input === undefined || String(input).trim() === '' ) {
    return null;
  }

  let parsed = parseInt(input, 10);

  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : null;
}

function normalizedProtocol(input) {
  let protocol = String(input || 'tcp').toLowerCase();

  return protocol === 'udp' ? 'udp' : 'tcp';
}

function normalizedNetworkMode(input) {
  return String(input || 'managed').trim().toLowerCase();
}

function statusForConflict(conflict, overallStatus) {
  let status = String(value(conflict, 'severity') || '').toLowerCase();

  if ( status === 'candidate' ) {
    status = overallStatus === 'blocked' ? 'blocked' : 'warning';
  }

  return STATUS_META[status] ? status : 'unknown';
}

export default Component.extend({
  intl: service(),
  projects: service(),

  // The initial ports to show, as an array of objects
  initialPorts: null,

  // Ignore the ID and force each initial port to be considered 'new' (for clone)
  editing: false,
  tagName: '',
  portsArray: null,
  portsAsStrArray: null,
  protocolOptions,
  showIp: null,

  // Preflight context supplied by the container/service form.
  networkMode: null,
  requestedHostId: null,
  serviceId: null,
  instanceId: null,
  stackId: null,
  isGlobal: false,
  scale: 1,
  batchSize: 1,
  startFirst: false,

  preflightStatus: 'idle',
  preflightStatusMessage: null,
  preflightSummaryClass: null,
  preflightIcon: null,
  preflightConflicts: null,
  preflightConflictMessages: null,

  init() {
    this._super(...arguments);

    this._preflightSequence = 0;
    this._preflightTimer = null;
    this.setProperties({
      preflightConflicts: A(),
      preflightConflictMessages: A(),
    });

    let out = [];
    let ports = this.get('initialPorts');
    if ( ports ) {
      ports.forEach((port) => {
        if ( typeof port === 'object' ) {
          let pub = '';
          let existing = !!value(port, 'id');
          if ( value(port, 'publicPort') ) {
            pub = `${value(port, 'publicPort')}`;
          }

          if ( value(port, 'bindAddress') ) {
            next(() => this.send('showIp'));
          }

          out.push(EmberObject.create({
            existing,
            obj: port,
            bindAddress: value(port, 'bindAddress') || null,
            public: pub,
            private: value(port, 'privatePort'),
            protocol: value(port, 'protocol'),
          }));
        } else if ( typeof port === 'string' ) {
          let parsed = parsePortSpec(port, 'tcp');

          if ( parsed.hostIp ) {
            next(() => this.send('showIp'));
          }

          out.push(EmberObject.create({
            existing: false,
            bindAddress: parsed.hostIp,
            public: parsed.hostPort,
            private: parsed.container,
            protocol: parsed.protocol,
          }));
        } else {
          console.error('Unknown port value', port);
        }
      });
    }

    scheduleOnce('afterRender', () => {
      if ( this.get('isDestroyed') || this.get('isDestroying') ) {
        return;
      }

      this.set('portsArray', A(out));
      this.portsArrayDidChange();
      this.validate();
      this.schedulePortPreflight();
    });
  },

  actions: {
    addPort() {
      this.get('portsArray').pushObject(EmberObject.create({
        public: '',
        private: '',
        protocol: 'tcp',
      }));
    },

    removePort(obj) {
      this.get('portsArray').removeObject(obj);
    },

    showIp() {
      this.set('showIp', true);
    },
  },

  invokePassedAction(name, value) {
    let action = this.get(name);

    if ( typeof action === 'function' ) {
      return action(value);
    }

    if ( action ) {
      return this.sendAction(name, value);
    }
  },

  portsArrayDidChange: function() {
    let out = [];
    (this.get('portsArray') || []).forEach((row) => {
      if ( !value(row, 'protocol') ) {
        return;
      }

      let bindAddress = value(row, 'bindAddress');
      if ( bindAddress && bindAddress.indexOf(':') > 0 && bindAddress.indexOf('[') !== 0 ) {
        // IPv6
        bindAddress = `[${bindAddress}]`;
      }

      let publicPort = value(row, 'public');
      let privatePort = value(row, 'private');

      // If there's a public and no private, the private should be the same as public.
      if ( publicPort && !privatePort ) {
        let spec = `${publicPort}:${publicPort}/${value(row, 'protocol')}`;
        if ( bindAddress ) {
          spec = `${bindAddress}:${spec}`;
        }
        out.push(spec);
      } else if ( privatePort ) {
        let spec = '';

        if ( publicPort ) {
          if ( bindAddress ) {
            spec += `${bindAddress}:`;
          }

          spec += `${publicPort}:`;
        }

        spec += `${privatePort}/${value(row, 'protocol')}`;
        out.push(spec);
      }
    });

    this.set('portsAsStrArray', out);
    this.invokePassedAction('changed', this.get('portsArray'));
    this.invokePassedAction('changedStr', this.get('portsAsStrArray'));
  }.observes('portsArray.@each.{bindAddress,public,private,protocol}'),

  validate: function() {
    let errors = [];
    let seen = {};

    (this.get('portsArray') || []).forEach((row) => {
      let bindAddress = value(row, 'bindAddress');
      let publicValue = value(row, 'public');
      let privateValue = value(row, 'private');
      let protocol = normalizedProtocol(value(row, 'protocol'));

      if ( !privateValue && (publicValue || bindAddress) ) {
        errors.push(this.get('intl').t('formPorts.error.privateRequired'));
      }

      if ( bindAddress && !publicValue ) {
        errors.push(this.get('intl').t('formPorts.error.publicRequired'));
      }

      if ( (publicValue && portNumber(publicValue) === null) ||
           (privateValue && portNumber(privateValue) === null) ) {
        errors.push(this.get('intl').t('formPorts.error.invalidPort'));
      }

      if ( publicValue ) {
        let key = `[${bindAddress || '0.0.0.0'}]:${publicValue}/${protocol}`;
        if ( seen[key] ) {
          errors.push(this.get('intl').t(`formPorts.error.${bindAddress ? 'mixedIpPort' : 'mixedPort'}`, {
            ip: bindAddress,
            port: publicValue,
            proto: protocol,
          }));
        } else {
          seen[key] = true;
        }
      }
    });

    if ( this.get('preflightStatus') === 'blocked' ) {
      errors.push(this.get('intl').t('formPorts.preflight.error.blocked'));
    }

    this.set('errors', A(errors).uniq());
  }.observes('portsArray.@each.{bindAddress,public,private,protocol}', 'preflightStatus'),

  preflightInputsDidChange: observer(
    'portsArray.@each.{bindAddress,public,private,protocol}',
    'networkMode',
    'requestedHostId',
    'serviceId',
    'instanceId',
    'stackId',
    'isGlobal',
    'scale',
    'batchSize',
    'startFirst',
    function() {
      this.schedulePortPreflight();
    }
  ),

  portEntries() {
    let mode = normalizedNetworkMode(this.get('networkMode'));
    let entries = [];

    (this.get('portsArray') || []).forEach((row) => {
      let privatePort = portNumber(value(row, 'private'));
      let publicPort = portNumber(value(row, 'public'));
      let effectivePort = mode === 'host' ? privatePort : publicPort;

      if ( privatePort === null || effectivePort === null ) {
        return;
      }

      entries.push({
        row,
        effectivePort,
        payload: {
          bindAddress: value(row, 'bindAddress') || null,
          publicPort,
          privatePort,
          protocol: normalizedProtocol(value(row, 'protocol')),
        },
      });
    });

    return entries;
  },

  buildPreflightInput(entries) {
    let input = {
      networkMode: normalizedNetworkMode(this.get('networkMode')),
      global: !!this.get('isGlobal'),
      scale: Math.max(0, parseInt(this.get('scale'), 10) || 0),
      batchSize: Math.max(1, parseInt(this.get('batchSize'), 10) || 1),
      startFirst: !!this.get('startFirst'),
      runtimeProbe: true,
      ports: entries.map((entry) => entry.payload),
    };

    [
      ['requestedHostId', this.get('requestedHostId')],
      ['serviceId', this.get('serviceId')],
      ['instanceId', this.get('instanceId')],
      ['stackId', this.get('stackId')],
    ].forEach(([key, item]) => {
      if ( item !== null && item !== undefined && item !== '' ) {
        input[key] = item;
      }
    });

    return input;
  },

  schedulePortPreflight() {
    if ( this.get('isDestroyed') || this.get('isDestroying') ) {
      return;
    }

    this._preflightSequence += 1;
    let sequence = this._preflightSequence;
    let entries = this.portEntries();

    if ( this._preflightTimer ) {
      cancel(this._preflightTimer);
      this._preflightTimer = null;
    }

    if ( entries.length === 0 ) {
      this.applyPreflightState('idle', [], null, null);
      return;
    }

    this.applyPreflightState('checking', [], null, null);
    this._preflightTimer = debounce(this, this.runPortPreflight, sequence, PREFLIGHT_DELAY);
  },

  runPortPreflight(sequence) {
    this._preflightTimer = null;

    if ( sequence !== this._preflightSequence || this.get('isDestroyed') || this.get('isDestroying') ) {
      return resolve();
    }

    let entries = this.portEntries();
    if ( entries.length === 0 ) {
      this.applyPreflightState('idle', [], null, null);
      return resolve();
    }

    let project = this.get('projects.current');
    let supported = project && (
      (typeof project.hasAction === 'function' && project.hasAction('portpreflight')) ||
      !!value(project, 'actionLinks.portpreflight')
    );

    if ( !supported || typeof project.doAction !== 'function' ) {
      this.applyPreflightState('unknown', [], 'formPorts.preflight.status.unsupported', null);
      return resolve();
    }

    let request;
    try {
      request = project.doAction('portpreflight', this.buildPreflightInput(entries), {catchGrowl: false});
    } catch (error) {
      this.applyPreflightState('unknown', [], 'formPorts.preflight.status.requestFailed', null);
      return resolve();
    }

    return resolve(request).then((result) => {
      if ( sequence !== this._preflightSequence || this.get('isDestroyed') || this.get('isDestroying') ) {
        return;
      }

      let status = String(value(result, 'status') || 'unknown').toLowerCase();
      if ( VALID_STATUSES.indexOf(status) === -1 ) {
        status = 'unknown';
      }

      this.applyPreflightState(status, asArray(value(result, 'conflicts')), null, result);
    }).catch(() => {
      if ( sequence === this._preflightSequence && !this.get('isDestroyed') && !this.get('isDestroying') ) {
        this.applyPreflightState('unknown', [], 'formPorts.preflight.status.requestFailed', null);
      }
    });
  },

  applyPreflightState(status, conflicts, messageKey, result) {
    let meta = STATUS_META[status] || null;
    let conflictList = A((conflicts || []).slice());
    let messages = A(conflictList.map((conflict) => EmberObject.create({
      status: statusForConflict(conflict, status),
      statusClass: STATUS_META[statusForConflict(conflict, status)].statusClass,
      icon: STATUS_META[statusForConflict(conflict, status)].icon,
      text: this.conflictMessage(conflict),
    })));

    this.applyRowPreflight(status, conflictList);
    this.setProperties({
      preflightStatus: status,
      preflightConflicts: conflictList,
      preflightConflictMessages: messages,
      preflightIcon: meta ? meta.icon : null,
      preflightSummaryClass: meta ? meta.statusClass : null,
      preflightStatusMessage: this.statusMessage(status, messageKey, result),
    });
    this.validate();
    this.invokePassedAction('preflightChanged', {
      status,
      pending: status === 'checking',
      blocked: status === 'blocked',
      message: this.get('preflightStatusMessage'),
    });
  },

  applyRowPreflight(overallStatus, conflicts) {
    let entries = this.portEntries();

    (this.get('portsArray') || []).forEach((row) => {
      setProperties(row, {
        preflightIcon: null,
        preflightMessage: null,
        preflightRowClass: null,
        preflightStatus: null,
        preflightStatusClass: null,
      });
    });

    if ( overallStatus === 'idle' || entries.length === 0 ) {
      return;
    }

    if ( overallStatus === 'checking' ) {
      entries.forEach((entry) => this.setRowStatus(entry.row, 'checking', this.get('intl').t('formPorts.preflight.row.checking')));
      return;
    }

    conflicts.forEach((conflict) => {
      let conflictPort = portNumber(value(conflict, 'publicPort'));
      let conflictPrivatePort = portNumber(value(conflict, 'privatePort'));
      let protocol = normalizedProtocol(value(conflict, 'protocol'));
      let matching = entries.filter((entry) => {
        let rowPublic = portNumber(value(entry.row, 'public'));
        let rowPrivate = portNumber(value(entry.row, 'private'));

        return normalizedProtocol(value(entry.row, 'protocol')) === protocol && (
          (conflictPort !== null && (entry.effectivePort === conflictPort || rowPublic === conflictPort)) ||
          (conflictPrivatePort !== null && rowPrivate === conflictPrivatePort)
        );
      });

      if ( conflictPort === null && conflictPrivatePort === null ) {
        matching = entries;
      }

      matching.forEach((entry) => this.setRowStatus(
        entry.row,
        statusForConflict(conflict, overallStatus),
        this.conflictMessage(conflict)
      ));
    });

    entries.forEach((entry) => {
      if ( !value(entry.row, 'preflightStatus') ) {
        let fallback = overallStatus === 'unknown' ? 'unknown' : 'available';
        this.setRowStatus(entry.row, fallback, this.get('intl').t(`formPorts.preflight.row.${fallback}`));
      }
    });
  },

  setRowStatus(row, status, message) {
    let current = value(row, 'preflightStatus');
    if ( current && STATUS_RANK[current] > STATUS_RANK[status] ) {
      let previous = value(row, 'preflightMessage');
      if ( previous && message && previous.indexOf(message) === -1 ) {
        set(row, 'preflightMessage', `${previous}\n${message}`);
      }
      return;
    }

    let meta = STATUS_META[status] || STATUS_META.unknown;
    setProperties(row, {
      preflightIcon: meta.icon,
      preflightMessage: message,
      preflightRowClass: meta.rowClass,
      preflightStatus: status,
      preflightStatusClass: meta.statusClass,
    });
  },

  statusMessage(status, messageKey, result) {
    if ( status === 'idle' ) {
      return null;
    }

    let key = messageKey || `formPorts.preflight.status.${status}`;
    return this.get('intl').t(key, {
      available: value(result, 'availableHostCount') === undefined ? '—' : value(result, 'availableHostCount'),
      eligible: value(result, 'eligibleHostCount') === undefined ? '—' : value(result, 'eligibleHostCount'),
    });
  },

  conflictMessage(conflict) {
    let reasonCode = value(conflict, 'reasonCode');
    let knownReasons = [
      'active_port_conflict',
      'active_port_conflict_on_other_host',
      'stopped_port_owner',
      'host_process_conflict',
      'external_docker_conflict',
      'invalid_network_mode_mapping',
      'host_network_ignores_published_port',
      'duplicate_requested_port',
      'insufficient_eligible_hosts',
      'host_unreachable',
      'agent_timeout',
      'agent_unsupported',
    ];
    let reasonKey = knownReasons.indexOf(reasonCode) >= 0 ? reasonCode : 'unknown';
    let parts = [this.get('intl').t(`formPorts.preflight.reason.${reasonKey}`)];
    let publicPort = value(conflict, 'publicPort');
    let protocol = value(conflict, 'protocol');

    if ( publicPort ) {
      parts.push(this.get('intl').t('formPorts.preflight.detail.endpoint', {
        address: value(conflict, 'bindAddress') || '0.0.0.0',
        port: publicPort,
        protocol: String(protocol || 'tcp').toUpperCase(),
      }));
    }

    [
      ['host', value(conflict, 'hostName')],
      ['stack', value(conflict, 'stackName')],
      ['service', value(conflict, 'serviceName')],
      ['container', value(conflict, 'instanceName')],
      ['state', this.translatedState(value(conflict, 'state'))],
    ].forEach(([key, item]) => {
      if ( item ) {
        parts.push(this.get('intl').t(`formPorts.preflight.detail.${key}`, {value: item}));
      }
    });

    return parts.join('; ');
  },

  translatedState(state) {
    let normalized = String(state || '').toLowerCase();
    let known = ['active', 'running', 'stopped', 'stopping', 'created', 'exited', 'error'];

    if ( known.indexOf(normalized) >= 0 ) {
      return this.get('intl').t(`formPorts.preflight.state.${normalized}`);
    }

    return state;
  },

  willDestroyElement() {
    this._preflightSequence += 1;
    if ( this._preflightTimer ) {
      cancel(this._preflightTimer);
      this._preflightTimer = null;
    }

    this._super(...arguments);
  },
});
