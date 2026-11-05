// Explicit local profile writer. Never imported by the MCP server or exposed as a tool.
import {open, lstat, unlink} from 'node:fs/promises';
import {constants, realpathSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadConfig, prepareBoundProfile, SetupError} from './core.mjs';

const runFile = promisify(execFile);
const codes = new Set(['INVALID_CONFIG', 'CONFIG_UNREADABLE', 'HTTPS_REQUIRED', 'INVALID_ENDPOINT', 'INVALID_ENVIRONMENT_BINDING',
  'INVALID_ENVIRONMENT_RESPONSE', 'ENVIRONMENT_SCAN_LIMIT', 'ENVIRONMENT_NOT_VISIBLE', 'AMBIGUOUS_ENVIRONMENT',
  'ENVIRONMENT_BINDING_MISMATCH', 'ENVIRONMENT_SELECTION_CHANGED', 'ENVIRONMENT_IDENTITY_UNAVAILABLE',
  'DEDICATED_KEY_REQUIRED', 'PROFILE_BINDING_CANCELLED', 'PROFILE_OUTPUT_EXISTS', 'PRIVATE_PROFILE_REQUIRED', 'INVALID_PROFILE_ARGUMENTS']);

export function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return {help: true};
  if (args.length !== 4 || !['--from', '--output'].includes(args[0]) || !['--from', '--output'].includes(args[2]) || args[0] === args[2] ||
      [args[1], args[3]].some(value => typeof value !== 'string' || !value || value.includes('\0') || value.startsWith('--'))) throw new SetupError('INVALID_PROFILE_ARGUMENTS');
  return {[args[0].slice(2)]: args[1], [args[2].slice(2)]: args[3]};
}

function friendly(value, maximum) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').slice(0, maximum) : '';
}

export async function selectFriendly(candidates, {config, interactive, choose, output = process.stdout} = {}) {
  if (!interactive || candidates.length > 50) throw new SetupError('AMBIGUOUS_ENVIRONMENT');
  const labels = candidates.map(item => [friendly(item.name, 255), friendly(item.description, 160), friendly(item.created, 64)].map(x => JSON.stringify(x)).join(' / '));
  if (new Set(labels).size !== labels.length || labels.some(label => [config.accessKey, config.secretKey].some(secret => label.includes(secret)))) throw new SetupError('AMBIGUOUS_ENVIRONMENT');
  let selected;
  if (choose) selected = await choose(labels);
  else {
    const terminal = createInterface({input: process.stdin, output});
    try { selected = await terminal.question('Choose the environment (name / description / created):\n' + labels.map((label, index) => `${index + 1}. ${label}`).join('\n') + '\nNumber, or Enter/q to cancel: '); }
    finally { terminal.close(); }
  }
  if (selected === '' || selected === 'q' || selected === null) return null;
  if (typeof selected !== 'string' || !/^[1-9][0-9]?$/.test(selected) || Number(selected) > candidates.length) throw new SetupError('AMBIGUOUS_ENVIRONMENT');
  return Number(selected) - 1;
}

async function privateFile(file, destination) {
  if (process.platform !== 'win32') {
    await file.chmod(0o600);
    if (((await file.stat()).mode & 0o077) !== 0) throw new SetupError('PRIVATE_PROFILE_REQUIRED');
    return;
  }
  // Apply a private ACL only to our new, still-empty file before writing credentials.
  try {
    // Resolve the OS kernel namespace, never an environment or PATH override.
    const whoami = realpathSync.native(String.raw`\\?\GLOBALROOT\SystemRoot\System32\whoami.exe`);
    const icacls = realpathSync.native(String.raw`\\?\GLOBALROOT\SystemRoot\System32\icacls.exe`);
    const {stdout} = await runFile(whoami, ['/user', '/fo', 'csv', '/nh'], {windowsHide: true, timeout: 5000, maxBuffer: 16384});
    const match = stdout.match(/,"(S-1-[0-9-]+)"\s*$/);
    if (!match) throw new Error();
    await runFile(icacls, [destination, '/inheritance:r', '/grant:r', '*' + match[1] + ':(F)', '/q'],
      {windowsHide: true, timeout: 5000, maxBuffer: 16384});
  } catch { throw new SetupError('PRIVATE_PROFILE_REQUIRED'); }
}

export async function bindProfile({from, output}, {fetcher, interactive = !!(process.stdin.isTTY && process.stdout.isTTY), choose,
  terminalOutput = process.stdout, secureFile = privateFile} = {}) {
  const destination = path.resolve(output);
  let file, identity;
  try {
    try { file = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw new SetupError('PROFILE_OUTPUT_EXISTS'); throw error; }
    identity = await file.stat();
    await secureFile(file, destination);
    const secured = await lstat(destination);
    if (!secured.isFile() || secured.isSymbolicLink() || secured.dev !== identity.dev || secured.ino !== identity.ino) throw new SetupError('PRIVATE_PROFILE_REQUIRED');
    // Claim and protect the new empty file before reading credentials or doing
    // discovery. Existing outputs are rejected before credential reads or network calls.
    const config = await loadConfig(from);
    const prepared = await prepareBoundProfile(config, {fetcher,
      select: rows => selectFriendly(rows, {config, interactive, choose, output: terminalOutput})});
    const bytes = Buffer.from(JSON.stringify(prepared, null, 2) + '\n');
    if (bytes.length > 16 * 1024) throw new SetupError('INVALID_CONFIG');
    const named = await lstat(destination);
    if (!named.isFile() || named.isSymbolicLink() || named.dev !== identity.dev || named.ino !== identity.ino) throw new SetupError('PRIVATE_PROFILE_REQUIRED');
    await file.writeFile(bytes); await file.sync();
    const after = await lstat(destination);
    if (!after.isFile() || after.isSymbolicLink() || after.dev !== identity.dev || after.ino !== identity.ino) throw new SetupError('PRIVATE_PROFILE_REQUIRED');
    return {created: true};
  } catch (error) {
    if (file) {
      await file.close().catch(() => {}); file = null;
      try {
        const current = await lstat(destination);
        if (current.isFile() && !current.isSymbolicLink() && current.dev === identity?.dev && current.ino === identity?.ino) await unlink(destination);
      } catch { /* Do not delete a replacement or unrelated path. */ }
    }
    throw error;
  } finally { await file?.close().catch(() => {}); }
}

export async function main(args, {write = text => process.stdout.write(text), error = text => process.stderr.write(text), ...options} = {}) {
  try {
    const parsed = parseArguments(args);
    if (parsed.help) { write('Usage: node bridge/bind-profile.mjs --from EXISTING_PRIVATE_PROFILE --output NEW_PRIVATE_PROFILE\n'); return 0; }
    await bindProfile(parsed, options); write('Bound profile created. Existing profile unchanged.\n'); return 0;
  } catch (failure) {
    error('PastureStack profile binding unavailable: ' + (failure instanceof SetupError && codes.has(failure.code) ? failure.code : 'AUTH_OR_CONNECTION_FAILED') + '\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
