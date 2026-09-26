# Web Console 1.6.137

Empty pod-list messages now wrap within narrow viewports without changing the
pod-column layout. This fixes the Russian no-hosts message that extended the
host-list page by 6 pixels at 320px. The environment switcher, error page,
permissions, and translations from 1.6.136 are unchanged.

A focused browser CSS test checks the empty message and a long unbroken word at
1440, 375, and 320 pixels in light/dark and left-to-right/right-to-left assets.
