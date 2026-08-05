import Ember from 'ember';
import { parseVolumeSpec } from 'ui/utils/volume-spec';

const PREFLIGHT_DELAY = 350;
const ACTIVE_HOST_STATES = ['active', 'activating', 'updating-active'];
const ACTIVE_POOL_STATES = ['active', 'activating', 'updating-active'];
const VALID_PREFLIGHT_STATUSES = ['available', 'warning', 'unknown', 'blocked'];
const KNOWN_PREFLIGHT_REASONS = [
  'volume_path_required',
  'volume_path_too_long',
  'volume_path_control_character',
  'invalid_volume_format',
  'target_path_must_be_absolute',
  'unsafe_target_path',
  'invalid_volume_name',
  'source_path_must_be_absolute',
  'unsafe_source_path',
  'invalid_volume_mode',
  'driver_not_found',
  'duplicate_driver_name',
  'driver_inactive',
  'reserved_secrets_driver',
  'no_active_storage_pool',
  'host_pool_missing',
  'no_eligible_hosts',
  'nfs_requires_environment_scope',
  'nfs_requires_multi_host_rw',
  'nfs_incomplete_host_coverage',
  'duplicate_target_path',
  'anonymous_volume_with_driver',
  'bind_mount_ignores_driver',
  'ambiguous_existing_volume',
  'volume_driver_mismatch',
  'existing_volume_unusable',
];

function value(target, key) {
  if ( !target ) {
    return undefined;
  }

  return typeof target.get === 'function' ? target.get(key) : Ember.get(target, key);
}

function asArray(items) {
  if ( !items ) {
    return [];
  }

  if ( typeof items.toArray === 'function' ) {
    return items.toArray();
  }

  return Ember.isArray(items) ? items : [];
}

function includesCapability(driver, capability) {
  return asArray(value(driver, 'volumeCapabilities') || value(driver, 'capabilities'))
    .indexOf(capability) >= 0;
}

export default Ember.Component.extend({
  intl: Ember.inject.service(),
  projects: Ember.inject.service(),

  // Inputs
  instance            : null,
  primaryService      : null,
  launchConfigChoices : null,
  launchConfigIndex   : null,
  isService           : null,
  allHosts            : null,
  allStorageDrivers   : null,
  allStoragePools     : null,
  allVolumes          : null,
  serviceId           : null,
  instanceId          : null,
  stackId             : null,
  isGlobal            : false,
  scale               : 1,
  batchSize           : 1,
  startFirst          : false,
  preflightChanged    : null,
  errors              : null,

  preflightStatus     : 'idle',
  preflightMessage    : null,
  preflightIssues     : null,
  volumeWarnings      : null,

  tagName: '',

  init() {
    this._super(...arguments);

    this._preflightSequence = 0;
    this._preflightTimer = null;
    this.setProperties({
      preflightIssues: Ember.A(),
      volumeWarnings: Ember.A(),
    });

    this.initVolumes();
    this.initVolumesFrom();
    this.initVolumesFromLaunchConfig();

    Ember.run.scheduleOnce('afterRender', this, this.scheduleVolumePreflight);
  },

  initVolumesFromLaunchConfig() {
    var dv = this.get('instance.dataVolumesFromLaunchConfigs');
    Ember.run.once(this,'initChoices', dv);
  },

  initChoices: function(initEnabled=[]) {
    let launchConfigIndex = this.get('launchConfigIndex');
    let enabled = initEnabled ? initEnabled.indexOf(this.get('primaryService.name')) >= 0 : false;
    let out = [];

    if ( launchConfigIndex !== -1 )
    {
      out.push({
        index: -1,
        displayName: this.get('primaryService.name') || '(Primary Service)',
        name: this.get('primaryService.name'),
        enabled: enabled
      });
    }

    (this.get('primaryService.secondaryLaunchConfigs')||[]).forEach((item, index) => {
      if ( launchConfigIndex !== index )
      {
        out.push({
          index: index,
          displayName: item.get('name') || `(Sidekick #${index+1})`,
          name: item.get('name'),
          enabled: (initEnabled.indexOf(item.get('name')) >= 0 ? true : false),
          uiId: item.get('uiId'),
        });
      }
    });

    let tempObj = {};

    this.set('prevChoices', tempObj[launchConfigIndex] = out);
    this.set('volumesFromLaunchConfigChoices', out);

  },

  prevChoices: null,
  volumesFromLaunchConfigChoices: null,

  updateChoices: function() {
    let launchConfigIndex = this.get('launchConfigIndex');
    let prevChoices = this.get('prevChoices')||{};
    let prev = prevChoices.filterBy('index',-1)[0];
    let enabled = (prev ? prev.enabled : false);
    let out = [];

    if ( launchConfigIndex !== -1 )
    {
      out.push({
        index: -1,
        displayName: this.get('primaryService.name') || '(Primary Service)',
        name: this.get('primaryService.name'),
        enabled: enabled,
      });
    }

    (this.get('primaryService.secondaryLaunchConfigs')||[]).forEach((item, index) => {
      if ( launchConfigIndex !== index )
      {
        prev = prevChoices.filterBy('uiId', item.get('uiId'))[0];
        out.push({
          index: index,
          displayName: item.get('name') || `(Sidekick #${index+1})`,
          name: item.get('name'),
          enabled: (prev ? prev.enabled : false),
          uiId: item.get('uiId'),
        });
      }
    });

    this.set('prevChoices', out);
    this.set('volumesFromLaunchConfigChoices', out);
  },

  shouldUpdateChoices: function() {
    Ember.run.once(this,'updateChoices');
  }.observes('primaryService.name','primaryService.secondaryLaunchConfigs.@each.name','launchConfigIndex'),

  volumesFromLaunchConfigChanged: function() {
    var out = this.get('volumesFromLaunchConfigChoices').filterBy('enabled', true).filterBy('name').map((choice) => { return choice.name; });
    this.set('instance.dataVolumesFromLaunchConfigs', out);
  }.observes('volumesFromLaunchConfigChoices.@each.enabled'),

  actions: {
    addVolume: function() {
      this.get('volumesArray').pushObject(Ember.Object.create({value: ''}));
    },
    removeVolume: function(obj) {
      this.get('volumesArray').removeObject(obj);
    },

    addVolumeFrom: function() {
      this.get('volumesFromArray').pushObject({value: ''});
    },
    removeVolumeFrom: function(obj) {
      this.get('volumesFromArray').removeObject(obj);
    },

    addVolumeFromService: function() {
      this.get('volumesFromServiceArray').pushObject({value: ''});
    },
    removeVolumeFromService: function(obj) {
      this.get('volumesFromServiceArray').removeObject(obj);
    },

    volumeValueChanged(row, newValue) {
      Ember.set(row, 'value', newValue);
    },

    driverChanged(selection) {
      if ( selection && !selection.disabled ) {
        this.set('instance.volumeDriver', selection.value || null);
      }
    },
  },

  // ----------------------------------
  // Volumes
  // ----------------------------------
  volumesArray: null,
  initVolumes: function() {
    var ary = this.get('instance.dataVolumes');
    if ( !ary )
    {
      ary = [];
      this.set('instance.dataVolumes',ary);
    }

    this.set('volumesArray', ary.map(function(vol) {
      return Ember.Object.create({value: vol});
    }));
  },

  volumesDidChange: function() {
    var out = this.get('instance.dataVolumes');
    out.beginPropertyChanges();
    out.clear();
    this.get('volumesArray').forEach(function(row) {
      if ( row.value )
      {
        out.push(row.value);
      }
    });
    out.endPropertyChanges();
  }.observes('volumesArray.@each.value'),

  // ----------------------------------
  // Volumes From
  // ----------------------------------
  hostContainerChoices: function() {
    var list = [];

    this.get('allHosts').filter((host) => {
      return host.get('id') === this.get('instance.requestedHostId');
    }).map((host) => {
      var containers = (host.get('instances')||[]).filter(function(instance) {
        // You can't mount volumes from other types of instances
        return instance.get('type') === 'container';
      });

      list.pushObjects(containers.map(function(container) {
        return {
          group: 'Host: ' + (host.get('name') || '('+host.get('id')+')'),
          id: container.get('id'),
          name: container.get('name')
        };
      }));
    });

    return list.sortBy('group','name','id');
  }.property('instance.requestedHostId','allHosts.@each.instances'),

  volumesFromArray: null,
  initVolumesFrom: function() {
    var ary = this.get('instance.dataVolumesFrom');
    if ( !ary )
    {
      ary = [];
      this.set('instance.dataVolumesFrom',ary);
    }

    this.set('volumesFromArray', ary.map(function(vol) {
      return {value: vol};
    }));
  },

  volumesFromDidChange: function() {
    var out = this.get('instance.dataVolumesFrom');
    out.beginPropertyChanges();
    out.clear();
    this.get('volumesFromArray').forEach(function(row) {
      if ( row.value )
      {
        out.push(row.value);
      }
    });
    out.endPropertyChanges();
  }.observes('volumesFromArray.@each.value'),

  eligibleHosts: Ember.computed('allHosts.@each.{state,removed}', function() {
    return Ember.A(asArray(this.get('allHosts')).filter((host) => {
      return !value(host, 'removed') && ACTIVE_HOST_STATES.indexOf(value(host, 'state')) >= 0;
    }));
  }),

  storageDriverChoices: Ember.computed(
    'intl._locale',
    'instance.{requestedHostId,volumeDriver}',
    'eligibleHosts.@each.id',
    'allStorageDrivers.@each.{id,name,state,scope,volumeAccessMode,volumeCapabilities,capabilities,removed}',
    'allStoragePools.@each.{state,removed,storageDriverId,driverName,hostIds}',
    function() {
      let intl = this.get('intl');
      let hosts = this.get('eligibleHosts') || Ember.A();
      let hostIds = hosts.map((host) => String(value(host, 'id')));
      let requestedHostId = this.get('instance.requestedHostId');
      let choices = [{
        value: '',
        label: intl.t('formVolumes.volumeDriver.local'),
        detail: intl.t('formVolumes.volumeDriver.localDetail'),
        disabled: false,
      }];

      asArray(this.get('allStorageDrivers')).forEach((driver) => {
        if ( value(driver, 'removed') || includesCapability(driver, 'secrets') ) {
          return;
        }

        let id = String(value(driver, 'id') || '');
        let name = String(value(driver, 'name') || '').trim();
        if ( !name ) {
          return;
        }

        let scope = String(value(driver, 'scope') || 'environment');
        let accessMode = String(value(driver, 'volumeAccessMode') || '');
        let pools = asArray(this.get('allStoragePools')).filter((pool) => {
          return !value(pool, 'removed') &&
            ACTIVE_POOL_STATES.indexOf(value(pool, 'state')) >= 0 &&
            (String(value(pool, 'storageDriverId') || '') === id || value(pool, 'driverName') === name);
        });
        let covered = {};
        pools.forEach((pool) => {
          asArray(value(pool, 'hostIds')).forEach((hostId) => {
            covered[String(hostId)] = true;
          });
        });
        let coveredCount = hostIds.filter((hostId) => covered[hostId]).length;
        let disabledReason = null;

        if ( value(driver, 'state') !== 'active' ) {
          disabledReason = 'inactive';
        } else if ( pools.length === 0 ) {
          disabledReason = 'noPool';
        } else if ( scope === 'environment' && (hostIds.length === 0 || coveredCount !== hostIds.length) ) {
          disabledReason = 'incompleteCoverage';
        } else if ( scope !== 'environment' && requestedHostId && !covered[String(requestedHostId)] ) {
          disabledReason = 'requestedHostUnavailable';
        } else if ( name === 'pasturestack-nfs' && (scope !== 'environment' || accessMode !== 'multiHostRW') ) {
          disabledReason = 'invalidNfsContract';
        }

        let scopeLabel = intl.t(`formVolumes.volumeDriver.scope.${['local', 'custom', 'environment'].indexOf(scope) >= 0 ? scope : 'unknown'}`);
        let detail = intl.t('formVolumes.volumeDriver.coverage', {
          scope: scopeLabel,
          covered: coveredCount,
          total: hostIds.length,
        });
        if ( disabledReason ) {
          detail = `${detail} — ${intl.t(`formVolumes.volumeDriver.unavailable.${disabledReason}`)}`;
        }

        choices.push({
          value: name,
          label: `${name} — ${scopeLabel} — ${coveredCount}/${hostIds.length}`,
          detail,
          disabled: !!disabledReason,
          disabledReason,
          driver,
        });
      });

      let current = String(this.get('instance.volumeDriver') || '');
      if ( current && !choices.find((choice) => choice.value === current) ) {
        choices.push({
          value: current,
          label: `${current} — ${intl.t('formVolumes.volumeDriver.unavailable.legacy')}`,
          detail: intl.t('formVolumes.volumeDriver.unavailable.legacy'),
          disabled: true,
          disabledReason: 'legacy',
        });
      }

      return Ember.A(choices.sort((left, right) => {
        if ( left.value === '' ) {
          return -1;
        }
        if ( right.value === '' ) {
          return 1;
        }
        return left.label.localeCompare(right.label, undefined, {numeric: true, sensitivity: 'base'});
      }));
    }
  ),

  selectedDriverChoice: Ember.computed('storageDriverChoices.[]', 'instance.volumeDriver', function() {
    let current = String(this.get('instance.volumeDriver') || '');
    return (this.get('storageDriverChoices') || Ember.A()).find((choice) => choice.value === current) || null;
  }),

  preflightIssueMessages: Ember.computed('intl._locale', 'preflightIssues.[]', function() {
    let intl = this.get('intl');

    return Ember.A(asArray(this.get('preflightIssues')).map((issue) => {
      let reason = String(value(issue, 'reasonCode') || 'unknown');
      let reasonKey = KNOWN_PREFLIGHT_REASONS.indexOf(reason) >= 0 ? reason : 'unknown';
      let parts = [intl.t(`formVolumes.preflight.reason.${reasonKey}`)];
      let hostName = value(issue, 'hostName');
      let spec = value(issue, 'value');
      let driverName = value(issue, 'driverName');

      if ( hostName ) {
        parts.push(intl.t('formVolumes.preflight.detail.host', {value: hostName}));
      }
      if ( spec ) {
        parts.push(intl.t('formVolumes.preflight.detail.path', {value: spec}));
      }
      if ( driverName ) {
        parts.push(intl.t('formVolumes.preflight.detail.driver', {value: driverName}));
      }

      let severity = String(value(issue, 'severity') || 'unknown');
      return Ember.Object.create({
        severity,
        className: severity === 'blocked' ? 'text-danger' : (severity === 'warning' ? 'text-warning' : 'text-muted'),
        text: parts.join(' · '),
      });
    }));
  }),

  volumePathSuggestions: Ember.computed(
    'intl._locale',
    'instance.volumeDriver',
    'volumesArray.@each.value',
    'allVolumes.@each.{name,driver,storageDriverId,removed}',
    'allStorageDrivers.@each.{id,name}',
    function() {
      let intl = this.get('intl');
      let suggestions = [];
      let suggestedSource = intl.t('formVolumes.autocomplete.source.suggested');
      let currentSource = intl.t('formVolumes.autocomplete.source.current');
      let existingSource = intl.t('formVolumes.autocomplete.source.existing');
      let currentDriver = String(this.get('instance.volumeDriver') || '');
      let driverById = {};

      asArray(this.get('allStorageDrivers')).forEach((driver) => {
        driverById[String(value(driver, 'id') || '')] = value(driver, 'name');
      });

      ['/data', '/config', '/var/lib/app', '/var/log/app'].forEach((path) => {
        suggestions.push({value: path, source: suggestedSource});
      });

      asArray(this.get('volumesArray')).forEach((row) => {
        let current = String(value(row, 'value') || '').trim();
        if ( current ) {
          suggestions.push({value: current, source: currentSource});
        }
      });

      asArray(this.get('allVolumes')).forEach((volume) => {
        if ( value(volume, 'removed') ) {
          return;
        }

        let name = String(value(volume, 'name') || '').trim();
        let driverName = String(value(volume, 'driver') || driverById[String(value(volume, 'storageDriverId') || '')] || '');
        if ( !name || driverName !== currentDriver ) {
          return;
        }

        suggestions.push({value: `${name}:/data`, source: existingSource});
      });

      return Ember.A(suggestions);
    }
  ),

  validate: function() {
    var errors = [];
    var warnings = [];
    var volumeDriver = this.get('instance.volumeDriver');
    var targets = {};

    this.get('volumesArray').forEach((row) => {
      let val = String(value(row, 'value') || '').trim();
      if ( !val ) {
        return;
      }

      let parsed = parseVolumeSpec(val);
      parsed.errors.forEach((code) => {
        errors.push(this.get('intl').t(`formVolumes.errors.${code}`));
      });

      if ( parsed.target ) {
        if ( targets[parsed.target] ) {
          errors.push(this.get('intl').t('formVolumes.errors.duplicateTarget', {path: parsed.target}));
        }
        targets[parsed.target] = true;
      }

      if ( !Ember.isEmpty(volumeDriver) && parsed.kind === 'anonymous' ) {
        warnings.push(this.get('intl').t('formVolumes.warnings.anonymousDriver'));
      }

      if ( !Ember.isEmpty(volumeDriver) && parsed.kind === 'bind' ) {
        warnings.push(this.get('intl').t('formVolumes.warnings.bindIgnoresDriver'));
      }
    });

    let driverChoice = this.get('selectedDriverChoice');
    if ( volumeDriver && (!driverChoice || driverChoice.disabled) ) {
      errors.push(this.get('intl').t('formVolumes.errors.driverUnavailable'));
    }

    if ( this.get('preflightStatus') === 'blocked' ) {
      errors.push(this.get('intl').t('formVolumes.errors.preflightBlocked'));
    }

    this.set('volumeWarnings', Ember.A(warnings).uniq());
    this.set('errors', errors.uniq());
  }.observes('volumesArray.@each.value', 'instance.volumeDriver', 'selectedDriverChoice.{disabled,disabledReason}', 'preflightStatus'),

  preflightInputsDidChange: Ember.observer(
    'volumesArray.@each.value',
    'instance.{volumeDriver,requestedHostId}',
    'serviceId',
    'instanceId',
    'stackId',
    'isGlobal',
    'scale',
    'batchSize',
    'startFirst',
    function() {
      this.scheduleVolumePreflight();
    }
  ),

  scheduleVolumePreflight() {
    if ( this.get('isDestroyed') || this.get('isDestroying') ) {
      return;
    }

    this._preflightSequence += 1;
    let sequence = this._preflightSequence;
    if ( this._preflightTimer ) {
      Ember.run.cancel(this._preflightTimer);
      this._preflightTimer = null;
    }

    let specs = asArray(this.get('volumesArray'))
      .map((row) => String(value(row, 'value') || '').trim())
      .filter(Boolean);
    if ( specs.length === 0 ) {
      this.applyPreflightState('idle', [], null);
      return;
    }

    this.applyPreflightState('checking', [], null);
    this._preflightTimer = Ember.run.debounce(this, this.runVolumePreflight, sequence, PREFLIGHT_DELAY);
  },

  buildPreflightInput() {
    let input = {
      volumeDriver: this.get('instance.volumeDriver') || null,
      dataVolumes: asArray(this.get('volumesArray'))
        .map((row) => String(value(row, 'value') || '').trim())
        .filter(Boolean),
      global: !!this.get('isGlobal'),
      scale: Math.max(0, parseInt(this.get('scale'), 10) || 0),
      batchSize: Math.max(1, parseInt(this.get('batchSize'), 10) || 1),
      startFirst: !!this.get('startFirst'),
    };

    [
      ['requestedHostId', this.get('instance.requestedHostId')],
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

  runVolumePreflight(sequence) {
    this._preflightTimer = null;
    if ( sequence !== this._preflightSequence || this.get('isDestroyed') || this.get('isDestroying') ) {
      return Ember.RSVP.resolve();
    }

    let project = this.get('projects.current');
    let supported = project && (
      (typeof project.hasAction === 'function' && project.hasAction('volumepreflight')) ||
      !!value(project, 'actionLinks.volumepreflight')
    );
    if ( !supported || typeof project.doAction !== 'function' ) {
      this.applyPreflightState('unknown', [], 'formVolumes.preflight.unsupported');
      return Ember.RSVP.resolve();
    }

    let request;
    try {
      request = project.doAction('volumepreflight', this.buildPreflightInput(), {catchGrowl: false});
    } catch (error) {
      this.applyPreflightState('unknown', [], 'formVolumes.preflight.requestFailed');
      return Ember.RSVP.resolve();
    }

    return Ember.RSVP.resolve(request).then((result) => {
      if ( sequence !== this._preflightSequence || this.get('isDestroyed') || this.get('isDestroying') ) {
        return;
      }

      let status = String(value(result, 'status') || 'unknown').toLowerCase();
      if ( VALID_PREFLIGHT_STATUSES.indexOf(status) === -1 ) {
        status = 'unknown';
      }
      this.applyPreflightState(status, asArray(value(result, 'issues')), null, result);
    }).catch(() => {
      if ( sequence === this._preflightSequence && !this.get('isDestroyed') && !this.get('isDestroying') ) {
        this.applyPreflightState('unknown', [], 'formVolumes.preflight.requestFailed');
      }
    });
  },

  applyPreflightState(status, issues, messageKey, result) {
    let key = messageKey || `formVolumes.preflight.${status}`;
    let message = status === 'idle' ? null : this.get('intl').t(key, {
      driver: value(result, 'driverName') || this.get('instance.volumeDriver') || this.get('intl').t('formVolumes.volumeDriver.local'),
      available: value(result, 'availableHostCount') === undefined ? '—' : value(result, 'availableHostCount'),
      eligible: value(result, 'eligibleHostCount') === undefined ? '—' : value(result, 'eligibleHostCount'),
    });

    this.setProperties({
      preflightStatus: status,
      preflightIssues: Ember.A((issues || []).slice()),
      preflightMessage: message,
    });
    this.validate();

    let callback = this.get('preflightChanged');
    let state = {status, pending: status === 'checking', blocked: status === 'blocked', message};
    if ( typeof callback === 'function' ) {
      callback(state);
    } else if ( callback ) {
      this.sendAction('preflightChanged', state);
    }
  },

  willDestroyElement() {
    this._preflightSequence += 1;
    if ( this._preflightTimer ) {
      Ember.run.cancel(this._preflightTimer);
      this._preflightTimer = null;
    }
    this._super(...arguments);
  },
});
