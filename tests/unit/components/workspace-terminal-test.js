import { module, test } from 'qunit';
import { decodeTerminalData } from 'ui/components/workspace-terminal/component';

module('Unit | Component | workspace terminal');

test('decodes brokered UTF-8 terminal output', function(assert) {
  let text = 'PastureStack 終端機\n';
  let encoded = window.btoa(unescape(encodeURIComponent(text)));

  assert.equal(decodeTerminalData(encoded), text);
});
