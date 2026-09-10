import Component from '@ember/component';
import { computed, observer, set } from '@ember/object';
import { service } from '@ember/service';
import { read, parseBytes, simpleNvidiaRequest, hardwareIssues, hardwareHost, hardwareInventoryReady, ULIMIT_NAMES, hardwareDraft, updateHardwareDraft } from 'ui/utils/hardware-options';

export default Component.extend({
  intl: service(),
  projects: service(),
  instance: null,
  allHosts: null,
  editing: true,
  errors: null,
  shmUnit: 'MiB',
  shmDraft: null,
  shmError: null,
  cpuError: null,
  advanced: false,
  init() {
    this._super(...arguments);
    this.resetDrafts();
  },
  didReceiveAttrs() {
    this._super(...arguments);
    if ( this._resourceInstance !== this.get('instance') ) { this.resetDrafts(); }
  },
  resetDrafts() {
    this._resourceInstance = this.get('instance');
    this.setProperties({shmUnit: 'MiB', shmError: null, cpuError: null, _selectingGpu: false, tmpfsInvalid: false, sysctlsInvalid: false});
    let shm = this.get('instance.shmSize');
    if ( shm && shm % 1073741824 === 0 ) { this.set('shmUnit', 'GiB'); }
    this.set('shmDraft', shm ? String(shm / (this.get('shmUnit') === 'GiB' ? 1073741824 : 1048576)) : '');
    let draft = hardwareDraft(this._resourceInstance);
    this.setProperties({draft, tmpfsInvalid: !!draft.tmpfsInvalid, sysctlsInvalid: !!draft.sysctlsInvalid,
      shmError: draft.shmError || null, cpuError: draft.cpuError || null, cpuDraft: draft.cpuDraft, _selectingGpu: !!draft.selectingGpu});
    if ( draft.shmError ) { this.setProperties({shmDraft: draft.shmDraft, shmUnit: draft.shmUnit}); }
    // Computed properties and rendering do not change the launch configuration.
  },
  selectedHost: computed('instance.requestedHostId', 'primaryRequestedHostId', 'instance.primaryHost', 'allHosts.[]', function() {
    return hardwareHost(this.get('instance'), this.get('allHosts'), this.get('primaryRequestedHostId'));
  }),
  hardware: computed('selectedHost.info', function() { return read(this.get('selectedHost'), 'info')?.hardwareInfo || {}; }),
  inventoryReady: computed('selectedHost.{info,state}', function() { return hardwareInventoryReady(this.get('selectedHost')); }),
  nvidiaCount: computed('hardware.devices', function() { return (this.get('hardware.devices') || []).filter((device) => device.kind === 'nvidia').length; }),
  nvidiaReady: computed('inventoryReady', 'nvidiaCount', 'hardware.{runtimes,deviceRequestsSupported}', function() {
    return this.get('inventoryReady') && this.get('nvidiaCount') > 0 && this.get('hardware.deviceRequestsSupported') && (this.get('hardware.runtimes') || []).includes('nvidia');
  }),
  ulimitNames: computed(function() { return ULIMIT_NAMES; }),
  availableUlimitNames: computed('instance.ulimits.@each.name', function() {
    return ULIMIT_NAMES.filter((name) => !(this.get('instance.ulimits') || []).some((limit) => read(limit, 'name') === name));
  }),
  hostChoices: computed('allHosts.@each.{id,name,hostname,state}', function() {
    return (this.get('allHosts') || []).map((host) => ({id: read(host, 'id'), name: read(host, 'displayName') || read(host, 'hostname') || read(host, 'name'), inactive: read(host, 'state') !== 'active'}));
  }),
  runtimeChoices: computed('hardware.runtimes', 'instance.runtime', function() {
    return [...new Set([...(this.get('hardware.runtimes') || []), this.get('instance.runtime')].filter(Boolean))];
  }),
  gpuChoices: computed('hardware.devices', 'instance.{deviceRequests,devices}', function() {
    let requests = this.get('instance.deviceRequests') || [];
    let mappings = this.get('instance.devices') || [];
    let ids = requests[0]?.deviceIds || [];
    return (this.get('hardware.devices') || []).map((device) => Object.assign({}, device, {
      key: device.id || device.path,
      selected: device.kind === 'nvidia' ? (requests[0]?.count === -1 || ids.indexOf(device.id) >= 0) : mappings.some((mapping) => mapping.split(':')[0] === device.path),
    }));
  }),
  customRequests: computed('instance.deviceRequests', function() { return !simpleNvidiaRequest(this.get('instance.deviceRequests')); }),
  requestSummary: computed('instance.deviceRequests', function() { return JSON.stringify(this.get('instance.deviceRequests') || [], null, 2); }),
  gpuMode: computed('instance.deviceRequests', '_selectingGpu', function() {
    let request = (this.get('instance.deviceRequests') || [])[0];
    if ( !request ) { return this.get('_selectingGpu') ? 'selected' : 'none'; }
    return request.deviceIds?.length ? 'selected' : (request.count === -1 ? 'all' : 'count');
  }),
  gpuCount: computed('instance.deviceRequests', function() { return (this.get('instance.deviceRequests') || [])[0]?.count || 1; }),
  groupText: computed('instance.groupAdd.[]', function() { return (this.get('instance.groupAdd') || []).join(', '); }),
  cpuLimit: computed('instance.{cpuQuota,cpuPeriod}', 'cpuError', 'cpuDraft', function() {
    if ( this.get('cpuError') ) { return this.get('cpuDraft'); }
    let quota = this.get('instance.cpuQuota');
    return quota > 0 ? quota / (this.get('instance.cpuPeriod') || 100000) : '';
  }),
  issues: computed('instance.{shmSize,ipcMode,runtime,deviceRequests,devices,pidsLimit,requestedHostId,cpuQuota,cpuPeriod,tmpfs,sysctls}', 'instance.groupAdd.[]', 'instance.ulimits.@each.{name,soft,hard}', 'selectedHost.{info,state}', 'shmError', 'cpuError', '_selectingGpu', 'tmpfsInvalid', 'sysctlsInvalid', 'intl._locale', function() {
    let keys = hardwareIssues(this.get('instance'), this.get('selectedHost'));
    if ( this.get('shmError') ) { keys.push(this.get('shmError')); }
    if ( this.get('cpuError') ) { keys.push(this.get('cpuError')); }
    if ( this.get('tmpfsInvalid') || this.get('sysctlsInvalid') ) { keys.push('map'); }
    if ( this.get('_selectingGpu') && !(this.get('instance.deviceRequests') || []).length ) { keys.push('gpuRequest'); }
    return [...new Set(keys)].map((key) => this.get('intl').t(key === 'deviceGroup' ? 'formResources.deviceGroupHelp' : `formResources.errors.${key}`));
  }),
  publishErrors: observer('issues.[]', function() {
    this.set('errors', this.get('issues'));
    let changed = this.get('preflightChanged');
    if ( typeof changed === 'function' ) { changed({blocked: !!this.get('issues.length'), pending: false}); }
  }),
  didInsertElement() { this._super(...arguments); this.publishErrors(); },
  actions: {
    setInteger(object, field, event) {
      // Docker uses -1 for unlimited. The legacy input-integer strips signs.
      let value = event.target.value;
      set(object, field, value === '' ? null : Number(value));
    },
    setCpuLimit(value) {
      this.set('cpuDraft', value);
      updateHardwareDraft(this.get('instance'), {cpuError: null});
      if ( value === '' ) { this.set('instance.cpuQuota', null); this.set('cpuError', null); return; }
      let period = this.get('instance.cpuPeriod') || 100000;
      let quota = Number(value) * period;
      if ( !Number.isSafeInteger(quota) || quota < 1000 ) { updateHardwareDraft(this.get('instance'), {cpuError: 'cpu', cpuDraft: value}); this.set('cpuError', 'cpu'); return; }
      this.setProperties({'instance.cpuQuota': quota, 'instance.cpuPeriod': period, cpuError: null});
    },
    addUlimit() {
      let available = this.get('availableUlimitNames');
      let name = available.includes('nofile') ? 'nofile' : available[0];
      if ( !name ) { return; }
      this.set('instance.ulimits', [...(this.get('instance.ulimits') || []), {name, soft: null, hard: null}]);
    },
    removeUlimit(item) { this.set('instance.ulimits', (this.get('instance.ulimits') || []).filter((row) => row !== item)); },
    setHost(event) {
      let hostId = event.target.value || null;
      let callback = this.get('setRequestedHost');
      if ( typeof callback === 'function' ) { callback(hostId); } else { this.set('instance.requestedHostId', hostId); }
    },
    setBoolean(field, event) { this.set(`instance.${field}`, !!event.target.checked); },
    setField(field, event) { this.set(`instance.${field}`, event.target.value || null); },
    setShm(value) {
      updateHardwareDraft(this.get('instance'), {shmError: null});
      this.set('shmDraft', value);
      try {
        let bytes = parseBytes(value, this.get('shmUnit'));
        this.set('instance.shmSize', bytes);
        this.set('shmError', null);
        let suffix = String(value).trim().match(/(g(?:ib|b)?|m(?:ib|b)?)$/i);
        if ( suffix ) {
          let unit = suffix[1][0].toLowerCase() === 'g' ? 'GiB' : 'MiB';
          this.set('shmUnit', unit);
          this.set('shmDraft', String(bytes / (unit === 'GiB' ? 1073741824 : 1048576)));
        }
      }
      catch (_) { updateHardwareDraft(this.get('instance'), {shmError: 'shm', shmDraft: value, shmUnit: this.get('shmUnit')}); this.set('shmError', 'shm'); }
    },
    setShmUnit(event) {
      this.set('shmUnit', event.target.value);
      if ( this.get('shmError') ) { this.send('setShm', this.get('shmDraft')); return; }
      let bytes = this.get('instance.shmSize');
      this.set('shmDraft', bytes ? String(bytes / (event.target.value === 'GiB' ? 1073741824 : 1048576)) : '');
    },
    setGroups(value) { this.set('instance.groupAdd', [...new Set(value.split(',').map((group) => group.trim()).filter(Boolean))]); },
    setMap(field, value) {
      let previous = this.get(`instance.${field}`);
      if ( JSON.stringify(previous || {}) !== JSON.stringify(value) ) { this.set(`instance.${field}`, value); }
    },
    mapRows(field, rows) { this.set('draft', updateHardwareDraft(this.get('instance'), {[`${field}Rows`]: rows})); },
    mapValidity(field, valid) {
      updateHardwareDraft(this.get('instance'), {[`${field}Invalid`]: !valid});
      this.set(`${field}Invalid`, !valid);
    },
    setGpuMode(event) {
      let mode = event.target.value;
      updateHardwareDraft(this.get('instance'), {selectingGpu: mode === 'selected'});
      if ( mode === 'none' || mode === 'selected' ) { this.set('instance.deviceRequests', []); this.set('_selectingGpu', mode === 'selected'); return; }
      this.set('_selectingGpu', false);
      this.set('instance.deviceRequests', [{driver: 'nvidia', count: mode === 'all' ? -1 : 1, capabilities: [['gpu']]}]);
    },
    setGpuCount(value) {
      this.set('instance.deviceRequests', [{driver: 'nvidia', count: Number(value), capabilities: [['gpu']]}]);
    },
    toggleDevice(device, event) {
      let enabled = event.target.checked;
      if ( device.kind === 'nvidia' ) {
        let current = (this.get('instance.deviceRequests') || [])[0] || {};
        let ids = (current.deviceIds || []).filter((id) => id !== device.id);
        if ( enabled ) { ids.push(device.id); }
        updateHardwareDraft(this.get('instance'), {selectingGpu: !ids.length});
        this.set('instance.deviceRequests', ids.length ? [{driver: 'nvidia', deviceIds: ids, capabilities: [['gpu']]}] : []);
      } else {
        let mappings = (this.get('instance.devices') || []).filter((mapping) => mapping.split(':')[0] !== device.path);
        if ( enabled ) {
          mappings.push(`${device.path}:${device.path}:rw`);
          let groups = this.get('instance.groupAdd') || [];
          this.set('instance.groupAdd', [...new Set([...groups, String(device.groupId)])]);
        }
        this.set('instance.devices', mappings);
      }
    },
    toggleAdvanced() { this.toggleProperty('advanced'); },
  },
});
