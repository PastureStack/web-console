'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

function fail(message) {
  throw new Error(`service-log-filter-contract: ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) {
    fail(`${label} is missing ${text}`);
  }
}

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current && current[key], value);
}

const route = read('app/service/log/route.js');
const controller = read('app/service/log/controller.js');
const template = read('app/service/log/template.hbs');

[
  'filter      : { serviceId }',
  'created_gte',
  'created_lte',
  'filter.level',
  'filter.instanceId',
  "params.logScope === 'root'",
  "params.logScope === 'sub'",
  "addTextFilter(query.filter, 'eventType'",
  "addTextFilter(query.filter, 'description'",
  'pollGeneration',
  'forceReload : true',
].forEach((text) => requireText(route, text, 'route'));

if (/params\.serviceId/.test(route)) {
  fail('route must not accept a query-supplied service authority');
}

[
  'instanceOptions',
  "instance.get('displayName') || instance.get('name')",
  "'service.instance.restart'",
  'timeRangeInvalid',
  'refreshIfUnchanged',
].forEach((text) => requireText(controller, text, 'controller'));

[
  'data-testid="service-log-filter-panel"',
  'data-testid="service-log-time-dialog"',
  "servicePage.logTab.table.header.date",
  "servicePage.logTab.table.header.level",
  "servicePage.logTab.table.header.event",
  "servicePage.logTab.table.header.description",
  '{{action-menu model=obj}}',
].forEach((text) => requireText(template, text, 'template'));

const requiredLocaleKeys = [
  'title', 'help', 'activeCount', 'timeRange', 'allTime', 'allTimeHelp',
  'level', 'allLevels', 'container', 'allContainers', 'containerHelp', 'scope',
  'levels.info', 'levels.warn', 'levels.error',
  'scopes.all', 'scopes.root', 'scopes.sub',
  'conditions.eventType', 'conditions.description',
  'placeholders.eventType', 'placeholders.description',
  'addCondition', 'removeCondition', 'matchAll', 'clear', 'apply', 'rangeError',
  'shortcuts.title', 'shortcuts.recent', 'shortcuts.restarts', 'shortcuts.errors',
  'results.updating', 'results.summary',
];

const localeFiles = fs.readdirSync('translations')
  .filter((name) => name.endsWith('.yaml') && name !== 'none.yaml');

localeFiles.forEach((file) => {
  const data = YAML.load(path.join('translations', file));
  const root = getPath(data, 'servicePage.logTab.filter');

  if (!root) {
    fail(`${file} has no service log filter translations`);
  }
  requiredLocaleKeys.forEach((key) => {
    const value = getPath(root, key);

    if (typeof value !== 'string' || !value.trim()) {
      fail(`${file} has an empty servicePage.logTab.filter.${key}`);
    }
  });
});

const backendRoot = path.resolve('..', 'orchestration-engine');
const restartListener = fs.readFileSync(path.join(backendRoot,
  'code/iaas/service-discovery/server/src/main/java/io/cattle/platform/servicediscovery/process/ServiceInstanceRestartLogPreListener.java'), 'utf8');
const activityService = fs.readFileSync(path.join(backendRoot,
  'code/implementation/activity-log/src/main/java/io/cattle/platform/activity/ActivityService.java'), 'utf8');

requireText(restartListener, 'InstanceConstants.PROCESS_RESTART', 'restart listener');
requireText(restartListener, 'findServicesForInstanceId', 'restart listener');
requireText(restartListener, 'activityService.instance', 'restart listener');
requireText(activityService, 'service.instance.', 'activity service');
requireText(activityService, 'setInstanceId', 'activity service');

console.log(`SERVICE_LOG_FILTER_CONTRACT_OK locales=${localeFiles.length} fixedService=true restartEvent=true`);
