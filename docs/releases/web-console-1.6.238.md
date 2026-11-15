# Web Console 1.6.238

The Amazon EC2 host wizard now resolves its AWS SDK for JavaScript v3 module
through the Web Console's production asset loader. The console requests the
module when an operator connects in the wizard. The release check runs the
packaged EC2 client in Chromium and verifies a signed request through a local
proxy fixture.
