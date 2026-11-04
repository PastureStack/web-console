// Audit metadata may omit payloads or contain an authorized plain-text value.
// Formatting never requests more data or changes the server's payload policy.
export default function auditObjectDisplay(value) {
  if ( value === null || value === undefined || value === '' ) {
    return {state: 'empty', text: '', isJson: false};
  }

  let decoded = value;
  if ( typeof value === 'string' ) {
    try {
      decoded = JSON.parse(value);
    } catch (error) {
      return {state: 'content', text: value, isJson: false};
    }
  }

  try {
    let text = JSON.stringify(decoded, null, 2);
    return typeof text === 'string' ? {state: 'content', text, isJson: true} :
      {state: 'unavailable', text: '', isJson: false};
  } catch (error) {
    return {state: 'unavailable', text: '', isJson: false};
  }
}
