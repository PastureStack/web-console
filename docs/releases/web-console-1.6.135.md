# Web Console 1.6.135

This release keeps the administrator environment switcher behavior introduced
in `1.6.134`. The switcher requests `all=true` only for authenticated site
administrators, so their list includes active environments even without direct
membership. Other signed-in users continue to see their member environments.
The Server remains responsible for authorizing the request.

The switcher's full-list and member-list labels are now fully translated into
French and use the same environment terminology as the surrounding Russian UI.
The other shipped locale labels and the host permission error translations are
unchanged. This release does not change API authorization or project membership.
