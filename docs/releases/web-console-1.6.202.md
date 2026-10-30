# Web Console 1.6.202

Source candidate; publication and designated workflow acceptance are pending.

Certificate name and description can be changed through the existing resource
query, preview, normal human approval and execution flow. The optional stdio
bridge is 0.2.4. The public tool count remains twelve.

The operation uses a normal metadata-only certificate PUT. Certificate material,
private keys, chains, renewal and deletion remain in the normal human UI. Key
scope, current account permissions, ownership, revision and compare-and-set
checks apply to both preview and execution. Plans cannot approve themselves.

The matching Engine 0.183.361 must also support the certificate descriptor and
typed audit target. The same integration repairs External Service and DNS Alias
audit admission; disabling audit is not a workaround.

Validation covers the exact metadata wire body, private-data rejection and safe
projection, confirmation boundary and the registered Engine schema. Existing
unaffected acceptance keeps its original evidence. A successful build or one
completed workflow is not complete frontend acceptance.

Rollback requires the previous compatible Web/Engine/Server set. Let accepted
operations finish and cancel unused plans before changing versions; do not
mount an old JavaScript bundle over a newer image.
