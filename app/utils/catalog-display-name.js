export function catalogDisplayName(name) {
  return (name || '').replace(
    /^(?:\s*PastureStack(?:\s*[-–—:：|｜/]\s*|\s+))+/i,
    ''
  ).trim();
}
