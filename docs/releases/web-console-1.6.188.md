# Web Console 1.6.188

Published immutable component, producer `8e12216fd6f8d843ed043b4c0afcec995d33caeb`, packaged by Server `v1.6.533` with Engine `v0.183.348`. Archive SHA-256 `3467dfb37d7723b9293bc64145603d09ba24799ad726feb89177c9fa38b4ed92`, 3025072 bytes. Official publication and anonymous readback passed; later documentation commits do not replace this identity.

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

Four actual-DOM cases passed for native hover/leave, real static tooltip content, feedback success/failure, listener cleanup after destruction, action-menu overrides and host registration copy. The earlier thirteen clipboard/host cases and one corrected-caption rerun retain their original evidence; they were not replayed. The unchanged 32-key resource contract across 13 locales is carried from the same translation sources, not presented as a new resource run.

自動化52組複製檢查與普通HTTP複製曾通過；後續視覺複核發現既有RTL步驟圓圈背景錯位，因此不宣稱188／533整頁無缺陷。189／534另以不可變新版本修正，未覆寫本歷史成品。 See the [1.6.189 release note](web-console-1.6.189.md).
