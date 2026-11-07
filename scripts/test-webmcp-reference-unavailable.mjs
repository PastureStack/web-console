import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMMANDS, CommandContext, CommandEngine, PUBLIC_ERROR_CODES} from '../bridge/shared-modules.mjs';

// Load the real browser contract with its one pure dependency, without Ember.
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const registryUrl = dataUrl(readFileSync(new URL('../app/utils/ai-resource-registry.js', import.meta.url), 'utf8'));
const contractSource = readFileSync(new URL('../app/utils/ai-command-contract.js', import.meta.url), 'utf8');
const {publicError, CommandError} = await import(dataUrl(contractSource.replace("from './ai-resource-registry';", `from '${registryUrl}';`)));
const PRIVATE = 'PRIVATE_REFERENCE_TOKEN_VALUE_f7392';
const raw = (status = 422, code = 'InvalidReference') => ({status, body: {code, fieldName: 'serviceId', id: PRIVATE, value: PRIVATE, message: PRIVATE, detail: PRIVATE}});
function guidance(result) {
  assert.equal(result.status, 'rejected'); assert.equal(result.code, 'STALE_REFERENCE'); assert.equal(result.reason, 'REFERENCE_UNAVAILABLE');
  assert.equal(result.field, undefined);
  for (const text of ['find_resources', 'get_resource', 'same Key and environment', 'ask the user', 'Do not guess IDs', 'expand permissions']) assert.ok(result.nextStep.includes(text));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_REFERENCE|serviceId|not found|does not exist|access denied/);
}

test('reference unavailable: exact raw 422 InvalidReference uses the existing stale code and safe reselection guidance', () => {
  guidance(publicError(raw()));
  guidance(publicError({response: {status: 422}, body: {code: 'InvalidReference'}}));
  assert.ok(PUBLIC_ERROR_CODES.includes('STALE_REFERENCE')); assert.equal(COMMANDS.length, 12);
});

test('reference unavailable: status precedence wrong codes and unconfirmed outcomes keep their original classifications', () => {
  for (const [status, code, expected] of [[401,'InvalidReference','SESSION_REQUIRED'],[403,'InvalidReference','FORBIDDEN'],[404,'InvalidReference','FORBIDDEN'],
    [400,'InvalidReference','INVALID_INPUT'],[409,'InvalidReference','CONFLICT'],[500,'InvalidReference','UNKNOWN_RESULT'],[200,'InvalidReference','UNKNOWN_RESULT'],
    [undefined,'InvalidReference','UNKNOWN_RESULT'],[422,'InvalidFormat','INVALID_INPUT'],[422,'invalidReference','INVALID_INPUT'],[422,undefined,'INVALID_INPUT']]) {
    const result = publicError({status, body: {...raw().body, code}}); assert.equal(result.code, expected); assert.equal(result.reason, undefined); assert.equal(result.field, undefined);
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
  }
  const local = new CommandError('INVALID_INPUT', 'parameters.serviceRefs'); local.status=422; local.body={code:'InvalidReference'};
  const result = publicError(local); assert.equal(result.code,'INVALID_INPUT'); assert.equal(result.field,'parameters.serviceRefs'); assert.equal(result.reason,undefined);
});

test('reference unavailable: native field values messages and details are not accessed or copied', () => {
  const body = {code:'InvalidReference'};
  for (const key of ['fieldName','id','value','message','detail']) Object.defineProperty(body,key,{get(){throw Error('must not access '+key);}});
  guidance(publicError({status:422,body}));
});

test('reference unavailable: real MCP preview keeps reselection guidance and its normal audit pair without another business call', async () => {
  for (const status of [422,403,401]) {
    const snapshot={generation:'g',accountId:'a1',projectId:'p1',projectName:'Selected',schemaProjectId:'p1',schemaGeneration:1,route:'/stacks'};
    let sequence=0;const context=new CommandContext(()=>snapshot,()=>String(++sequence));context.setMode('enabled');
    const captured=context.capture(), calls=[], audits=[];
    const parentRef=context.reference('resource',{id:'st1',family:'stack',resourceType:'stack',scope:'project'},captured);
    const serviceRef=context.reference('resource',{id:'s1',family:'service',resourceType:'service',scope:'project'},captured);
    const engine=new CommandEngine({context,ensureSession:async()=>{},audit:async event=>{audits.push(event);return {accepted:true,requestId:'audit'+(++sequence)};},
      request:async request=>{calls.push(request);throw raw(status);}});
    const result=await engine.execute('preview_resource_change',{resourceType:'loadBalancerService',operation:'create',parentRef,
      parameters:{name:'edge',startOnCreate:false,portRules:[{serviceRef,protocol:'tcp',access:'public',sourcePort:8080,targetPort:80}]}});
    if(status===422)guidance(result);else assert.equal(result.code,status===403?'FORBIDDEN':'SESSION_REQUIRED');
    assert.equal(calls.length,1);assert.equal(calls[0].url,'projects/p1/aiResourceChangePlans');assert.equal(calls[0].method,'POST');
    assert.deepEqual(audits.map(event=>event.phase),['start','result']);assert.equal(audits[1].reason,result.code);
    assert.ok(!JSON.stringify(result).includes(PRIVATE));assert.ok(!JSON.stringify(audits).includes(PRIVATE));
  }
});
