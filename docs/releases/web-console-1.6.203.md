# Web Console 1.6.203 / bridge 0.2.5

Source candidate; publication and designated workflow acceptance remain pending.

The shared API Key resource family now includes `apiKeyRestricted`. Both browser
WebMCP and the stdio bridge can find a restricted Key by its visible name, use
the returned opaque reference and query its authorized audit metadata. The Engine
already supports this native type; no credential manager or policy is widened.

The family remains partial. Omitting `resourceType` searches ordinary `apiKey`
resources; choose `apiKeyRestricted` for restricted Keys. The two collections are
not silently merged. A same-name match never authorizes an arbitrary target,
owner denials remain denials, and mismatched response types are rejected.

Four causal regression cases cover both transports, explicit type selection,
owner denial and incorrect response types. The two directly affected resource
and audit suites pass 39 cases. This does not establish runtime or all-frontend
acceptance. Token/MFA/session and human-confirmation protections are unchanged.

This patch requires the existing Engine 0.183.361 typed resource contract. The
matching Server also includes Engine 0.183.362 for native ServiceIndex cleanup.
Both opt-in defaults and ordinary Full/legacy API behavior remain unchanged.
