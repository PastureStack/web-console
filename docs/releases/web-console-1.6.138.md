# Web Console 1.6.138

Delete confirmation now waits for each resource deletion before closing. The
buttons are disabled while a request is in progress, and a failed deletion
leaves the dialog open so the remaining resources can be retried without
repeating completed deletes.

The authenticated route waits for language initialization before it resolves.
Denied and missing resource pages continue to show the same 404 message and
translate it in the active language, including after a locale change. Server
authorization and API contracts are unchanged.
