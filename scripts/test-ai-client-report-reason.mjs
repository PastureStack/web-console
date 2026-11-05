import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import YAML from 'yamljs';
import {preprocess, traverse} from '@glimmer/syntax';
const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const policy = moduleUrl(text('app/utils/api-key-policy.js'));
// Exercise the real safeRecord projector. Only the surrounding Ember runtime
// declarations are stubbed; no role, evidence or reason logic is replaced.
const source = text('app/components/api-key-audit/component.js')
  .replace("import Component from '@ember/component';", 'const Component = {extend: value => value};')
  .replace("import { observer } from '@ember/object';", 'const observer = (...args) => args.at(-1);')
  .replace("import { service } from '@ember/service';", 'const service = () => null;')
  .replace("import { later, cancel } from '@ember/runloop';", 'const later = () => null, cancel = () => {};')
  .replace("from 'ui/utils/api-key-policy'", "from '" + policy + "'")
  .replace(/\.property\([^)]*\)/g, '');
const {default: component} = await import(moduleUrl(source));
const project = record => component.safeRecord.call({get: key => component[key]}, record);
const report = {id: 'event-1', keyId: 'key-1', resourceType: 'aiToolCallEvent', operation: 'toolReport', decision: 'NOT_EVALUATED', outcome: 'REPORTED', reason: 'KeyPolicyDenied',
  phase: 'client-report', evidenceSource: 'client_reported', clientReportedCommand: 'preview_resource_change',
  clientReportedPhase: 'result', clientReportedStatus: 'needs_user', clientReportedReason: 'NEEDS_USER',
  clientReportedReasonDetail: 'BRIDGE_PROJECT_BINDING_REQUIRED'};

test('client report: binding cause is shown separately without becoming a platform authorization decision', () => {
  const value = project(report);
  assert.equal(value.isClientReport, true); assert.equal(value.clientReportedReason, 'NEEDS_USER');
  assert.equal(value.clientReportedReasonLabelKey, 'apiKeyAudit.clientNeedsUser');
  assert.equal(value.clientReportedReasonDetailLabelKey, 'webmcp.bridgeProjectBindingRequired');
  assert.equal(value.reason, 'KeyPolicyDenied'); assert.equal(value.reasonLabelKey, 'apiKeyAudit.reasons.KeyPolicyDenied');
  assert.equal(value.decision, 'NOT_EVALUATED'); assert.equal(value.decisionLabelKey, 'apiKeyAudit.clientNotEvaluated');
  const expectedLabels = {operationLabelKey: 'apiKeyAudit.clientToolReport', phaseLabelKey: 'apiKeyAudit.clientToolReport',
    decisionLabelKey: 'apiKeyAudit.clientNotEvaluated', outcomeLabelKey: 'apiKeyAudit.clientReported', targetLabelKey: 'apiKeyAudit.clientToolEvent'};
  for (const [field, key] of Object.entries(expectedLabels)) {
    assert.equal(value[field], key, 'actual native canonical ' + field + ' has explicit human wording');
    assert.doesNotMatch(value[field], /unknown/);
  }
  assert.equal(value.operation, 'toolReport'); assert.equal(value.phase, 'client-report');
  assert.equal(value.targetType, ''); assert.equal(value.targetId, '', 'no target ID is invented');
  const locales = ['en-us','zh-tw','zh-hans','de-de','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua'];
  const english = YAML.parse(text('translations/en-us.yaml'));
  for (const key of new Set(Object.values(expectedLabels))) {
    const labels = [];
    for (const locale of locales) {
      const doc = YAML.parse(text('translations/' + locale + '.yaml'));
      const label = key.split('.').reduce((row, part) => row && row[part], doc);
      assert.equal(typeof label, 'string'); assert.ok(label.trim().length > 0, locale + ': complete human label');
      if (locale !== 'en-us') assert.notEqual(label, key.split('.').reduce((row, part) => row && row[part], english));
      assert.doesNotMatch(label, /NOT_EVALUATED|REPORTED|toolReport|client-report|apiKeyAudit\.|\{\{/);
      assert.doesNotMatch(label, /<script>/i); labels.push(label);
    }
    assert.equal(new Set(labels).size, 13);
  }
  for (const patch of [{operation: 'PRIVATE'}, {phase: 'PRIVATE'}, {resourceType: 'service'}, {targetType: 'service'}]) {
    const safe = project({...report, ...patch});
    if (patch.operation) assert.equal(safe.operationLabelKey, 'apiKeyAudit.unknownOperation');
    if (patch.phase) assert.equal(safe.phaseLabelKey, 'apiKeyAudit.phases.unknown');
    if (patch.resourceType) assert.equal(safe.targetLabelKey, 'apiKeyAudit.unknownTarget');
    if (patch.targetType) assert.equal(safe.targetLabelKey, 'apiKeyAccess.selector.types.service');
  }
  assert.equal(value.outcome, 'REPORTED'); assert.notEqual(value.outcomeLabelKey, 'apiKeyAudit.completionSucceeded');
  for (const patch of [{evidenceSource: 'server_observed'}, {evidenceSource: undefined}, {decision: 'DENY'}, {decision: 'ALLOW'}, {outcome: 'FAILED'}]) {
    const original = {...report, ...patch}, safe = project(original);
    assert.equal(safe.isClientReport, undefined); assert.equal(safe.clientReportedReason, undefined);
    assert.equal(safe.clientReportedReasonDetailLabelKey, undefined); assert.equal(safe.decision, original.decision);
    assert.equal(safe.reasonLabelKey, 'apiKeyAudit.reasons.KeyPolicyDenied');
    assert.notEqual(safe.decisionLabelKey, 'apiKeyAudit.clientNotEvaluated');
    assert.notEqual(safe.operationLabelKey, 'apiKeyAudit.clientToolReport');
    assert.notEqual(safe.phaseLabelKey, 'apiKeyAudit.clientToolReport');
    assert.notEqual(safe.outcomeLabelKey, 'apiKeyAudit.clientReported');
    assert.notEqual(safe.targetLabelKey, 'apiKeyAudit.clientToolEvent');
  }
});

test('client report: only the fixed report tuple selects the human detail and unknown raw fields never render', () => {
  for (const patch of [{clientReportedReason: 'FORBIDDEN'}, {clientReportedCommand: 'get_resource'}, {clientReportedPhase: 'start'},
    {clientReportedStatus: 'rejected'}, {clientReportedReasonDetail: 'PRIVATE-RAW-OBSERVER'}]) {
    assert.equal(project({...report, ...patch}).clientReportedReasonDetailLabelKey, undefined);
  }
  const safe = project({...report, clientReportedReason: 'PRIVATE-RAW-REASON', clientReportedReasonDetail: 'PRIVATE-RAW-DETAIL',
    requestObject: 'PRIVATE-REQUEST', responseObject: 'PRIVATE-RESPONSE', data: {secret: 'PRIVATE-CONFIG'}});
  assert.equal(safe.clientReportedReason, ''); assert.doesNotMatch(JSON.stringify(safe), /PRIVATE-/);
  const old = project({id: 'old', decision: 'DENY', reason: 'KeyScopeDenied', outcome: 'DENIED'});
  assert.equal(old.decisionLabelKey, 'apiKeyAudit.decisions.DENY'); assert.equal(old.reasonLabelKey, 'apiKeyAudit.reasons.KeyScopeDenied');
});

test('client report: list and detail use escaped fixed labels with thirteen actual translations', () => {
  const locales = ['en-us','zh-tw','zh-hans','de-de','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua'];
  const keys = ['apiKeyAudit.clientReportNotice','apiKeyAudit.clientReportedReason','apiKeyAudit.clientNeedsUser','webmcp.bridgeProjectBindingRequired'];
  const english = YAML.parse(text('translations/en-us.yaml'));
  for (const key of keys) {
    const values = [];
    for (const locale of locales) {
      const doc = YAML.parse(text('translations/' + locale + '.yaml'));
      const value = key.split('.').reduce((row, part) => row && row[part], doc);
      assert.equal(typeof value, 'string'); assert.ok(value.trim().length > 0, locale + ': translated label is not empty');
      if (locale !== 'en-us') assert.notEqual(value, key.split('.').reduce((row, part) => row && row[part], english));
      assert.doesNotMatch(value, /PRIVATE-|BRIDGE_PROJECT|NEEDS_USER|apiKeyAudit\.|<script>|\{\{/i); values.push(value);
    }
    assert.equal(new Set(values).size, 13);
  }
  const template = text('app/components/api-key-audit/template.hbs');
  assert.ok(template.indexOf('data-testid="api-key-audit-client-report"') < template.indexOf('class="text-muted api-key-audit-reason"'));
  assert.ok(template.indexOf('data-testid="api-key-audit-client-reported-detail"') < template.indexOf("<p>{{t 'apiKeyAudit.reason'}}"));
  const ast = preprocess(template);
  const conditions = [], labels = [], rawDetail = [];
  traverse(ast, {
    BlockStatement(node) { if (node.path.original === 'if') conditions.push(node.params[0]?.original); },
    MustacheStatement(node) {
      if (node.path.original === 't' && node.params[0]?.type === 'StringLiteral') labels.push(node.params[0].value);
      if (['record.clientReportedReasonDetail','this.detail.clientReportedReasonDetail'].includes(node.path.original)) rawDetail.push(node);
      if (node.path.original.includes('clientReported')) assert.equal(node.escaped, true);
    },
  });
  assert.ok(conditions.includes('record.isClientReport')); assert.ok(conditions.includes('this.detail.isClientReport'));
  assert.equal(labels.filter(key => key === 'apiKeyAudit.clientReportNotice').length, 2);
  assert.equal(rawDetail.length, 0, 'only a fixed translation key renders the diagnostic detail');
});
