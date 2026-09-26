# Web Console 1.6.134

The environment switcher now asks for all projects when the current session
identifies a site administrator. Previously it requested the membership-only
collection, so a site administrator could open an environment directly but
could not return to it from the switcher after selecting another environment.

Ordinary users continue to request only their member environments. The Server
continues to enforce the `all=true` permission; this release changes no API
authorization or project membership data. The switcher labels the full list
for administrators and the member-only list for other signed-in users.
