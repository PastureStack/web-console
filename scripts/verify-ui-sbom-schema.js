'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('../tools/sbom-verifier/node_modules/ajv');
const [schemaPath, ...documents] = process.argv.slice(2);
if (!schemaPath || documents.length === 0) {
  throw new Error('Usage: verify-ui-sbom-schema.js <bom-1.6.schema.json> <document>...');
}
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
for (const name of ['spdx.schema.json', 'jsf-0.82.schema.json']) {
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(path.dirname(schemaPath), name), 'utf8')));
}
const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
for (const file of documents) {
  if (!validate(JSON.parse(fs.readFileSync(file, 'utf8')))) {
    throw new Error(`${path.basename(file)}: ${ajv.errorsText(validate.errors)}`);
  }
  console.log(`CYCLONEDX_1_6_SCHEMA_OK ${path.basename(file)}`);
}
