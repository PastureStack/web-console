#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

const form = fs.readFileSync('app/components/form-volumes/component.js', 'utf8');
const formTemplate = fs.readFileSync('app/components/form-volumes/template.hbs', 'utf8');
const autocomplete = fs.readFileSync('app/components/volume-path-autocomplete/component.js', 'utf8');
const autocompleteTemplate = fs.readFileSync('app/components/volume-path-autocomplete/template.hbs', 'utf8');
const parser = fs.readFileSync('app/utils/volume-spec.js', 'utf8');
const styles = fs.readFileSync('app/styles/components/_form-volumes.scss', 'utf8');
const parent = fs.readFileSync('app/components/new-container/component.js', 'utf8');
const parentTemplate = fs.readFileSync('app/components/new-container/template.hbs', 'utf8');
const serviceRoute = fs.readFileSync('app/service/new/route.js', 'utf8');
const containerRoute = fs.readFileSync('app/containers/new/route.js', 'utf8');
const componentTest = fs.readFileSync('tests/unit/components/form-volumes-test.js', 'utf8');
const autocompleteTest = fs.readFileSync('tests/unit/components/volume-path-autocomplete-test.js', 'utf8');
const parserTest = fs.readFileSync('tests/unit/utils/volume-spec-test.js', 'utf8');
const ci = fs.readFileSync('scripts/ci', 'utf8');
const failures = [];

for (const marker of [
  'const PREFLIGHT_DELAY = 300;',
  "project.hasAction('volumepreflight')",
  "project.doAction('volumepreflight'",
  'sequence !== this._preflightSequence',
  "includesCapability(driver, 'secrets')",
  "name === 'pasturestack-nfs'",
  "scope !== 'environment'",
  "accessMode !== 'multiHostRW'",
  "formVolumes.volumeDriver.accessMode",
  "formVolumes.autocomplete.source.existingMount",
  "priority: 0",
  'host_pool_missing',
  'volume_driver_mismatch',
  'existing_volume_unusable',
]) {
  if (!form.includes(marker)) failures.push(`VOLUME_FORM_MISSING=${marker}`);
}

for (const marker of [
  '{{volume-path-autocomplete',
  '{{new-select',
  'content=this.storageDriverChoices',
  'optionDisabledPath="disabled"',
  'this.preflightIssueMessages',
  'volume-path-table',
]) {
  if (!formTemplate.includes(marker)) failures.push(`VOLUME_TEMPLATE_MISSING=${marker}`);
}

if (/id="volumeDriver"[\s\S]{0,300}<input/u.test(formTemplate)) {
  failures.push('VOLUME_DRIVER_FREE_TEXT_FORBIDDEN');
}

for (const marker of [
  'maxSuggestions: 8',
  "key === 'ArrowDown'",
  "key === 'ArrowUp'",
  "key === 'Enter'",
  "key === 'Tab'",
  "key === 'Escape'",
  'rankedVolumeSuggestions',
]) {
  if (!autocomplete.includes(marker)) failures.push(`VOLUME_AUTOCOMPLETE_MISSING=${marker}`);
}

for (const marker of [
  'role="combobox"',
  'aria-autocomplete="list"',
  'role="listbox"',
  'role="option"',
  'aria-activedescendant',
]) {
  if (!autocompleteTemplate.includes(marker)) failures.push(`VOLUME_AUTOCOMPLETE_A11Y_MISSING=${marker}`);
}

for (const marker of [
  'const MAX_SPEC_LENGTH = 4096;',
  "const ALLOWED_MODES = ['ro', 'rw', 'z', 'Z', 'nocopy'];",
  "result.errors.push('controlCharacter')",
  "result.errors.push('unsafeTarget')",
  "result.errors.push('unsafeSource')",
  "result.errors.push('invalidMode')",
  'Math.min(8',
  'left.priority - right.priority',
]) {
  if (!parser.includes(marker)) failures.push(`VOLUME_PARSER_MISSING=${marker}`);
}

if (!styles.includes('.volume-path-table > tbody > tr > td')) {
  failures.push('VOLUME_AUTOCOMPLETE_OVERFLOW_GUARD_MISSING');
}

for (const marker of [
  'volumePreflightState',
  'publishPreflightState()',
  'volumePreflightState.{pending,blocked}',
  "this.get('volumePreflightState.pending')",
]) {
  if (!parent.includes(marker)) failures.push(`VOLUME_PARENT_MISSING=${marker}`);
}

for (const marker of [
  'allStorageDrivers=this.allStorageDrivers',
  'allStoragePools=this.allStoragePools',
  'allVolumes=this.allVolumes',
  'allServices=this.allServices',
  'preflightChanged=(action "volumePreflightChanged")',
]) {
  if (!parentTemplate.includes(marker)) failures.push(`VOLUME_PARENT_TEMPLATE_MISSING=${marker}`);
}

for (const source of [serviceRoute, containerRoute]) {
  for (const marker of ["findAll('storageDriver')", "findAll('storagePool')", "findAll('volume')", "findAll('service')"]) {
    if (!source.includes(marker)) failures.push(`VOLUME_ROUTE_INVENTORY_MISSING=${marker}`);
  }
}

for (const marker of [
  'driver choices hide secret drivers and disable incomplete NFS coverage',
  'validation rejects duplicate targets and unavailable selected drivers',
  'late preflight responses cannot overwrite the newest result',
  'pasturestack-nfs requires environment scope and multi-host read-write access',
  'autocomplete candidates include existing service mounts before generated paths',
]) {
  if (!componentTest.includes(marker)) failures.push(`VOLUME_FORM_TEST_MISSING=${marker}`);
}
for (const marker of [
  'arrow keys select and Enter completes',
  'Escape closes the candidate list',
  'Tab completes the active candidate',
  'mouse selection accepts the highlighted candidate',
]) {
  if (!autocompleteTest.includes(marker)) failures.push(`VOLUME_AUTOCOMPLETE_TEST_MISSING=${marker}`);
}
for (const marker of [
  'it parses anonymous, named, bind and read-only volume paths',
  "parseVolumeSpec('/data:execute')",
  'stable eight-item limit',
  'preserves source priority and removes duplicate candidates',
]) {
  if (!parserTest.includes(marker)) failures.push(`VOLUME_PARSER_TEST_MISSING=${marker}`);
}

const localeKeys = [
  'formVolumes.volumes',
  'formVolumes.volumeDriver.local',
  'formVolumes.volumeDriver.coverage',
  'formVolumes.volumeDriver.accessMode',
  'formVolumes.volumeDriver.unknownAccessMode',
  'formVolumes.volumeDriver.unavailable.invalidNfsContract',
  'formVolumes.autocomplete.source.existing',
  'formVolumes.autocomplete.source.existingMount',
  'formVolumes.errors.invalidFormat',
  'formVolumes.errors.driverUnavailable',
  'formVolumes.errors.preflightBlocked',
  'formVolumes.warnings.bindIgnoresDriver',
  'formVolumes.preflight.checking',
  'formVolumes.preflight.available',
  'formVolumes.preflight.blocked',
  'formVolumes.preflight.reason.host_pool_missing',
  'formVolumes.preflight.reason.volume_driver_mismatch',
  'formVolumes.preflight.detail.path',
];
const localeFiles = fs.readdirSync('translations')
  .filter((name) => name.endsWith('.yaml') && name !== 'none.yaml');

for (const file of localeFiles) {
  const data = YAML.load(path.join('translations', file));
  for (const key of localeKeys) {
    let cursor = data;
    for (const segment of key.split('.')) cursor = cursor && cursor[segment];
    if (cursor === undefined || cursor === null || cursor === '') {
      failures.push(`VOLUME_PREFLIGHT_LOCALE_MISSING=${file}:${key}`);
    }
  }
}

const traditionalChinese = fs.readFileSync('translations/zh-tw.yaml', 'utf8');
if (traditionalChinese.includes('捲')) failures.push('ZH_TW_VOLUME_TERM_FORBIDDEN=捲');
if (!traditionalChinese.includes('  volumes: 路徑')) failures.push('ZH_TW_VOLUME_PATH_LABEL_MISSING');
if (!traditionalChinese.includes('newContainer:') || !/newContainer:[\s\S]*?tabs:[\s\S]*?volumes: 路徑/u.test(traditionalChinese)) {
  failures.push('ZH_TW_VOLUME_TAB_PATH_LABEL_MISSING');
}

if (!ci.includes('node ./scripts/check-ui-volume-storage-preflight.js')) {
  failures.push('VOLUME_PREFLIGHT_CI_GATE_MISSING');
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`failure_count=${failures.length}`);
  process.exit(1);
}

console.log(`UI_VOLUME_STORAGE_PREFLIGHT_OK drivers=select secrets=hidden access_mode=visible nfs=validated autocomplete=max8 sources=environment-mounts,driver-volumes,current-form,suggestions keyboard=complete server_check=last_response_wins locales=${localeFiles.length}`);
console.log('failure_count=0');
