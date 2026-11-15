import { FetchHttpHandler } from '@smithy/fetch-http-handler';

class Ec2ProxyRequestHandler extends FetchHttpHandler {
  constructor(proxyEndpoint) {
    super({
      credentials: 'same-origin',
      requestInit: () => ({ redirect: 'error' }),
      requestTimeout: 120000,
    });
    this.proxyEndpoint = proxyEndpoint;
  }

  handle(request, options) {
    // The SDK has already signed the AWS request. The control plane restores
    // the AWS host, authorization and content type before forwarding the body.
    const { authorization, host, 'content-type': contentType, ...headers } = request.headers;
    const location = window.location;

    return super.handle({
      ...request,
      protocol: location.protocol,
      hostname: location.hostname,
      port: location.port,
      path: `${this.proxyEndpoint}/${request.hostname}${request.path}`,
      headers: {
        ...headers,
        'content-type': `rancher:${contentType}`,
        'x-api-auth-header': authorization,
        'x-api-headers-restrict': 'Content-Length',
      },
    }, options);
  }
}

export default async function createEc2Client({ region, accessKeyId, secretAccessKey, proxyEndpoint }) {
  // The EC2 model bundle is only needed when a user enters the EC2 wizard.
  const {
    EC2Client,
    AuthorizeSecurityGroupIngressCommand,
    CreateSecurityGroupCommand,
    CreateTagsCommand,
    DescribeSecurityGroupsCommand,
    DescribeSubnetsCommand,
    DescribeVpcsCommand,
  } = await import('@aws-sdk/client-ec2');

  const client = new EC2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 4,
    requestHandler: new Ec2ProxyRequestHandler(proxyEndpoint),
  });

  return {
    authorizeSecurityGroupIngress: (params) => client.send(new AuthorizeSecurityGroupIngressCommand(params)),
    createSecurityGroup: (params) => client.send(new CreateSecurityGroupCommand(params)),
    createTags: (params) => client.send(new CreateTagsCommand(params)),
    describeSecurityGroups: (params) => client.send(new DescribeSecurityGroupsCommand(params)),
    describeSubnets: () => client.send(new DescribeSubnetsCommand({})),
    describeVpcs: () => client.send(new DescribeVpcsCommand({})),
  };
}
