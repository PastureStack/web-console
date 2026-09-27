# Web Console 1.6.147

Service Edit submits only the editable `name`, `description`, and `scale`
fields. The form still validates its cloned model, but saving no longer sends
the cloned launch configuration or upgrade strategy in the Service PUT.

The scale form preserves an initial scale of zero. In edit mode, a quick scale
selection updates the model immediately; the separate quick scale action
submits only `scale` after its debounce. These changes target the Service
edit and scale write payloads without changing the Server API contract.

Focused unit tests cover the Service Edit payload and scale behavior. The
full source/build gate and isolated 8080 browser workflow remain separate
acceptance evidence; this source change alone does not prove a deployed
Service edit, retry, or removal workflow. Production deployment is not part
of this release note.
