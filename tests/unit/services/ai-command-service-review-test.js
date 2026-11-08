import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import AiCommandService from 'ui/services/ai-command-service';
import { CommandContext } from 'ui/utils/ai-command-context';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Service | AI command human review');

function preview() {
  return {
    id: 'aichange-11111111-1111-1111-1111-111111111111',
    resourceType: 'port', operation: 'update_public_port', resourceId: 'port-selected',
    targetPath: 'source container / 80/tcp', confirmationState: 'pending', status: 'preview',
    verifiedResult: false, expiresAt: new Date(Date.now() + 60000).toISOString(),
    changes: [
      {field: 'sourceContainer', before: 'source [native-uuid]', after: 'source [native-uuid]'},
      {field: 'publicPort', before: 8000, after: 8080},
      {field: 'privatePort', before: 80, after: 80},
      {field: 'protocol', before: 'tcp', after: 'tcp'},
      {field: 'bindAddress', before: '127.0.0.1', after: '127.0.0.1'},
    ],
  };
}

test('Human Port approval re-reads the exact displayed plan and rejects a changed or missing field before POST', async function(assert) {
  for (let change of ['unchanged', 'changed binding', 'missing source']) {
    let current = preview();
    let requests = [];
    let sequence = 0;
    let context = new CommandContext(() => ({generation: 'generation-one', accountId: '1a1',
      projectId: '1a5', projectName: 'Default', schemaProjectId: '1a5', schemaGeneration: 1,
      route: '/containers'}), () => String(++sequence));
    context.setMode('enabled');
    let commandContext = EmberObject.create({context, on() {}, off() {}});
    let service = createOwned(AiCommandService, {
      commandContext,
      environmentActions: EmberObject.create({}),
      access: EmberObject.create({async ensureSession() {}}),
      app: EmberObject.create({apiEndpoint: '/v2-beta'}),
      userStore: EmberObject.create({async rawRequest(request) {
        requests.push(request);
        return {body: request.method === 'POST' ? Object.assign({}, current, {confirmationState: 'approved'}) : current};
      }}),
    });
    try {
      let offered = service.reviewInboxPlan(current);
      assert.strictEqual(offered.status, 'needs_user', `${change}: the real service accepts the preview`);
      let reviewed = service.get('pendingPlan');
      assert.ok(reviewed.reviewSignature, 'the displayed plan has a pinned review');
      if ( change === 'changed binding' ) {
        current = Object.assign({}, current, {changes: current.changes.map(row => row.field === 'bindAddress' ?
          {field: row.field, before: '0.0.0.0', after: '0.0.0.0'} : row)});
      } else if ( change === 'missing source' ) {
        current = Object.assign({}, current, {changes: current.changes.filter(row => row.field !== 'sourceContainer')});
      }
      let outcome = await service.confirmPendingPlan(reviewed);
      assert.strictEqual(requests.filter(row => row.method === 'GET').length, 1, 'confirmation first reads the current plan');
      assert.strictEqual(requests.filter(row => row.method === 'POST').length, change === 'unchanged' ? 1 : 0,
        'only the unchanged, fully reviewed plan reaches one confirmation POST');
      if ( change === 'unchanged' ) {
        assert.strictEqual(outcome.status, 'succeeded', 'the valid confirmation succeeds');
        assert.true(requests[1].url.endsWith('?action=confirm'), 'confirmation never applies the resource mutation');
      } else {
        assert.true(['CONFLICT', 'INVALID_RESPONSE'].includes(outcome.code), 'the original plan cannot hide changed review data');
      }
    } finally {
      destroyOwned(service);
    }
  }
});
