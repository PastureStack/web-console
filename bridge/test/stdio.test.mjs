import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('real SDK stdio handshake, seven tools, scoped call and EOF shutdown', async () => {
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
    const tools=await client.listTools();assert.equal(tools.tools.length,7);
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
