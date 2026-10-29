import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yamljs';
import {preprocess} from '@glimmer/syntax';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'app/utils/ai-resource-review-labels.js'), 'utf8');
const {resourceReviewLabels} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const locales = ['en-us','zh-tw','zh-hans','de-de','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua'];

test('resource review renders friendly type action fields and exact values in all thirteen locales', async () => {
  const english = YAML.load(path.join(root, 'translations/en-us.yaml')).webmcp;
  for (const locale of locales) {
    const translations = YAML.load(path.join(root, 'translations', locale + '.yaml'));
    const t = key => {
      const value = key.split('.').reduce((result, part) => result && result[part], translations);
      assert.equal(typeof value, 'string', locale + ': ' + key); assert.ok(value.length, key); return value;
    };
    const command = JSON.stringify(['sh', '-c', 'echo "<script>fixture</script>"; sleep 600']);
    const plan = {resourceType:'container', operation:'create', displayDiff:[
      {field:'name',before:null,after:'own-fixture'}, {field:'description',before:null,after:''},
      {field:'command',before:null,after:command}, {field:'entryPoint',before:null,after:'[]'},
      {field:'startOnCreate',before:null,after:false}, {field:'affectedServiceCount',before:3,after:3}, {field:'emptyStack',before:false,after:false},
    ]};
    const result = resourceReviewLabels(plan, t);
    const heading = t('webmcp.resourceChangeTitle').replace('{operation}', result.operationLabel).replace('{resource}', result.resourceTypeLabel);
    assert.ok(!heading.includes('{operation}') && !heading.includes('{resource}'));
    assert.equal(result.resourceTypeLabel,t('apiKeyAccess.selector.types.container'));
    assert.equal(result.operationLabel,t('saveCancel.create'));
    assert.equal(result.displayChanges.find(change=>change.field==='startOnCreate').fieldLabel,t('webmcp.startOnCreate'));
    assert.equal(result.displayChanges.find(change=>change.field==='startOnCreate').after,t('generic.noo'));
    assert.equal(result.displayChanges.find(change=>change.field==='affectedServiceCount').fieldLabel,t('webmcp.affectedServiceCount'));
    assert.equal(result.displayChanges.find(change=>change.field==='affectedServiceCount').informational,true);
    const description=result.displayChanges.find(change=>change.field==='description');
    assert.equal(description.before,t('webmcp.nullValue')); assert.equal(description.after,t('webmcp.emptyValue')); assert.notEqual(description.before,description.after);
    assert.equal(result.displayChanges.find(change=>change.field==='command').after,command);
    assert.equal(result.createsStopped,true); assert.ok(t('webmcp.createStoppedNotice'));
    for(const operation of ['start','stop','restart','remove','scale','update_metadata']) {
      const labels=resourceReviewLabels({...plan,operation},t); assert.ok(labels.operationLabel); assert.equal(labels.createsStopped,false);
    }
    if(locale!=='en-us')for(const key of ['resourceChangeTitle','startOnCreate','affectedServiceCount','emptyStack','nullValue','emptyValue','createStoppedNotice','childServiceState','affectedInstanceCount','affectedMountCount','removedState','mixedState','domainRetentionNotice','cancelPlan','cancelPlanPrompt','cannotCancel','planCancelled','cancelFailed'])assert.notEqual(t('webmcp.'+key),english[key],locale+': translated '+key);
    const state=resourceReviewLabels({resourceType:'stack',operation:'stop',displayDiff:[{field:'childServiceState',before:'mixed',after:'inactive'}]},t);
    assert.equal(state.displayChanges[0].before,t('webmcp.mixedState'));assert.equal(state.displayChanges[0].after,t('formPorts.preflight.state.inactive'));
    const restart=resourceReviewLabels({resourceType:'container',operation:'restart',displayDiff:[{field:'operation',before:null,after:'restart'}]},t);
    assert.equal(restart.displayChanges[0].after,t('action.restart'));
    const removal=resourceReviewLabels({resourceType:'stack',operation:'remove',displayDiff:[
      {field:'affectedServiceCount',before:3,after:0},{field:'affectedInstanceCount',before:6,after:0},{field:'affectedMountCount',before:4,after:null},
      {field:'mountedDataRule',before:null,after:'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'}]},t);
    assert.equal(removal.displayChanges[0].after,'3');assert.equal(removal.displayChanges[1].after,'6');assert.equal(removal.displayChanges[2].after,'4');
    assert.equal(removal.mountedDataNotice,t('webmcp.domainRetentionNotice'));
    assert.ok(!JSON.stringify(removal).includes('EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'));
  }
});

test('resource review templates use the friendly renderer and escape complete programs with bounded scrolling', async () => {
  const template=await readFile(path.join(root,'app/components/modal-confirm-ai-upgrade/template.hbs'),'utf8');
  preprocess(template);
  assert.ok(template.includes('operation=this.reviewLabels.operationLabel resource=this.reviewLabels.resourceTypeLabel'));
  assert.ok(template.includes('{{change.fieldLabel}}')); assert.ok(!template.includes('{{change.field}}'));
  assert.ok(!template.includes('{{this.plan.operation}}')); assert.ok(!template.includes('{{this.plan.resourceType}}'));
  assert.ok(template.includes('ai-resource-create-stopped'));assert.ok(!template.includes('{{{'));
  assert.ok(template.includes('ai-resource-mounted-data-notice'));
  assert.ok(template.includes('{{change.after}}</pre>'));
  const style=await readFile(path.join(root,'app/styles/components/_modals.scss'),'utf8');
  assert.match(style,/\.ai-resource-diff-value\s*\{[^}]*white-space: pre-wrap;[^}]*overflow-wrap: anywhere;[^}]*max-height: 18rem;[^}]*overflow: auto;/);
  const inbox=await readFile(path.join(root,'app/components/modal-ai-collaboration/template.hbs'),'utf8');preprocess(inbox);
  assert.ok(inbox.includes('{{plan.resourceTypeLabel}}'));assert.ok(inbox.includes('{{plan.operationLabel}}'));
});
