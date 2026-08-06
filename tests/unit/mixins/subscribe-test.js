import Ember from 'ember';
import { module, test } from 'qunit';

import Subscribe from 'ui/mixins/subscribe';

module('Unit | Mixin | subscribe');

test('the socket remains the only owner of automatic reconnects', function(assert) {
  let connectCalls = 0;
  let Subject = Ember.Object.extend(Subscribe, {
    forStr() {
      return '(test)';
    },

    connectSubscribe() {
      connectCalls++;
    },
  });
  let subject = Subject.create({
    connected: true,
    reconnect: true,
  });

  subject.subscribeDisconnected();

  assert.notOk(subject.get('connected'));
  assert.equal(
    connectCalls,
    0,
    'the disconnect callback does not race the socket reconnect timer'
  );

  Ember.run(() => subject.destroy());
});
