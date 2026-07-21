import Ember from 'ember';
import { module, test } from 'qunit';
import {
  GLOBAL_FIELDS,
  LAYOUT_FIELDS,
  plainObject,
  readJson,
} from 'ui/services/console-workspace';

module('Unit | Service | console workspace');

test('persists session identity globally and geometry only per tab', function(assert) {
  let entry = Ember.Object.create({
    sessionId: 'psw_session',
    secret: 'secret',
    kind: 'terminal',
    x: 20,
    y: 80,
    width: 900,
    height: 620,
    instance: {privateRuntimeObject: true},
  });
  let global = plainObject(entry, GLOBAL_FIELDS);
  let layout = plainObject(entry, LAYOUT_FIELDS);

  assert.equal(global.sessionId, 'psw_session');
  assert.equal(global.secret, 'secret');
  assert.notOk('x' in global);
  assert.notOk('instance' in global);
  assert.equal(layout.x, 20);
  assert.equal(layout.width, 900);
  assert.notOk('secret' in layout);
});

test('removes malformed stored JSON without affecting valid data', function(assert) {
  let values = {
    valid: '{"sessions":2}',
    broken: '{',
  };
  let storage = {
    getItem(key) {
      return values[key] || null;
    },
    removeItem(key) {
      delete values[key];
    },
  };

  assert.deepEqual(readJson(storage, 'valid', {}), {sessions: 2});
  assert.deepEqual(readJson(storage, 'broken', []), []);
  assert.notOk('broken' in values);
});
