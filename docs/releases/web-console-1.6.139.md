# Web Console 1.6.139

This patch aligns write controls with the authenticated project's API schema. Read-only users no longer see Container creation or project API-key creation controls; direct Container creation is denied with a localized message. Account-key creation remains available when the account API allows it.

Receiver Hook creation, cloning, and removal now follow the Receiver schema's methods rather than unrelated Generic Object capabilities. Direct create and edit routes reject unavailable operations before loading the form. The corresponding Webhook Automation Service release must provide role-aware Receiver schemas for these controls to reflect restricted and read-only roles.

The Container edit modal now waits for the complete primary, port, and link save flow before closing. Failed port or link updates restore the original local field and leave the modal open for correction; successful peer updates are not repeated on retry. A multi-resource edit is not a server-side transaction, so the release does not claim atomicity across those APIs.
