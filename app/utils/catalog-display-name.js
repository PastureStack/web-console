export function catalogDisplayName(name) {
  return (name || '').replace(
    /^PastureStack(?:\s*[-—:：]\s*|\s+)/i,
    ''
  );
}
