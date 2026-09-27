import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import ProjectTemplate from 'ui/models/projecttemplate';

module('Unit | Model | projecttemplate');

function template(accountId, sessionAccountId, admin = false, isPublic) {
  return ProjectTemplate.create({
    accountId,
    isPublic,
    session: EmberObject.create({accountId: sessionAccountId}),
    access: EmberObject.create({admin}),
  });
}

function actionEnabled(record, action) {
  return record.get('availableActions').find((choice) => choice.action === action).enabled;
}

test('non-admin does not get edit or remove for a public system template with hidden isPublic', function(assert) {
  let record = template(null, '1a-reader');

  assert.false(record.get('canEdit'));
  assert.false(actionEnabled(record, 'edit'));
  assert.false(actionEnabled(record, 'promptDelete'));
  record.destroy();
});

test('non-admin retains edit and remove for an owned private template when isPublic is omitted', function(assert) {
  let record = template('1a-owner', '1a-owner');

  assert.true(record.get('canEdit'));
  assert.true(actionEnabled(record, 'edit'));
  assert.true(actionEnabled(record, 'promptDelete'));
  record.destroy();
});

test('a cached private template owned by someone else remains uneditable', function(assert) {
  let record = template('1a-other', '1a-reader', false, false);

  assert.false(record.get('canEdit'));
  assert.false(actionEnabled(record, 'edit'));
  assert.false(actionEnabled(record, 'promptDelete'));
  record.destroy();
});

test('administrator may edit a public system template without an owner', function(assert) {
  let record = template(null, '1a-admin', true, true);

  assert.true(record.get('canEdit'));
  assert.true(actionEnabled(record, 'edit'));
  assert.true(actionEnabled(record, 'promptDelete'));
  record.destroy();
});

test('missing owner or session account fails closed and session changes invalidate actions', function(assert) {
  let record = template(undefined, '1a-reader');

  assert.false(record.get('canEdit'), 'missing owner');
  record.set('accountId', '1a-reader');
  assert.true(record.get('canEdit'), 'matching owner');
  record.set('session.accountId', null);
  assert.false(record.get('canEdit'), 'missing session account');
  assert.false(actionEnabled(record, 'edit'));
  assert.false(actionEnabled(record, 'promptDelete'));
  record.destroy();
});
