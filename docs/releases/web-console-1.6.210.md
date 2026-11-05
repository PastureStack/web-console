# Web Console 1.6.210 / Bridge 0.2.12

Adds human-approved name and description changes for the currently selected Project through existing tools and native owner/Key checks. Other visible Projects remain queryable; editing requires a normal context switch and a fresh opaque reference. Project creation, deletion, membership, network, authentication and templates are unchanged.

The explicit local Bridge profile writer creates a new private bound profile without overwriting the original. Binding follows the same native Project ID and bounded opaque UUID across restart and rename; hidden, removed or replaced Projects fail closed without a name fallback. Legacy profiles keep existing query and description behavior. Permanent rename requires normal user setup first.

Adds human-approved load-balancer name and description updates through the existing native Service owner and canonical service-resource Key scopes, with separately readable Stack context. Ports, backend links, certificates, scaling and lifecycle remain outside this metadata subset.

Client-reported setup reasons are negotiated through the original audit ACK and labeled as client reports, never backend authorization decisions. Verified operation receipts stay successful while bounded label-refresh warnings guide read-only recovery without reapplying business actions. Matching published Orchestration Engine v0.183.372 is required; the new platform Key-audit detail also requires the Server571 broker projection.

Original full/enabled CI passed 1134 browser tests with zero failures or skips. All44 focused methods executed on this producer: initial Project8 Node and2 QUnit, plus profile/audit/writer27 Node and2 QUnit, and load-balancer metadata4 Node and1 QUnit. Original archive SLSA and runtime CycloneDX attestations were verified. Publication reuses the one original CI ZIP without rebuilding. Bridge0.2.12 contains45 source files,46 manifest rows and47 ZIP entries, with the unchanged92-component/95-location SDK1.32.2 dependency graph. Its actual loopback handshake passed; clean-install evidence is carried from0.2.5, with no new dependency install.

Runtime Project7, new weak-model subcases, the52 new audit-block layouts and the7 active load-balancer metadata/dependency cases remain pending. Whole243-group completion is not claimed. Runtime SBOM coverage remains incomplete; this publication performs no new vulnerability scan and does not claim zero vulnerabilities.
