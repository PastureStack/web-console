# Web Console 1.6.237

The Amazon EC2 host wizard uses AWS SDK for JavaScript v3 for VPC and subnet
discovery and for security group discovery, creation, ingress rules and tagging.
Signed requests still go through the same-origin control-plane proxy. When an
earlier attempt already added an ingress rule, the wizard can finish adding the
remaining rules and tag the default security group.

The old vendored AWS SDK v2 and its initializer are removed. The runtime SBOM
tracks the locked AWS SDK v3 packages that the build places in the browser bundle.
