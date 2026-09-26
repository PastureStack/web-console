# Web Console 1.6.136

The environment switcher now opens toward the available viewport space in both
left-to-right and right-to-left layouts. Its menu width is bounded on narrow
screens, and long environment names and actions wrap within the menu. The
change is scoped to the header's environment switcher; other dropdowns retain
their existing placement.

The shared error page now keeps right-to-left direction and alignment in its
compiled RTL stylesheets. This corrects Persian error text on denied pages.

Browser layout tests cover 1440, 375, and 320 pixel viewports in both directions
and both themes. This release changes no API authorization, project membership,
or environment selection behavior.
