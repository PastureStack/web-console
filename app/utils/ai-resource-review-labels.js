const TYPES = {volume: 'apiKeyAccess.selector.types.volume', registry: 'registriesPage.index.header',loadBalancerService: 'servicePage.type.loadbalancerservice', project: 'apiKeyAccess.selector.types.project', host: 'apiKeyAccess.selector.types.host', certificate: 'certificatesPage.index.header', dnsService: 'servicePage.type.dnsservice', externalService: 'servicePage.type.externalservice', stack: 'apiKeyAccess.selector.types.stack', service: 'apiKeyAccess.selector.types.service', container: 'apiKeyAccess.selector.types.container'};
const OPERATIONS = {update_links: 'servicePage.linksTab.header', update_targets: 'formTarget.target', start: 'action.start', stop: 'action.stop', restart: 'action.restart', remove: 'action.remove',
  create: 'saveCancel.create', create_from_catalog: 'newCatalog.saveNew', update_metadata: 'generic.edit', scale: 'serviceInfoPartial.scale', archive: 'archive.action', restore: 'archive.restore',
  finish_upgrade: 'action.finishUpgrade', rollback: 'action.rollback', cancel_upgrade: 'action.cancelUpgrade'};
const FIELDS = {driver: 'formVolumes.volumeDriver.label', portRules: 'formBalancerRules.label',startFirst: 'formUpgrade.startStop', batchSize: 'formUpgrade.size', intervalMillis: 'formUpgrade.interval', targetServices: 'formTarget.target', hostname: 'formTarget.pointHostname', externalIpAddresses: 'formTarget.pointAddress', name: 'generic.name', description: 'generic.description', image: 'generic.image', scale: 'serviceInfoPartial.scale',
  state: 'generic.state', stackId: 'apiKeyAccess.selector.types.stack', command: 'sidekickAddtlInfo.command', entryPoint: 'sidekickAddtlInfo.entryPoint', ports: 'generic.ports', healthCheck: 'newContainer.tabs.healthCheck',
  operation: 'generic.actions', childServiceState: 'webmcp.childServiceState', affectedInstanceCount: 'webmcp.affectedInstanceCount', affectedMountCount: 'webmcp.affectedMountCount',
  startOnCreate: 'webmcp.startOnCreate', affectedServiceCount: 'webmcp.affectedServiceCount', emptyStack: 'webmcp.emptyStack',
  catalogTemplate: 'newCatalog.catalog', catalogVersion: 'newCatalog.templateVersion', serviceCount: 'apiKeyAccess.selector.types.service',
  volumeCount: 'apiKeyAccess.selector.types.volume', humanInputCount: 'webmcp.catalogHumanInputCount', referenceCount: 'webmcp.catalogReferenceCount', archived: 'archive.filterLabel'};
const STATES = {active: 'formPorts.preflight.state.active', inactive: 'formPorts.preflight.state.inactive',
  running: 'formPorts.preflight.state.running', stopped: 'formPorts.preflight.state.stopped',
  removed: 'webmcp.removedState', mixed: 'webmcp.mixedState', empty: 'webmcp.emptyStack',
  start: 'action.start', stop: 'action.stop', restart: 'action.restart', remove: 'action.remove'};
const HEALTH_FIELDS = {port: 'port', requestLine: 'request', interval: 'interval', responseTimeout: 'timeout', healthyThreshold: 'healthyThreshold',
  unhealthyThreshold: 'unhealthyThreshold', initializingTimeout: 'initializingTimeout', reinitializingTimeout: 'reinitializingTimeout', strategy: 'strategy'};

// Only an already sanitized public code selects fixed human guidance.
export function resourceConfirmationErrorKey(code, reason) {
  if ( code === 'NEEDS_USER' && reason === 'BRIDGE_PROJECT_BINDING_REQUIRED' ) { return 'webmcp.bridgeProjectBindingRequired'; }
  if ( code === 'FORBIDDEN' ) { return 'webmcp.forbidden'; }
  return ['CONFLICT', 'SESSION_REQUIRED', 'STALE_REFERENCE', 'STALE_REF', 'CONTEXT_CHANGED'].includes(code) ? 'webmcp.stale' : 'webmcp.failed';
}

// UI text only. Keep the immutable plan and its exact JSON program values intact.
export function resourceReviewLabels(plan, translate, stacks = []) {
  const text = (key) => String(translate(key || 'generic.unknown'));
  const label = (map, key) => Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
  const stackParent = plan.operation === 'create' && ['service', 'container'].includes(plan.resourceType);
  const stackName = (id) => {
    if ( typeof id !== 'string' || !plan.context || typeof plan.context.projectId !== 'string' ) { return null; }
    const matches = stacks.filter((stack) => stack.id === id && stack.accountId === plan.context.projectId && !stack.removed);
    return matches.length === 1 && typeof matches[0].name === 'string' && matches[0].name.trim() && matches[0].name.length <= 1024 ? matches[0].name : null;
  };
  const stackTargetUnavailable = stackParent && (plan.displayDiff || []).some((change) => change.field === 'stackId' &&
    [change.before, change.after].some((id) => id !== null && !stackName(id)));
  const value = (field, input) => {
    if ( input === null ) { return text('webmcp.nullValue'); }
    if ( field === 'driver' && plan.resourceType === 'volume' && input === 'local' ) { return text('formVolumes.volumeDriver.local'); }
    if ( field === 'stackId' && stackParent ) { return stackName(input) || text('generic.unknown'); }
    if ( input === '' ) { return text('webmcp.emptyValue'); }
    if ( typeof input === 'boolean' ) { return text(input ? 'generic.yess' : 'generic.noo'); }
    if ( field === 'intervalMillis' && input !== null ) { return `${input} ${text('formHealthCheck.interval.unit')}`; }
    if ( field === 'portRules' ) {
      const rows = JSON.parse(input);
      return rows.map(rule => `${text('formBalancerRules.protocol.label')}: TCP; ${text('formBalancerRules.access.label')}: ${text(`formBalancerRules.access.${rule.access}`)}; ${text('formBalancerRules.sourcePort.label')}: ${rule.sourcePort}; ${text('formBalancerRules.target')}: ${rule.target}; ${text('formBalancerRules.targetPort.label')}: ${rule.targetPort}`).join('\n');
    }
    if ( field === 'healthCheck' ) {
      // The command engine already checked this closed JSON value. Translate
      // its labels and units while leaving the immutable review JSON intact.
      try {
        const check = JSON.parse(input);
        const rows = Object.keys(HEALTH_FIELDS).filter((key) => Object.prototype.hasOwnProperty.call(check, key)).map((key) => {
          const name = HEALTH_FIELDS[key], unit = ['port', 'requestLine', 'strategy'].includes(key) ? '' : ` ${text(`formHealthCheck.${name}.unit`)}`;
          const display = key === 'strategy' ? text(`formHealthCheck.strategy.${check[key]}`) : check[key] === '' ? text('webmcp.emptyValue') : String(check[key]);
          return `${text(`formHealthCheck.${name}.label`)}: ${display}${unit}`;
        });
        if ( plan.resourceType === 'externalService' ) { rows.unshift(`${text('formHealthCheck.label')}: ${text('formHealthCheck.checkType.tcp')}`); }
        return rows.join('\n');
      } catch (error) { return plan.resourceType === 'externalService' ? text('generic.unknown') : String(input); }
    }
    if ( ['state', 'childServiceState'].includes(field) && label(STATES, input) ) { return text(label(STATES, input)); }
    if ( field === 'operation' && label(OPERATIONS, input) ) { return text(label(OPERATIONS, input)); }
    return String(input);
  };
  return {
    resourceTypeLabel: text(label(TYPES, plan.resourceType)), operationLabel: text(label(OPERATIONS, plan.operation)),
    stackTargetUnavailable,
    localVolumeCreateNotice: plan.resourceType === 'volume' && plan.operation === 'create' ? text('webmcp.localVolumeCreateNotice') : null,
    externalHealthCheckNotice: plan.resourceType === 'externalService' && plan.operation === 'create' &&
      (plan.displayDiff || []).some((change) => change.field === 'healthCheck' && change.after !== null) ? text('newExternalService.alert') : null,
    executionAssignedPorts: plan.executionResult ? JSON.stringify(plan.executionResult.assignedPorts) : null,
    upgradeStrategyChanges: plan.upgradeStrategy ? ['startFirst', 'batchSize', 'intervalMillis'].map((field) => ({
      field, fieldLabel: text(label(FIELDS, field)), after: value(field, plan.upgradeStrategy[field]),
    })) : [],
    createsStopped: plan.operation === 'create' && (['service', 'container', 'externalService', 'dnsService'].includes(plan.resourceType) || plan.resourceType === 'loadBalancerService' && (plan.displayDiff || []).some(change => change.field === 'startOnCreate' && change.after === false)),
    archiveNotices: ['archive', 'restore'].includes(plan.operation) ? [text(plan.operation === 'archive' ? 'archive.explanation' : 'archive.restoreExplanation'),
      text(plan.operation === 'archive' ? 'archive.requiresStopped' : 'archive.restoreBeforeStart'), text('archive.dataWarning')] : [],
    mountedDataNotice: (plan.displayDiff || []).some((change) => change.field === 'mountedDataRule' && change.after === 'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE') ? text('webmcp.domainRetentionNotice') : null,
    upgradeConfigurationChanges: (plan.configurationChanges || []).map(change => ({field: change.field, fieldLabel: text(label(FIELDS, change.field)),
      before: value(change.field, change.before), after: value(change.field, change.after)})),
    displayChanges: (plan.displayDiff || []).filter((change) => change.field !== 'mountedDataRule').map((change) => {
      const count = ['affectedServiceCount', 'affectedInstanceCount', 'affectedMountCount'].includes(change.field);
      return {field: change.field, fieldLabel: text(label(FIELDS, change.field)), informational: count || change.field === 'emptyStack',
        before: value(change.field, change.before), after: value(change.field, count ? change.before : change.after)};
    }),
  };
}
