import { module, test } from 'qunit';
import { parseLogPayload } from 'ui/components/workspace-logs/component';

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
