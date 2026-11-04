const TYPES = {certificate: 'certificatesPage.index.header', dnsService: 'servicePage.type.dnsservice', externalService: 'servicePage.type.externalservice', stack: 'apiKeyAccess.selector.types.stack', service: 'apiKeyAccess.selector.types.service', container: 'apiKeyAccess.selector.types.container'};
const OPERATIONS = {update_targets: 'formTarget.target', start: 'action.start', stop: 'action.stop', restart: 'action.restart', remove: 'action.remove',
  create: 'saveCancel.create', create_from_catalog: 'newCatalog.saveNew', update_metadata: 'generic.edit', scale: 'serviceInfoPartial.scale', archive: 'archive.action', restore: 'archive.restore'};
const FIELDS = {startFirst: 'formUpgrade.startStop', batchSize: 'formUpgrade.size', intervalMillis: 'formUpgrade.interval', targetServices: 'formTarget.target', hostname: 'formTarget.pointHostname', externalIpAddresses: 'formTarget.pointAddress', name: 'generic.name', description: 'generic.description', image: 'generic.image', scale: 'serviceInfoPartial.scale',
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
export function resourceConfirmationErrorKey(code) {
  if ( code === 'FORBIDDEN' ) { return 'webmcp.forbidden'; }
  return ['CONFLICT', 'SESSION_REQUIRED', 'STALE_REFERENCE', 'STALE_REF', 'CONTEXT_CHANGED'].includes(code) ? 'webmcp.stale' : 'webmcp.failed';
}

// UI text only. Keep the immutable plan and its exact JSON program values intact.
export function resourceReviewLabels(plan, translate) {
  const text = (key) => String(translate(key || 'generic.unknown'));
  const label = (map, key) => Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
  const value = (field, input) => {
    if ( input === null ) { return text('webmcp.nullValue'); }
    if ( input === '' ) { return text('webmcp.emptyValue'); }
    if ( typeof input === 'boolean' ) { return text(input ? 'generic.yess' : 'generic.noo'); }
    if ( field === 'intervalMillis' && input !== null ) { return `${input} ${text('formHealthCheck.interval.unit')}`; }
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
    executionAssignedPorts: plan.executionResult ? JSON.stringify(plan.executionResult.assignedPorts) : null,
    upgradeStrategyChanges: plan.upgradeStrategy ? ['startFirst', 'batchSize', 'intervalMillis'].map((field) => ({
      field, fieldLabel: text(label(FIELDS, field)), after: value(field, plan.upgradeStrategy[field]),
    })) : [],
    createsStopped: plan.operation === 'create' && ['service', 'container', 'externalService', 'dnsService'].includes(plan.resourceType),
    archiveNotices: ['archive', 'restore'].includes(plan.operation) ? [text(plan.operation === 'archive' ? 'archive.explanation' : 'archive.restoreExplanation'),
      text(plan.operation === 'archive' ? 'archive.requiresStopped' : 'archive.restoreBeforeStart'), text('archive.dataWarning')] : [],
    mountedDataNotice: (plan.displayDiff || []).some((change) => change.field === 'mountedDataRule' && change.after === 'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE') ? text('webmcp.domainRetentionNotice') : null,
    displayChanges: (plan.displayDiff || []).filter((change) => change.field !== 'mountedDataRule').map((change) => {
      const count = ['affectedServiceCount', 'affectedInstanceCount', 'affectedMountCount'].includes(change.field);
      return {field: change.field, fieldLabel: text(label(FIELDS, change.field)), informational: count || change.field === 'emptyStack',
        before: value(change.field, change.before), after: value(change.field, count ? change.before : change.after)};
    }),
  };
}
