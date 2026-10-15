# Web Console 1.6.189

This release corrects RTL step-circle alignment found during Web Console `1.6.188` visual acceptance. Published Server `v1.6.534` packages it with Engine `v0.183.348`; official assembly, QA deployment and restart checks passed. The native hover repair and its tests remain historical evidence in the [1.6.188 release note](web-console-1.6.188.md).

## Scope

The shared step list now explicitly anchors its circle background at `left top`.
The existing RTL compiler converts that anchor to `right top`, keeping the circle
on the same side as its step number. The original SVG geometry and native tooltip
behavior are retained.

## Verification and publication

Six new focused CSS cases passed for the exact shared step-list change, SVG geometry, generated LTR/RTL background and number alignment, both themes and version identities. Four actual-DOM cases added and passed on Web 188 are carried for native hover/leave, real static tooltip content, feedback success/failure, listener cleanup after destruction, action-menu overrides and host registration copy. The earlier thirteen clipboard/host cases and one corrected-caption rerun retain their original evidence; they were not replayed. The unchanged 32-key resource contract across 13 locales is carried from the same translation sources, not presented as a new resource run.

Immutable Web producer: `f30f5e81dd9ee25878c3aff681eed5bb61883453`. `web-console-1.6.189.tar.gz` is 3,024,592 bytes, SHA-256 `1c90e273b7db8ebf9d851a0ae1ec49dc59067b5ee1099ea3886919c1a79ccdfc`. Official publication and anonymous readback passed; later documentation commits do not replace this producer.

The final 52-case matrix covers 13 locales, 1440px/390px widths and light/dark themes: 44 unaffected Web 188 results are carried, and eight fa-ir/en-us views were newly run on Web 189 after the step-circle RTL fix. These are not 52 new Web 189 runs. A separate ordinary-HTTP native copy was newly verified on Web 189 with the Clipboard API absent. Clipboard payloads matched exactly. Permission rejection was an explicit denial fixture, distinct from the real HTTP fallback. Preferences, presentation and clipboard were restored; page errors, missing translations and unexpected resource writes were zero.

Focused acceptance does not complete the broader role/backend/lifecycle matrix; historical HOLDs and deferred KVM cases retain their status.
