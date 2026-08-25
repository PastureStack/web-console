import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import StoreTweaks from 'ui/mixins/store-tweaks';
import C from 'ui/utils/constants';

module('Unit | Mixin | store tweaks');

test('headers read the current server-managed CSRF cookie on every request', function(assert) {
  let csrf = 'first-token';
  let Cookies = EmberObject.extend({
    unknownProperty(key) {
      if ( key === C.COOKIE.CSRF ) {
        return csrf;
      }

      return null;
    },
  });
  let Subject = EmberObject.extend(StoreTweaks);
  let cookies = Cookies.create();
  let subject = Subject.create({cookies});

  let first = subject.get('headers');
  csrf = 'second-token';
  let second = subject.get('headers');

  assert.notStrictEqual(first, second, 'the native getter is not cached');
  assert.equal(first[C.HEADER.CSRF], 'first-token');
  assert.equal(second[C.HEADER.CSRF], 'second-token');
  assert.equal(second[C.HEADER.ACTIONS], C.HEADER.ACTIONS_VALUE);
  assert.equal(second[C.HEADER.NO_CHALLENGE], C.HEADER.NO_CHALLENGE_VALUE);

  run(() => {
    subject.destroy();
    cookies.destroy();
  });
});
