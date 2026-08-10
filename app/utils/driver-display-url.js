export function driverDisplayUrl(value) {
  let url = String(value || '');
  let match = url.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)(?:[/?#]|$)/i);

  if (!match) {
    return url;
  }

  return `.../${match[1]}/${match[2]}`;
}
