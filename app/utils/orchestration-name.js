export function displayOrchestrationName(value) {
  let name = String(value || '');

  if (name.toLowerCase() === 'cattle') {
    return 'PastureStack Orchestration Engine';
  }

  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

export default displayOrchestrationName;
