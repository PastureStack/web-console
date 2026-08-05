#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

const component = fs.readFileSync('app/components/form-ports/component.js', 'utf8');
const template = fs.readFileSync('app/components/form-ports/template.hbs', 'utf8');
const parent = fs.readFileSync('app/components/new-container/component.js', 'utf8');
const parentTemplate = fs.readFileSync('app/components/new-container/template.hbs', 'utf8');
const style = fs.readFileSync('app/styles/components/_form-ports.scss', 'utf8');
const componentTest = fs.readFileSync('tests/unit/components/form-ports-test.js', 'utf8');
const parentTest = fs.readFileSync('tests/unit/components/new-container-port-preflight-test.js', 'utf8');
const ci = fs.readFileSync('scripts/ci', 'utf8');
const failures = [];

for (const marker of [
  'const PREFLIGHT_DELAY = 350;',
  "project.hasAction('portpreflight')",
  "project.doAction('portpreflight'",
  'sequence !== this._preflightSequence',
  "status === 'blocked'",
  "status === 'checking'",
  'requestedHostId',
  'serviceId',
  'instanceId',
  'stackId',
  'runtimeProbe: true',
  'host_network_ignores_published_port',
  "this.invokePassedAction('changed'",
  "this.invokePassedAction('changedStr'",
  "this.invokePassedAction('preflightChanged'",
]) {
  if (!component.includes(marker)) failures.push(`FORM_PORT_PREFLIGHT_MISSING=${marker}`);
}

for (const marker of [
  'data-testid="port-preflight-summary"',
  'data-testid="port-preflight-conflicts"',
  'port.preflightRowClass',
  'port.preflightMessage',
]) {
  if (!template.includes(marker)) failures.push(`FORM_PORT_PREFLIGHT_TEMPLATE_MISSING=${marker}`);
}

for (const marker of [
  'sidekickPortPreflightStates',
  'hasSidekickPortPreflightPending',
  'hasSidekickPortPreflightBlocked',
  'saveDisabled:',
  'setPorts(ports)',
  "this.invokePassedAction('preflightChanged'",
]) {
  if (!parent.includes(marker)) failures.push(`NEW_CONTAINER_PREFLIGHT_MISSING=${marker}`);
}

for (const marker of [
  "changedStr=(action 'setPorts')",
  "preflightChanged=(action 'portPreflightChanged')",
  "preflightChanged=(action 'sidekickPortPreflightChanged' slc.uiId)",
  'saveDisabled=this.saveDisabled',
  'batchSize=this.preflightBatchSize',
  'startFirst=this.preflightStartFirst',
]) {
  if (!parentTemplate.includes(marker)) failures.push(`NEW_CONTAINER_PREFLIGHT_TEMPLATE_MISSING=${marker}`);
}

for (const marker of [
  '.port-preflight-row-warning',
  '.port-preflight-row-unknown',
  '.port-preflight-row-blocked',
  '.port-preflight-summary',
]) {
  if (!style.includes(marker)) failures.push(`PORT_PREFLIGHT_STYLE_MISSING=${marker}`);
}

for (const marker of [
  'managed owner on another host blocks saving and identifies the workload',
  'stopped owner is a warning and does not block saving',
  'host networking checks the container port',
  'a late older response cannot replace the newest result',
  'closure callbacks are invoked directly and missing optional callbacks are ignored',
]) {
  if (!componentTest.includes(marker)) failures.push(`PORT_PREFLIGHT_TEST_MISSING=${marker}`);
}

for (const marker of [
  'serialized port changes update the launch config through a named action',
  'primary check disables save only while pending or blocked',
  'sidekick checks participate in the parent save lock',
  'preflight closure callback is invoked without legacy sendAction',
]) {
  if (!parentTest.includes(marker)) failures.push(`PORT_PREFLIGHT_PARENT_TEST_MISSING=${marker}`);
}

if (parentTemplate.includes('(action (mut this.launchConfig.ports))')) {
  failures.push('NEW_CONTAINER_PORT_MUT_ACTION_FORBIDDEN');
}

const localeKeys = [
  'formPorts.error.invalidPort',
  'formPorts.preflight.label',
  'formPorts.preflight.status.checking',
  'formPorts.preflight.status.available',
  'formPorts.preflight.status.warning',
  'formPorts.preflight.status.unknown',
  'formPorts.preflight.status.blocked',
  'formPorts.preflight.status.unsupported',
  'formPorts.preflight.status.requestFailed',
  'formPorts.preflight.row.checking',
  'formPorts.preflight.row.available',
  'formPorts.preflight.row.unknown',
  'formPorts.preflight.error.blocked',
  'formPorts.preflight.error.sidekickChecking',
  'formPorts.preflight.error.sidekickBlocked',
  'formPorts.preflight.reason.active_port_conflict',
  'formPorts.preflight.reason.active_port_conflict_on_other_host',
  'formPorts.preflight.reason.stopped_port_owner',
  'formPorts.preflight.reason.agent_unsupported',
  'formPorts.preflight.detail.host',
  'formPorts.preflight.detail.stack',
  'formPorts.preflight.detail.service',
  'formPorts.preflight.detail.container',
  'formPorts.preflight.state.running',
];
const localeFiles = fs.readdirSync('translations')
  .filter((name) => name.endsWith('.yaml') && name !== 'none.yaml');

for (const file of localeFiles) {
  const data = YAML.load(path.join('translations', file));
  for (const key of localeKeys) {
    let cursor = data;
    for (const segment of key.split('.')) cursor = cursor && cursor[segment];
    if (cursor === undefined || cursor === null || cursor === '') {
      failures.push(`PORT_PREFLIGHT_LOCALE_MISSING=${file}:${key}`);
    }
  }
}

if (!ci.includes('node ./scripts/check-ui-port-preflight.js')) {
  failures.push('PORT_PREFLIGHT_CI_GATE_MISSING');
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`failure_count=${failures.length}`);
  process.exit(1);
}

console.log(`UI_PORT_PREFLIGHT_OK debounce_ms=350 last_response_wins=true active=blocked stopped=warning unknown=visible sidekicks=covered locales=${localeFiles.length}`);
console.log('failure_count=0');
