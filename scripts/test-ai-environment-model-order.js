'use strict';
// Real model -> PromiseToCb -> async.auto -> selectDefault/setCurrent/schema.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const root=path.resolve(option('source-root')||path.join(__dirname,'..'));
const base=option('base-root');
global.async=require(require.resolve('async',{paths:[option('dependency-root')||root]}));
for(const name of ['property','observes'])if(!Function.prototype[name])Object.defineProperty(Function.prototype,name,{value(){return this;}});
const urls=new Map();
function sourceUrl(relative){
  if(urls.has(relative))return urls.get(relative);
  const primary=path.join(root,relative),file=fs.existsSync(primary)?primary:path.join(base,relative);
  let source=fs.readFileSync(file,'utf8');
  source=source.replace(/import Service, \{ service \} from '@ember\/service';/g,'const Service={extend:(...values)=>Object.assign({},...values)};const service=()=>null;')
    .replace(/import \{ service \} from '@ember\/service';/g,'const service=()=>null;')
    .replace(/import Route from '@ember\/routing\/route';/g,'const Route={extend:(...values)=>Object.assign({},...values)};')
    .replace(/import Mixin from '@ember\/object\/mixin';/g,'const Mixin={create:value=>value};')
    .replace(/import EmberObject from '@ember\/object';/g,'const EmberObject={create:value=>value,extend:(...values)=>Object.assign({},...values)};')
    .replace(/import \$ from 'jquery';/g,'const $=()=>{};')
    .replace(/import \{ later, scheduleOnce, cancel \} from '@ember\/runloop';/g,'const later=()=>{};const scheduleOnce=()=>{};const cancel=()=>{};')
    .replace(/import \{ once \} from '@ember\/runloop';/g,'const once=()=>{};')
    .replace(/import \{ reject, Promise, resolve \} from 'rsvp';/g,'const reject=Promise.reject.bind(Promise),resolve=Promise.resolve.bind(Promise);')
    .replace(/import \{ reject, resolve, all \} from 'rsvp';/g,'const reject=Promise.reject.bind(Promise),resolve=Promise.resolve.bind(Promise),all=Promise.all.bind(Promise);')
    .replace(/import \{ resolve \} from 'rsvp';/g,'const resolve=Promise.resolve.bind(Promise);')
    .replace(/import \{ schedule, once \} from '@ember\/runloop';/g,'const schedule=()=>{};const once=()=>{};')
    .replace(/import \{ bind, cancel, later \} from '@ember\/runloop';/g,'const bind=(object,method)=>method.bind(object);const cancel=()=>{};const later=()=>{};')
    .replace(/import Evented from '@ember\/object\/evented';/g,'const Evented={};')
    .replace(/import \{ get \} from '@ember\/object';/g,'const get=(object,key)=>object.get(key);')
    .replace(/import \{ isSafari \} from 'ui\/utils\/platform';/g,'const isSafari=false;')
    .replace(/import Util from 'ui\/utils\/util';/g,'const Util={};')
    .replace(/import \{ xhrConcur \} from 'ui\/utils\/platform';/g,'const xhrConcur=8;')
    .replace(/import Errors from 'ui\/utils\/errors';/g,'const Errors={status:error=>error.status};')
    .replace(/from '(ui\/[^']+|\.\.?\/[^']+)'/g,(_match,specifier)=>{
      let target=specifier.startsWith('ui/')?'app/'+specifier.slice(3):path.posix.join(path.posix.dirname(relative),specifier);
      if(!target.endsWith('.js'))target+='.js';return 'from '+JSON.stringify(sourceUrl(target));
    });
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');urls.set(relative,url);return url;
}
const get=function(key){return key.split('.').reduce((value,part)=>value&&value[part],this);};
const set=function(key,value){const parts=key.split('.'),last=parts.pop();let target=this;for(const part of parts)target=target[part]||(target[part]={});target[last]=value;return value;};
const row=values=>({...values,get,set});
const gate=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
async function main(){
  const {default:routeOwner}=await import(sourceUrl('app/authenticated/route.js'));
  const {default:projectsOwner}=await import(sourceUrl('app/services/projects.js'));
  const {default:socketOwner}=await import(sourceUrl('app/utils/socket.js'));
  function fixture(){
    const state={generation:'g1',actor:'actor-one',cookie:'token-one',defaultId:null,defaultWrites:[],schemas:[],loadingErrors:0,aborted:[],resets:0,transitions:[],actionFinishes:[],oldReady:gate(),oldRead:gate()};
    const records={p0:row({id:'p0',uuid:'zero',name:'zero',state:'active',kind:'project'}),p1:row({id:'p1',uuid:'one',name:'one',state:'active',kind:'project'}),p2:row({id:'p2',uuid:'two',name:'two',state:'active',kind:'project'})};
    const auth={get,accountId:state.actor,tokenSnapshot:state.cookie,capture:()=>state.generation,
      readShared:()=>({generation:state.generation,accountId:state.actor}),runPassiveSynchronous:async callback=>{const result=callback();assert.equal(Boolean(result&&result.then),false);return result;}};
    const prefs={get:()=>state.defaultId,set:(_key,value)=>{state.defaultId=value;state.defaultWrites.push(value);}};
    const projects=Object.assign({},projectsOwner,{get,set,incrementProperty(key){return ++this[key];},schemaLoadGeneration:1,schemaProjectId:'p0',
      current:records.p0,active:{firstObject:records.p0},access:{admin:false},prefs,app:{apiEndpoint:'/v2-beta'},store:{},
      'tab-session':{get:()=>state.tabProject,set:(_key,value)=>{state.tabProject=value;}}});
    projects._activeProjectFromId=async id=>{if(id==='p1'&&!state.releaseOld){state.oldReady.resolve();await state.oldRead.promise;}
      if(state.selectionError)throw {status:500};if(!records[id])throw {status:404};return records[id];};
    const transition=id=>({authGeneration:state.generation,params:{'authenticated.project':{project_id:id}},isAborted:false,
      abort(){this.isAborted=true;state.aborted.push(id);return this;}});
    const route=Object.assign({},routeOwner,{get,set(key,value){if(key.startsWith('tab-session.')){state.tabProject=value;return value;}return set.call(this,key,value);},projects,prefs,authSession:auth,cookies:{get:()=>state.cookie},
      access:{enabled:true,admin:false,authSession:auth,cookies:{get:()=>state.cookie},captureGeneration:()=>state.generation},session:{set(){}},
      storeReset:{reset(){}},intermediateTransitionTo(){},disconnectSubscribe:callback=>callback(),
      store:{resetType(){state.resets++;},rawRequest:async()=>{const id=projects.current.id;if(state.schemaGate){state.schemaReady.resolve();await state.schemaGate.promise;}return {body:{data:[{id}]}};},_bulkAdd:(_type,rows)=>state.schemas.push(rows[0].id)},
      loadingError(error){state.loadingErrors++;return Promise.reject(error);},
      cbFind:()=>((_results,callback)=>{if(typeof _results==='function')callback=_results;callback(null,[]);}),
      cbFindProject:()=>((_results,callback)=>{if(typeof _results==='function')callback=_results;callback(null,[]);}),
    });
    for(const name of ['loadUserSchemas','loadProjects','loadPreferences','loadPublicSettings','loadRegions','loadCatalogs','updateOrchestration','loadSecrets'])route[name]=async()=>[];
    route.refresh=()=>{const next=transition(state.tabProject);const promise=Promise.resolve().then(()=>route.model({},next));
      next.then=promise.then.bind(promise);next.catch=promise.catch.bind(promise);state.transitions.push(next);return next;};
    const assertSession=()=>{assert.equal(state.generation,'g1');assert.equal(state.actor,'actor-one');assert.equal(state.cookie,'token-one');};
    const commit=callback=>auth.runPassiveSynchronous(()=>{assertSession();callback();});
    return {state,records,projects,route,transition,auth,assertSession,commit};
  }
  const cases=[];
  if(!process.argv.includes('--only-new')){
  for(const aborted of [false,true]){
    const f=fixture(),old=f.transition('p1');
    const oldWork=f.route.model({},old).then(()=>null,error=>error);await f.state.oldReady.promise;
    await f.route.switchProjectExact(f.records.p2,f.assertSession,f.commit,f.assertSession);
    assert.equal(f.projects.current.id,'p2');assert.equal(f.state.tabProject,'p2');assert.equal(f.state.defaultId,null);
    if(aborted)old.abort();f.state.releaseOld=true;f.state.oldRead.resolve();await oldWork;
    const stale=f.projects.current.id!=='p2'||f.state.tabProject!=='p2'||f.state.defaultId!==null||f.state.schemas.at(-1)!=='p2';
    cases.push({name:aborted?'ordinary-aborted-callback-after-new-AI':'ordinary-callback-after-new-AI',staleCommitted:stale,
      current:f.projects.current.id,tab:f.state.tabProject,default:f.state.defaultId,schemas:f.state.schemas,loadingErrors:f.state.loadingErrors});
    if(process.argv.includes('--expect-stale-commit'))assert.equal(stale,true,'Reproduce the original gap before changing source');
    else {assert.equal(stale,false);assert.equal(f.state.loadingErrors,0);}
  }
  if(!process.argv.includes('--expect-stale-commit')){
    for(const change of ['actor','token','aborted']){
      const f=fixture(),old=f.transition('p1');const work=Promise.resolve().then(()=>f.route.model({},old)).then(()=>null,error=>error);
      await f.state.oldReady.promise;
      if(change==='actor'){f.state.actor='new-actor';f.auth.accountId='new-actor';}
      if(change==='token'){f.state.cookie='new-token';f.auth.tokenSnapshot='new-token';}
      if(change==='aborted')old.abort();
      f.state.releaseOld=true;f.state.oldRead.resolve();assert.ok(await work);
      assert.equal(f.projects.current.id,'p0');assert.equal(f.state.defaultId,null);assert.equal(f.state.schemas.length,0);assert.equal(f.state.loadingErrors,0);
      cases.push({name:'ordinary-same-generation-'+change,status:'REJECTED_WITHOUT_COMMIT'});
    }
    for(const change of ['actor','token']){
      const f=fixture();f.state.releaseOld=true;f.state.schemaReady=gate();f.state.schemaGate=gate();
      const work=f.route.model({},f.transition('p1')).then(()=>null,error=>error);await f.state.schemaReady.promise;
      const schemaGeneration=f.projects.schemaLoadGeneration;
      if(change==='actor'){f.state.actor='new-actor';f.auth.accountId='new-actor';}
      else{f.state.cookie='new-token';f.auth.tokenSnapshot='new-token';}
      f.state.schemaGate.resolve();assert.ok(await work);assert.equal(f.projects.current.id,'p1');
      assert.equal(f.projects.schemaLoadGeneration,schemaGeneration);assert.equal(f.state.schemas.length,0);assert.equal(f.state.loadingErrors,0);
      cases.push({name:'ordinary-schema-same-project-generation-new-'+change,status:'REJECTED_WITHOUT_SCHEMA_COMMIT'});
    }
    const ordinaryOrder=fixture();const ordinaryOld=ordinaryOrder.route.model({},ordinaryOrder.transition('p1')).catch(error=>error);
    await ordinaryOrder.state.oldReady.promise;await ordinaryOrder.route.model({},ordinaryOrder.transition('p2'));
    ordinaryOrder.state.releaseOld=true;ordinaryOrder.state.oldRead.resolve();await ordinaryOld;
    assert.equal(ordinaryOrder.projects.current.id,'p2');assert.equal(ordinaryOrder.state.defaultId,'p2');assert.deepEqual(ordinaryOrder.state.schemas,['p2']);
    cases.push({name:'old-ordinary-after-new-ordinary',status:'REJECTED_WITHOUT_OLD_COMMIT'});
    for(const mode of ['authenticated','no-auth','fallback']){
      const f=fixture();if(mode==='no-auth'){f.route.access.enabled=false;f.route.authSession=null;}
      await f.route.model({},f.transition(mode==='fallback'?'missing':'p2'));
      const expected=mode==='fallback'?'p0':'p2';assert.equal(f.projects.current.id,expected);assert.equal(f.state.tabProject,expected);
      assert.equal(f.state.defaultId,expected);assert.equal(f.state.schemas.at(-1),expected);
      cases.push({name:'ordinary-'+mode+'-default-behavior',status:'PASS'});
    }
    const failure=fixture();failure.state.selectionError=true;
    await assert.rejects(()=>failure.route.model({},failure.transition('p2')));assert.equal(failure.state.loadingErrors,1);
    cases.push({name:'current-ordinary-native-error-keeps-normal-loadingError',status:'PASS'});
  }
  }
  const expectEntry=process.argv.includes('--expect-stale-entry');
  const late=fixture();late.state.releaseOld=true;const schemaReady=gate(),start=gate();let first=true;
  const nativeSchema=late.route.loadProjectSchemas;
  late.route.loadProjectSchemas=async function(...args){if(first){first=false;schemaReady.resolve();await start.promise;}return nativeSchema.apply(this,args);};
  const oldSchema=late.route.model({},late.transition('p1')).catch(error=>error);await schemaReady.promise;
  await late.route.switchProjectExact(late.records.p2,late.assertSession,late.commit,late.assertSession);
  const before={generation:late.projects.schemaLoadGeneration,project:late.projects.schemaProjectId,resets:late.state.resets};
  start.resolve();await oldSchema;
  const after={generation:late.projects.schemaLoadGeneration,project:late.projects.schemaProjectId,resets:late.state.resets};
  const staleSchema=JSON.stringify(before)!==JSON.stringify(after);assert.equal(staleSchema,expectEntry);
  cases.push({name:'stale-schema-task-late-start-before-any-clear',staleSchema,before,after});
  function connected(f){
    const callbacks=[];callbacks.pushObject=value=>callbacks.push(value);callbacks.popObject=()=>callbacks.pop();callbacks.get=key=>callbacks[key];
    const raw={__sockId:1,close(){f.state.closeRequested=true;}};
    const socket=Object.assign({},socketOwner,{get,set,setProperties(values){Object.assign(this,values);},trigger(){},
      _state:'connected',_socket:raw,_disconnectCbs:callbacks,autoReconnect:false,url:'ws://example.invalid',_disconnectedAt:null});
    f.route.subscribeSocket=socket;f.route.disconnectSubscribe=routeOwner.disconnectSubscribe;
    f.route.send=(name,...args)=>{if(name==='finishSwitchProject')f.state.actionFinishes.push(args[0]);return f.route.actions[name].call(f.route,...args);};
    return {close:()=>socket._closed({target:raw}),callbacks};
  }
  const switching=fixture();switching.state.releaseOld=true;const socket=connected(switching);
  const firstSwitch=switching.route.actions.switchProject.call(switching.route,'p1',true);
  const newerSwitch=switching.route.actions.switchProject.call(switching.route,'p2',true);
  assert.equal(switching.state.closeRequested,true);assert.equal(socket.callbacks.length,2);assert.equal(switching.state.actionFinishes.length,0);
  socket.close();await Promise.all([firstSwitch,newerSwitch]);await Promise.all(switching.state.transitions.map(item=>Promise.resolve(item).catch(error=>error)));
  const staleSwitch=switching.projects.current.id!=='p2';assert.equal(staleSwitch,expectEntry);
  cases.push({name:'real-socket-delayed-close-old-ordinary-intent-after-newer-intent',staleSwitch,finishes:switching.state.actionFinishes,current:switching.projects.current.id});
  if(!expectEntry){
    const ai=fixture();ai.state.releaseOld=true;const closingAI=connected(ai);
    const ordinaryIntent=ai.route.actions.switchProject.call(ai.route,'p1',true);
    const aiIntent=ai.route.switchProjectExact(ai.records.p2,ai.assertSession,ai.commit,ai.assertSession);
    closingAI.close();await Promise.all([ordinaryIntent,aiIntent]);
    assert.deepEqual(ai.state.actionFinishes,[]);assert.equal(ai.projects.current.id,'p2');
    cases.push({name:'real-socket-old-ordinary-callback-after-new-AI-intent',status:'REJECTED_WITHOUT_OLD_FINISH'});
    const changed=fixture();changed.state.releaseOld=true;const closing=connected(changed);
    const work=changed.route.actions.switchProject.call(changed.route,'p1',true);
    changed.state.cookie='new-token';changed.auth.tokenSnapshot='new-token';closing.close();await work;
    assert.equal(changed.state.actionFinishes.length,0);assert.equal(changed.projects.current.id,'p0');
    cases.push({name:'ordinary-disconnect-same-generation-new-token',status:'REJECTED_WITHOUT_FINISH'});
    const failure=fixture();const closingFailure=connected(failure),nativeError=Error('native transition failure');failure.route.refresh=()=>{throw nativeError;};
    const failed=failure.route.actions.switchProject.call(failure.route,'p2',true);closingFailure.close();
    await assert.rejects(failed,error=>error===nativeError);cases.push({name:'current-disconnect-native-error-is-not-swallowed',status:'PASS'});
  }
  console.log(JSON.stringify({status:expectEntry?'REPRODUCED_LATE_ENTRY_AND_ASYNC_DISCONNECT':process.argv.includes('--expect-stale-commit')?'REPRODUCED_ORDINARY_MODEL_STALE_COMMIT':'MODEL_ORDER_GUARD_PASS',cases},null,2));
}
main().catch(error=>{console.error(String(error.stack||error).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[loaded source]'));process.exitCode=1;});
