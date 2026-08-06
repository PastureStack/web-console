const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export default function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[&<>"'`=]/g, (character) => HTML_ENTITIES[character]);
}
