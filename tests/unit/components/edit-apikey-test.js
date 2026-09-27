import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import EditApiKey from 'ui/components/edit-apikey/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit apikey');

test('cancel clears delayed focus; a stale callback has no input and cannot write', function(assert) {
  let closed = 0;
  let writes = 0;
  let focus = 0;
  let inputPresent = true;
  let scheduled;
  let cleared;
  let originalSetTimeout = window.setTimeout;
  let originalClearTimeout = window.clearTimeout;
  let component = createOwned(EditApiKey, {
    renderer: inertRenderer(),
    modalService: EmberObject.create({
      modalOpts: null,
      toggleModal() { closed++; inputPresent = false; },
    }),
    model: EmberObject.create({save() { writes++; }}),
    $() { return inputPresent ? [{focus() { focus++; }}] : []; },
  }, 'component');

  try {
    window.setTimeout = (callback, delay) => {
      assert.strictEqual(delay, 250);
      scheduled = callback;
      return 12345;
    };
    window.clearTimeout = (timer) => { cleared = timer; };

    component.didInsertElement();
    component.get('actions').cancel.call(component);
    component.willDestroyElement();
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  }

  assert.strictEqual(closed, 1, 'Cancel closes the modal');
  assert.strictEqual(cleared, 12345, 'destroy clears the delayed callback');
  assert.strictEqual(component._focusTimer, null, 'timer ownership is released');
  scheduled();
  assert.strictEqual(focus, 0, 'a stale callback cannot focus a missing input');
  assert.strictEqual(writes, 0, 'Cancel and focus never save the API key');
  destroyOwned(component);
});
