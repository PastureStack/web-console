# Web Console 1.6.189 candidate

This candidate corrects the step-circle alignment found during the actual-browser
RTL checks of Web Console `1.6.188`. Published Server `v1.6.533` packages
`1.6.188` with Engine `v0.183.348`; the new candidate requires its own immutable
publication and Server pairing.

The shared step list now explicitly anchors its circle background at `left top`.
The existing RTL compiler converts that anchor to `right top`, keeping the circle
on the same side as its step number. The original SVG geometry and native tooltip
behavior are retained.

Focused verification compares the existing LTR/RTL output with the exact step-list
SCSS compiled through Sass and the production RTL processor. Production packaging
and deployed-browser acceptance of `1.6.189` remain pending. The preceding native
hover repair and its verification history remain in the
[1.6.188 release note](web-console-1.6.188.md).
