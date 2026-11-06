# Web Console 1.6.217 / Bridge 0.2.19 source candidate

The AI resource review dialog stays anchored inside the viewport when its underlying page is scrolled. Long reviews scroll inside this dialog so the heading and approval controls remain reachable in LTR and RTL, light and dark themes, and narrow windows. Other dialogs retain their existing layout.

This candidate requires matching Engine 0.183.377. The private audit contract checker admits only its two optional closed source-page input fields; permissions and native query bounds remain unchanged. Bridge runtime logic and its qualified dependency graph are unchanged; its source artifact receives a new version because qualification binds it to this Web producer.

Local browser controls reproduce clipping with the original deployed CSS and verify the scoped fix. Required CI, original artifact qualification, matching Engine publication and native workflow acceptance remain separate gates. This source note does not establish full frontend or native acceptance.
