import assert from 'node:assert/strict';
import { test } from 'node:test';
import display from '../app/utils/audit-object-display.js';

test('metadata-only values have an explicit empty state', () => {
  for (const value of [null, undefined, '']) assert.deepEqual(display(value), {state: 'empty', text: '', isJson: false});
});
test('serialized and native JSON retain objects, arrays, false, zero and null', () => {
  for (const value of [{ok: true}, [false, 0], false, 0]) {
    assert.deepEqual(JSON.parse(display(value).text), value);
    assert.deepEqual(JSON.parse(display(JSON.stringify(value)).text), value);
  }
  assert.equal(display('null').text, 'null');
  assert.equal(display('""').text, '""');
});
test('malformed JSON remains ordinary text and does not block another field', () => {
  for (const value of ['undefined', '[unavailable]', '</code><script>test()</script>']) {
    assert.deepEqual(display(value), {state: 'content', text: value, isJson: false});
    assert.equal(display('{"response":true}').isJson, true);
  }
});
test('unsupported native values return a diagnostic state rather than throwing', () => {
  const circular = {}; circular.self = circular;
  for (const value of [circular, () => {}, 1n]) assert.deepEqual(display(value), {state: 'unavailable', text: '', isJson: false});
});
