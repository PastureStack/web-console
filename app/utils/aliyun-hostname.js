export function isValidAliyunHostname(value) {
  let name = String(value || '');

  if (!/^[A-Za-z]/.test(name) || !/[A-Za-z0-9]$/.test(name)) {
    return false;
  }

  return name.split('.').every((label) => {
    return label.length > 0 &&
      /^[A-Za-z0-9-]+$/.test(label) &&
      label.charAt(0) !== '-' &&
      label.charAt(label.length - 1) !== '-';
  });
}
