import { COMMANDS, CommandError, publicError } from './ai-command-contract';

// A registration signal removes these tools. It does not cancel an execution
// that the browser has already started, or roll back a server-side operation.
export function registerCommandTools({modelContext, engine, context, Controller = AbortController}) {
  const registration = context.capture();
  const controller = new Controller();
  let disposed = false;
  let readyForCalls = false;
  const dispose = () => { if ( !disposed ) { disposed = true; readyForCalls = false; controller.abort(); } };
  const ready = (async () => {
    try {
      for ( const command of COMMANDS.filter((item) => registration.mode === 'enabled' || !item.write) ) {
        context.assertCurrent(registration, controller.signal);
        await modelContext.registerTool({
          name: command.name,
          description: command.description,
          inputSchema: command.inputSchema,
          async execute(input, options = {}) {
            const result = readyForCalls && !disposed ? await engine.execute(command.name, input, {registration, signal: options.signal}) :
              publicError(new CommandError('UNAVAILABLE'));
            return {content: [{type: 'text', text: JSON.stringify(result)}], isError: ['rejected', 'failed'].includes(result.status)};
          },
        }, {signal: controller.signal});
        // Registration may settle after disable, navigation or a new session.
        // Never register the next tool, or publish success, for that old epoch.
        context.assertCurrent(registration, controller.signal);
      }
      readyForCalls = true;
    } catch (error) {
      dispose();
      throw error;
    }
  })();
  // The disposer is available before the first asynchronous registration settles.
  return {ready, dispose};
}
