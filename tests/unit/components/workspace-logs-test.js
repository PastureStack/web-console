import { module, test } from 'qunit';
import {
  LOG_WRAP_STORAGE_KEY,
  parseLogPayload,
  readLogWrapPreference,
  saveLogWrapPreference,
} from 'ui/components/workspace-logs/component';

module('Unit | Component | workspace logs');

test('preserves the raw log WebSocket framing relayed by the broker', function(assert) {
  let parsed = parseLogPayload(
    '01[2026-07-26T09:48:35Z] first line\n[2026-07-26T09:48:36Z] second line\n'
  );

  assert.equal(parsed.type, 1);
  assert.deepEqual(parsed.lines, [
    '[2026-07-26T09:48:35Z] first line',
    '[2026-07-26T09:48:36Z] second line',
  ]);
});

test('falls back to the combined stream for malformed framing', function(assert) {
  let parsed = parseLogPayload('xxmessage');

  assert.equal(parsed.type, 0);
  assert.deepEqual(parsed.lines, ['message']);
});

test('persists the log line wrapping preference without failing on blocked storage', function(assert) {
  let values = {};
  let storage = {
    getItem(key) {
      return values[key] || null;
    },
    setItem(key, value) {
      values[key] = value;
    },
  };

  assert.notOk(readLogWrapPreference(storage), 'wrapping defaults to disabled');
  assert.ok(saveLogWrapPreference(true, storage));
  assert.equal(values[LOG_WRAP_STORAGE_KEY], 'true');
  assert.ok(readLogWrapPreference(storage));
  assert.ok(saveLogWrapPreference(false, storage));
  assert.equal(values[LOG_WRAP_STORAGE_KEY], 'false');

  let blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.notOk(readLogWrapPreference(blocked));
  assert.notOk(saveLogWrapPreference(true, blocked));
});
