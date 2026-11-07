import assert from 'node:assert/strict';
import {COMMANDS} from '../bridge/shared-modules.mjs';

const tool = COMMANDS.find(row => row.name === 'preview_resource_change');
assert.ok(tool);
const marker = 'preview_resource_change(';
const start = tool.description.indexOf(marker);
const end = tool.description.indexOf('). ', start);
assert.ok(start >= 0 && start < 300 && end > start, 'Complete Service call must appear near the beginning.');
const example = JSON.parse(tool.description.slice(start + marker.length, end));
assert.deepEqual(Object.keys(example).sort(), ['operation', 'parameters', 'resourceType', 'targetRef']);
assert.equal(example.resourceType, 'service');
assert.equal(example.operation, 'update_links');
assert.deepEqual(Object.keys(example.parameters), ['serviceRefs']);
assert.ok(Array.isArray(example.parameters.serviceRefs) && example.parameters.serviceRefs.length === 1);
assert.ok(tool.inputSchema.required.every(key => Object.hasOwn(example, key)));
assert.ok(tool.inputSchema.properties.resourceType.enum.includes(example.resourceType));
assert.ok(tool.inputSchema.properties.operation.enum.includes(example.operation));
assert.equal(tool.inputSchema.properties.parameters.properties.serviceRefs.type, 'array');
assert.ok(tool.inputSchema.allOf.some(row => row.if?.properties?.operation?.const === 'update_links' &&
  row.then?.properties?.resourceType?.const === 'service' && row.then.required.includes('targetRef') && row.then.required.includes('parameters')));
const intro = tool.description.slice(0, tool.description.indexOf('Preview a typed stack,'));
assert.match(intro, /^Always provide resourceType and operation\./);
assert.match(intro, /same-session generic opaque resourceRefs returned earlier/);
assert.match(intro, /source targetRef and every target in serviceRefs/);
assert.match(intro, /complete replacement set/);
assert.match(intro, /\[\] clears all links/);
assert.match(intro, /parameters\.links:\[\{serviceRef:/);
assert.match(intro, /Supply exactly one of links and serviceRefs/);
assert.match(intro, /INVALID_INPUT.*named field.*real response and tool schema/);
assert.match(intro, /stop on FORBIDDEN/);
assert.match(intro, /needs_user.*does not execute/);
assert.match(intro, /human must review and confirm the exact plan in the normal console/);
assert.ok(!/\b(?:serviceId|serviceIds|stackId|environmentId|accountId)\b/.test(intro));
assert.ok(!/\b1(?:s|st|a)\d+\b/.test(intro));
console.log(JSON.stringify({status: 'PASS_PREVIEW_RESOURCE_CHANGE_CALL_HELP', completeEnvelope: true,
  replacementAndClearExplained: true, typedRepairAndHumanConfirmationExplained: true}));
