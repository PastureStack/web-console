import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {createBridge, loadConfig, SetupError} from './core.mjs';

try {
  const path = process.env.PASTURESTACK_BRIDGE_CONFIG;
  if (!path) throw new SetupError('CONFIG_REQUIRED');
  const bridge = await createBridge(await loadConfig(path));
  const server = new Server({name: 'pasturestack-webmcp-bridge', version: '0.2.1'}, {
    capabilities: {tools: {}},
    instructions: 'Use names and returned opaque references. Never guess IDs. A human must approve change plans in the console. Rejected calls must be repaired only as directed; never evade permissions. Accepted/running is not success. Read the existing operation until verifiedResult=true.',
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({tools: bridge.tools.map(tool => ({
    name: tool.name, description: tool.description, inputSchema: tool.inputSchema,
    annotations: {readOnlyHint: !tool.write, destructiveHint: !!tool.write, openWorldHint: false},
  }))}));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const result = await bridge.engine.execute(request.params.name, request.params.arguments ?? {}, {signal: extra.signal});
    return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result,
      isError: result.status === 'rejected' || result.status === 'unknown'};
  });
  server.onclose = () => bridge.close();
  server.onerror = () => {}; // Protocol errors must never dump request headers or credentials.
  // Request framing is bounded independently of the 1 MiB platform response
  // limit. A valid 16K command array can exceed 64K after JSON escaping.
  await server.connect(new StdioServerTransport(process.stdin, process.stdout, {maxBufferSize: 256 * 1024}));
  process.on('SIGINT', () => void server.close());
  process.on('SIGTERM', () => void server.close());
} catch (error) {
  console.error('PastureStack bridge unavailable: ' + (error instanceof SetupError ? error.code : 'AUTH_OR_CONNECTION_FAILED'));
  process.exitCode = 1;
}
