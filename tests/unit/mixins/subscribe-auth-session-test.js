import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import Subscribe from 'ui/mixins/subscribe';
import C from 'ui/utils/constants';

const Subject = EmberObject.extend(Subscribe, {
  init() {
    // Unit tests exercise the extracted message boundary directly without
    // opening a real WebSocket.
  },
});

module('Unit | Mixin | subscribe auth session');

test('a WebSocket logout is passive and carries the socket generation', function(assert) {
  assert.expect(5);
  let subject = Subject.create({
    access: {captureGeneration() { return 'new-generation'; }},
    'tab-session': EmberObject.create({[C.TABSESSION.PROJECT]: '1a5'}),
  });
  let disconnected = 0;
  subject.disconnectSubscribe = function() {
    disconnected++;
  };
  subject.send = function(action, transition, timedOut, error, generation, status) {
    assert.strictEqual(action, 'sessionInvalid', 'the socket cannot request explicit logout');
    assert.strictEqual(timedOut, false, 'a stale socket does not show an expiry message');
    assert.strictEqual(generation, 'old-generation', 'the socket opening generation is preserved');
    assert.strictEqual(status, 401, 'the passive authentication signal is preserved');
  };

  subject.handleSubscribeMessage({data: JSON.stringify({name: 'logout'})}, {
    getMetadata() {
      return {projectId: '1a5', authGeneration: 'old-generation'};
    },
  }, EmberObject.create());

  assert.strictEqual(disconnected, 1, 'stale socket work is stopped immediately');
  run(() => subject.destroy());
});

test('a current WebSocket logout still uses passive invalidation', function(assert) {
  assert.expect(3);
  let subject = Subject.create({
    access: {captureGeneration() { return 'current-generation'; }},
    'tab-session': EmberObject.create({[C.TABSESSION.PROJECT]: '1a5'}),
  });
  subject.send = function(action, transition, timedOut, error, generation) {
    assert.strictEqual(action, 'sessionInvalid', 'server logout is revalidated instead of revoked by the browser');
    assert.strictEqual(timedOut, true, 'a current invalid session can show the expiry message');
    assert.strictEqual(generation, 'current-generation', 'the socket generation is supplied for ownership checks');
  };

  subject.handleSubscribeMessage({data: JSON.stringify({name: 'logout'})}, {
    getMetadata() {
      return {projectId: '1a5', authGeneration: 'current-generation'};
    },
  }, EmberObject.create());
  run(() => subject.destroy());
});
