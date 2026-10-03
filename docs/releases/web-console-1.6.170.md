# Web Console 1.6.170

Source candidate; formal component publication and packaged native acceptance
remain separate gates.

## Root cause and scope

QA Server v1.6.506 supplied the exact inactive local Volume in the current
environment, with a complete empty storage-pool Collection and complete scoped
mount cache. The API also supplied `mounts: null`. The resource relationship
setter correctly retained that optional expanded projection, but the shared
unallocated-volume classifier rejected it as an allocation. The Store held the
resource while the native table incorrectly hid it.

The classifier accepts null only for the optional expanded `mounts` projection.
It does not replace it with an empty array or treat it as absence proof. The
real complete empty storage-pool relationship, full current-environment mount
cache, absence of exact-volume mounts (including inactive workloads), allocation
fingerprint and explicit local/non-native fields remain required. Raw nonempty
mount/pool IDs remain binding; null or malformed raw ID fields do not qualify.
An arbitrary object with `length: 0` is not an empty native/Ember array.

No API method, authorization, authentication, resource transition, backend,
HAProxy or production configuration changes. No migration is required.

## Verification boundary

The new real Store/Volume/Collection regression deserializes the null projection
through the actual computed setter. Positive classification still requires
real pool and mount evidence; incomplete/partial/nonempty pool data, incomplete
mount cache, inactive mounts, nonempty IDs and malformed values remain excluded.
Focused headless Chrome 153 validation passed 13/13 directly affected classifier
and storage-route cases, with zero failures, skips or todo. Independent scoped
review found no blocker. This is source regression evidence, not packaged QA.
Formal immutable component/archive results and packaged browser lifecycle
results will be recorded after they are actually complete. Earlier failed
native row receipts remain HOLD; the complete resource/permission/locale matrix
is not claimed as PASS.

## Upgrade and rollback

Use the separately published Server patch containing this exact component.
Do not overwrite Web Console 1.6.169 or Server v1.6.506. Existing named volumes,
runtime environment and the previous immutable Server image remain the rollback
boundary. This repair does not require or authorize company deployment.
