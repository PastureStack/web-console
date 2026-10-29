export function boundedCollaborationMode(buildMode, requested) {
  if ( !['enabled', 'read-only'].includes(buildMode) || !['off', 'read-only', 'enabled'].includes(requested) ) { return 'off'; }
  return buildMode === 'read-only' && requested === 'enabled' ? 'read-only' : requested;
}

export function collaborationStatusKey(status) {
  return `webmcp.collaboration.${({disabled: 'statusDisabled', registering: 'statusRegistering', enabled: 'statusEnabled',
    unsupported: 'statusUnsupported', unavailable: 'statusUnavailable'})[status] || 'statusUnavailable'}`;
}
