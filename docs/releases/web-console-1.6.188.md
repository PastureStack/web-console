# Web Console 1.6.188 candidate

This is a new immutable component candidate following actual-browser findings
in published Web Console `1.6.187`. Published Server `v1.6.532` still packages
`1.6.187` with Engine `v0.183.348` and is deployed to QA 8080. The candidate
does not replace that published artifact or establish a verified Server pairing.

## Scope

Native element listeners handle the non-bubbling `mouseenter` and `mouseleave`
events that Ember 5's default event map does not dispatch. Listeners are attached
when the element mounts and removed when it unmounts; their callbacks join the
Ember run loop so hover and leave updates follow the component lifecycle.

The regression renders the real static tooltip content through the existing
legacy-context initializer rather than replacing it with a service-only fixture.
Registration commands, API permissions and native navigation retain their
existing contracts.

## Verification and publication

Focused verification targets native DOM hover and leave, feedback reset,
clipboard failure and destroyed-component cleanup. Results and immutable
producer/archive identities will be recorded after those gates complete.

The 13 locales × desktop/narrow width × light/dark theme matrix contains
52 actual-browser cases and remains pending. Component checks, immutable
publication, paired Server publication and deployed-browser acceptance are
separate evidence. Existing broader acceptance and deferred KVM cases retain
their original status.
