# Web Console 1.6.142

Receiver cloning now omits the source Receiver's server-issued URL and state.
The new Receiver retains editable settings but receives its own URL from the
server. This avoids carrying a previous webhook capability into a new resource.

Creating a private ProjectTemplate from a catalog default no longer copies the
default's external catalog identity. Direct Add Container, Add Host, Add
Receiver, and Edit Receiver denials use the existing error page and retranslate
when the user changes between English and Traditional Chinese. A direct
environment URL that is no longer accessible displays a generic localized
missing-or-denied message instead of silently opening a different environment.

The shared container table keeps action controls within the visible horizontal
scroll area without shrinking data columns. The same table-header positioning
is checked in left-to-right and right-to-left layouts and in narrow panels.

Authorization remains enforced by the Server. This client patch neither grants
new resource rights nor changes authentication, session, or API protocols.
