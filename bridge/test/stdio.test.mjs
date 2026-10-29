import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {COMMANDS} from '../shared-modules.mjs';

test('real SDK stdio handshake, shared tool contract, scoped call and EOF shutdown', async () => {
  const credential='stdio-secret-not-in-output';
  const requests=[];
  const api=http.createServer(async(req,res)=>{
    assert.equal(req.headers.cookie,undefined);
    assert.equal(req.headers.authorization,'Basic '+Buffer.from('test-access:'+credential).toString('base64'));
    if(!req.url.startsWith('/v2-beta/projects?')) assert.equal(req.headers['x-pasturestack-key-expected-revision'],'1');
    let raw='';for await(const chunk of req)raw+=chunk;
    requests.push({path:req.url,body:raw});
    res.setHeader('Content-Type','application/json');
    res.setHeader('X-PastureStack-Key-Purpose','ai-bridge');
    res.setHeader('X-PastureStack-Key-Revision','1');
    if(req.url.startsWith('/v2-beta/projects?'))return res.end(JSON.stringify({data:[{id:'p1',name:'Default',state:'active'}]}));
    if(req.url.endsWith('/aiToolCallEvents'))return res.end(JSON.stringify({accepted:true,requestId:'req-'+requests.length}));
    if(req.url.startsWith('/v2-beta/projects/p1/stacks?'))return res.end(JSON.stringify({data:[{id:'st1',accountId:'p1',name:'My stack'}]}));
    res.statusCode=404;res.end(JSON.stringify({code:'NotFound'}));
  });
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  const dir=await mkdtemp(path.join(tmpdir(),'pst-bridge-'));
  const config=path.join(dir,'config.json');
  await writeFile(config,JSON.stringify({endpoint:'http://127.0.0.1:'+api.address().port,environment:'Default',accessKey:'test-access',secretKey:credential}),{mode:0o600});
  const client=new Client({name:'qa-sdk-client',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server.mjs',import.meta.url))],env:{PASTURESTACK_BRIDGE_CONFIG:config},stderr:'pipe'});
  let stderr='';transport.stderr?.on('data',data=>{stderr+=data;});
  try {
    await client.connect(transport);
    const metadata=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
    assert.equal(client.getServerVersion().version,metadata.version);
    const tools=await client.listTools();assert.deepEqual(tools.tools.map(item=>item.name),COMMANDS.map(item=>item.name));
    assert.equal(tools.tools.some(item=>item.name==='confirmPlan'),false);
    const response=await client.callTool({name:'find_stacks',arguments:{query:'My'}});
    assert.equal(response.structuredContent.status,'succeeded');
    assert.equal(response.structuredContent.items[0].name,'My stack');
    assert.equal(JSON.stringify(response).includes(credential),false);
    assert.equal(stderr.includes(credential),false);
    assert.equal(requests.filter(item=>item.path.endsWith('/aiToolCallEvents')).length,2);
  } finally {
    await client.close();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));
    await unlink(config);await rmdir(dir);
  }
});

test('bounded stdio create arrays', async t => {
  const credential = 'array-stdio-secret', requests = [];
  const api = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const data = raw ? JSON.parse(raw) : {};
    requests.push({path: req.url, data});
    res.setHeader('Content-Type', 'application/json'); res.setHeader('X-PastureStack-Key-Purpose', 'ai-bridge'); res.setHeader('X-PastureStack-Key-Revision', '1');
    if (req.url.startsWith('/v2-beta/projects?')) return res.end(JSON.stringify({data: [{id: 'p1', name: 'Default', state: 'active'}]}));
    if (req.url.endsWith('/aiToolCallEvents')) return res.end(JSON.stringify({accepted: true, requestId: 'ack-' + requests.length}));
    if (req.url.endsWith('/aiResourceChangePlans')) return res.end(JSON.stringify({id: 'aichange-11111111-1111-1111-1111-111111111111',
      resourceType: data.resourceType, operation: data.operation, resourceId: null, targetPath: 'Default/new-container',
      changes: Object.entries(data.parameters).filter(([field]) => ['command', 'entryPoint'].includes(field)).map(([field, value]) => ({field, before: null, after: JSON.stringify(value)})),
      status: 'preview', confirmationState: 'pending', expiresAt: '2026-10-29T13:00:00Z', verifiedResult: false}));
    res.statusCode = 404; res.end('{}');
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(path.join(tmpdir(), 'pst-array-bridge-')), config = path.join(dir, 'config.json');
  await writeFile(config, JSON.stringify({endpoint: 'http://127.0.0.1:' + api.address().port, environment: 'Default', accessKey: 'array-key', secretKey: credential}), {mode: 0o600});
  const client = new Client({name: 'array-client', version: '1'});
  const transport = new StdioClientTransport({command: process.execPath, args: [fileURLToPath(new URL('../server.mjs', import.meta.url))], env: {PASTURESTACK_BRIDGE_CONFIG: config}, stderr: 'pipe'});
  let stderr = ''; transport.stderr?.on('data', value => { stderr += value; });
  try {
    await client.connect(transport);
    await t.test('valid escaped command array larger than 64 KiB reaches the typed preview', async () => {
      const command = Array.from({length: 4}, () => '\u0001'.repeat(4096));
      const args = {resourceType: 'container', operation: 'create', parameters: {name: 'new', image: 'busybox:1.37.0', command, entryPoint: ['sh', '-c']}};
      assert.ok(Buffer.byteLength(JSON.stringify(args)) > 65536);
      const result = await client.callTool({name: 'preview_resource_change', arguments: args});
      assert.equal(result.structuredContent.status, 'needs_user');
      const actual = requests.find(item => item.path.endsWith('/aiResourceChangePlans'));
      assert.deepEqual(actual.data.parameters.command, command);
      assert.equal(result.structuredContent.displayDiff.find(item => item.field === 'command').after, JSON.stringify(command));
      assert.equal(JSON.stringify(result).includes(credential), false);
    });
    await t.test('request beyond 256 KiB is rejected before audit or business without printing its payload', async () => {
      const count = requests.length;
      await assert.rejects(client.callTool({name: 'preview_resource_change', arguments: {resourceType: 'container', operation: 'create',
        parameters: {name: 'large', image: 'busybox:1.37.0', description: 'PRIVATE_OVERSIZE_SENTINEL' + 'x'.repeat(300000)}}}, undefined, {timeout: 750}));
      assert.equal(requests.length, count);
      assert.equal(stderr.includes('PRIVATE_OVERSIZE_SENTINEL'), false); assert.equal(stderr.includes(credential), false);
    });
  } finally {
    await client.close(); api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); await unlink(config); await rmdir(dir);
  }
});
