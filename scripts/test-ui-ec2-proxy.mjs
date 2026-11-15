import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { default: createEc2Client } = require('../app/utils/ec2-client.js');

const account = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'unit-test-placeholder',
  proxyEndpoint: '/v2-beta/proxy',
};
const location = new URL('https://console.example:8080');

test('EC2 commands sign for AWS and keep the original payload through the same-origin proxy', async (t) => {
  t.mock.method(globalThis, 'fetch', async (request) => {
    assert.equal(request.url, `${location.origin}/v2-beta/proxy/ec2.us-west-2.amazonaws.com/`);
    assert.equal(request.method, 'POST');
    assert.equal(request.credentials, 'same-origin');
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.get('authorization'), null);
    assert.equal(request.headers.get('host'), null);
    assert.match(request.headers.get('content-type'), /^rancher:application\/x-www-form-urlencoded/);
    assert.equal(request.headers.get('x-api-headers-restrict'), 'Content-Length');
    assert.match(request.headers.get('x-api-auth-header'), /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-west-2\/ec2\/aws4_request, SignedHeaders=.*\bhost\b.*Signature=[0-9a-f]{64}$/);
    const form = new URLSearchParams(await request.text());
    assert.equal(form.get('Version'), '2016-11-15');
    const action = form.get('Action');
    observed.push(action);
    const result = responses[action];
    assert.ok(result);
    for (const [field, value] of Object.entries(result.input)) {
      assert.equal(form.get(field), value);
    }
    return new Response(`<${action}Response>${result.xml}</${action}Response>`, {
      headers: { 'Content-Type': 'text/xml' },
    });
  });

  const previousWindow = globalThis.window;
  globalThis.window = { location };
  t.after(() => { globalThis.window = previousWindow; });

  const observed = [];
  const responses = {
    DescribeVpcs: {
      input: {},
      xml: '<vpcSet><item><vpcId>vpc-example</vpcId></item></vpcSet>',
    },
    DescribeSubnets: {
      input: {},
      xml: '<subnetSet><item><subnetId>subnet-example</subnetId><state>available</state></item></subnetSet>',
    },
    DescribeSecurityGroups: {
      input: { 'Filter.1.Name': 'vpc-id', 'Filter.1.Value.1': 'vpc-example' },
      xml: '<securityGroupInfo><item><groupId>sg-example</groupId></item></securityGroupInfo>',
    },
    CreateSecurityGroup: {
      input: { VpcId: 'vpc-example', GroupName: 'rancher-machine', GroupDescription: 'Default #1 + test' },
      xml: '<groupId>sg-example</groupId>',
    },
    AuthorizeSecurityGroupIngress: {
      input: {
        GroupId: 'sg-example',
        'IpPermissions.1.IpProtocol': 'tcp',
        'IpPermissions.1.FromPort': '22',
        'IpPermissions.1.ToPort': '22',
        'IpPermissions.1.IpRanges.1.CidrIp': '0.0.0.0/0',
      },
      xml: '<return>true</return>',
    },
    CreateTags: {
      input: { 'ResourceId.1': 'sg-example', 'Tag.1.Key': 'rancher-ui', 'Tag.1.Value': '1.6.237' },
      xml: '<return>true</return>',
    },
  };

  const client = await createEc2Client({ ...account, region: 'us-west-2' });
  const vpcs = await client.describeVpcs();
  assert.equal(vpcs.Vpcs[0].VpcId, 'vpc-example');
  const subnets = await client.describeSubnets();
  assert.equal(subnets.Subnets[0].State, 'available');
  const groups = await client.describeSecurityGroups({
    Filters: [{ Name: 'vpc-id', Values: ['vpc-example'] }],
  });
  assert.equal(groups.SecurityGroups[0].GroupId, 'sg-example');
  const group = await client.createSecurityGroup({
    VpcId: 'vpc-example',
    GroupName: 'rancher-machine',
    Description: 'Default #1 + test',
  });
  assert.equal(group.GroupId, 'sg-example');
  await client.authorizeSecurityGroupIngress({
    GroupId: group.GroupId,
    IpPermissions: [{ IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '0.0.0.0/0' }] }],
  });
  await client.createTags({
    Resources: [group.GroupId],
    Tags: [{ Key: 'rancher-ui', Value: '1.6.237' }],
  });
  assert.deepEqual(observed, Object.keys(responses));
});

test('EC2 proxy preserves partition hostnames and service errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async (request) => {
    assert.equal(request.url, `${location.origin}/v2-beta/proxy/ec2.cn-north-1.amazonaws.com.cn/`);
    assert.match(request.headers.get('x-api-auth-header'), /\/cn-north-1\/ec2\/aws4_request/);
    return new Response('<Response><Errors><Error><Code>AuthFailure</Code><Message>Test request rejected</Message></Error></Errors></Response>', {
      status: 401,
      headers: { 'Content-Type': 'text/xml' },
    });
  });
  const previousWindow = globalThis.window;
  globalThis.window = { location };
  t.after(() => { globalThis.window = previousWindow; });

  const client = await createEc2Client({ ...account, region: 'cn-north-1' });
  await assert.rejects(client.describeVpcs(), {
    name: 'AuthFailure',
    message: 'Test request rejected',
  });
});
