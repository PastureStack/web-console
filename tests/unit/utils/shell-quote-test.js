import { module, test } from 'qunit';
import ShellQuote from 'ui/utils/shell-quote';

module('Unit | Utility | Shell quote', function() {
  test('rejects all line terminators after a comment token', function(assert) {
    ['\n', '\r', '\u2028', '\u2029'].forEach((terminator) => {
      assert.throws(() => ShellQuote.quote([
        'echo', 'ok', { comment: 'x' }, `a${ terminator }id;#`,
      ]), /after a `comment` must not contain line terminators/);
    });
  });

  test('rejects appended hostile strings after a parsed mid-word comment', function(assert) {
    const command = ShellQuote.parse('echo http://example.com/#fragment');
    assert.ok(command.some((token) => token && typeof token === 'object' && 'comment' in token));
    ['\n', '\r', '\u2028', '\u2029'].forEach((terminator) => {
      assert.throws(() => ShellQuote.quote(command.concat(`a${ terminator }id;#`)),
        /after a `comment` must not contain line terminators/);
    });
  });

  test('preserves legitimate command parsing and single-token catalog quoting', function(assert) {
    assert.deepEqual(ShellQuote.parse("echo 'hello world'"), ['echo', 'hello world']);
    ['', 'hello world', "O'Brien!", '$HOME; echo value', 'line\nvalue'].forEach((answer) => {
      assert.deepEqual(ShellQuote.parse(ShellQuote.quote([answer])), [answer]);
    });
    assert.strictEqual(ShellQuote.quote(['echo', { comment: 'x' }, 'ordinary']), 'echo #x ordinary');
    assert.strictEqual(ShellQuote.quote(['line\nvalue', { comment: 'x' }]), "'line\nvalue' #x");
  });
});
