import { settled } from '@ember/test-helpers';
import { module, test } from 'qunit';
import FormNameDescription from 'ui/components/form-name-description/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | form name description');

test('autofocus opt-out never schedules next or focuses a field', async function(assert) {
  let focused = 0, queried = 0;
  let component = createOwned(FormNameDescription, {
    renderer: inertRenderer(), autoFocus: false,
    $() { queried++; return [{focus() { focused++; }}]; },
  }, 'component');
  try {
    component.didInsertElement();
    assert.notOk(component._autoFocusTimer, 'opt-out creates no asynchronous focus work');
    await settled();
    assert.strictEqual(queried, 0, 'opt-out never searches for an input');
    assert.strictEqual(focused, 0, 'opt-out cannot steal modal keyboard focus');
  } finally {
    destroyOwned(component);
  }
});

test('other callers retain default initial focus on the first enabled field', async function(assert) {
  let focused = 0, query;
  let component = createOwned(FormNameDescription, {
    renderer: inertRenderer(),
    $(selector) { query = selector; return [{focus() { focused++; }}]; },
  }, 'component');
  try {
    assert.strictEqual(component.get('autoFocus'), true, 'default behavior remains enabled');
    component.didInsertElement();
    assert.ok(component._autoFocusTimer, 'default callers still schedule next');
    assert.strictEqual(focused, 0, 'initial focus remains deferred');
    await settled();
    assert.strictEqual(query, 'INPUT:enabled, TEXTAREA:enabled');
    assert.strictEqual(focused, 1, 'the first enabled field is focused once');
    assert.strictEqual(component._autoFocusTimer, null, 'completed work releases its timer');
  } finally {
    destroyOwned(component);
  }
});

test('both destroy hooks cancel the deferred child autofocus', async function(assert) {
  // Owner teardown is separately queued by the shared fixture. Invoke each
  // actual component hook while next is still pending, without a timing race.
  for (let hook of ['willDestroyElement', 'willDestroy']) {
    let focused = 0;
    let component = createOwned(FormNameDescription, {
      renderer: inertRenderer(),
      $() { return [{focus() { focused++; }}]; },
    }, 'component');
    try {
      component.didInsertElement();
      assert.ok(component._autoFocusTimer, `${hook} has pending work to cancel`);
      component[hook]();
      assert.strictEqual(component._autoFocusTimer, null, `${hook} immediately releases its own next timer`);
      await settled();
      assert.strictEqual(focused, 0, `${hook} prevents the pending callback from focusing`);
    } finally {
      destroyOwned(component);
    }
  }
});
