# Web Console 1.6.148

Secret Edit now submits only `description` in its PUT. The current v1 and
v2-beta Secret schemas on the isolated 8080 QA server advertise
`name.update=false` and `description.update=true` for the owner and
superadministrator roles. The edit form therefore shows the existing name as
read-only and explains that names cannot be changed after creation. Secret Add
continues to accept a name and value; the edit form still never exposes the
stored value.

On a successful edit, the listed Secret receives the new description, including
an explicit empty string when the user clears it. On a rejected edit, the form
stays open, keeps the entered description, and displays the existing error
message. This follows the editable-field approach used by
the `1.6.147` Service Edit fix without changing the Server API contract.

Focused Secret tests pass, including the edit payload, name field, focus,
success and denial behavior, and the unchanged create save path. The isolated
8080 browser Edit Save workflow remains to be verified against a fresh owned
Secret. No production deployment is included in this source change.
