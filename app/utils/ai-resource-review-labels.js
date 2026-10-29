const TYPES = {stack: 'apiKeyAccess.selector.types.stack', service: 'apiKeyAccess.selector.types.service', container: 'apiKeyAccess.selector.types.container'};
const OPERATIONS = {start: 'action.start', stop: 'action.stop', restart: 'action.restart', remove: 'action.remove',
  create: 'saveCancel.create', create_from_catalog: 'newCatalog.saveNew', update_metadata: 'generic.edit', scale: 'serviceInfoPartial.scale', archive: 'archive.action', restore: 'archive.restore'};
const FIELDS = {name: 'generic.name', description: 'generic.description', image: 'generic.image', scale: 'serviceInfoPartial.scale',
  state: 'generic.state', stackId: 'apiKeyAccess.selector.types.stack', command: 'sidekickAddtlInfo.command', entryPoint: 'sidekickAddtlInfo.entryPoint',
  operation: 'generic.actions', childServiceState: 'webmcp.childServiceState', affectedInstanceCount: 'webmcp.affectedInstanceCount', affectedMountCount: 'webmcp.affectedMountCount',
  startOnCreate: 'webmcp.startOnCreate', affectedServiceCount: 'webmcp.affectedServiceCount', emptyStack: 'webmcp.emptyStack',
  catalogTemplate: 'newCatalog.catalog', catalogVersion: 'newCatalog.templateVersion', serviceCount: 'apiKeyAccess.selector.types.service',
  volumeCount: 'apiKeyAccess.selector.types.volume', humanInputCount: 'webmcp.catalogHumanInputCount', referenceCount: 'webmcp.catalogReferenceCount', archived: 'archive.filterLabel'};
const STATES = {active: 'formPorts.preflight.state.active', inactive: 'formPorts.preflight.state.inactive',
  running: 'formPorts.preflight.state.running', stopped: 'formPorts.preflight.state.stopped',
  removed: 'webmcp.removedState', mixed: 'webmcp.mixedState', empty: 'webmcp.emptyStack',
  start: 'action.start', stop: 'action.stop', restart: 'action.restart', remove: 'action.remove'};

// UI text only. Keep the immutable plan and its exact JSON program values intact.
export function resourceReviewLabels(plan, translate) {
  const text = (key) => String(translate(key || 'generic.unknown'));
  const label = (map, key) => Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
  const value = (field, input) => {
    if ( input === null ) { return text('webmcp.nullValue'); }
    if ( input === '' ) { return text('webmcp.emptyValue'); }
    if ( typeof input === 'boolean' ) { return text(input ? 'generic.yess' : 'generic.noo'); }
    if ( ['state', 'childServiceState'].includes(field) && label(STATES, input) ) { return text(label(STATES, input)); }
    if ( field === 'operation' && label(OPERATIONS, input) ) { return text(label(OPERATIONS, input)); }
    return String(input);
  };
  return {
    resourceTypeLabel: text(label(TYPES, plan.resourceType)), operationLabel: text(label(OPERATIONS, plan.operation)),
    createsStopped: plan.operation === 'create' && ['service', 'container'].includes(plan.resourceType),
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
