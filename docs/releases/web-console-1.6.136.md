# Web Console 1.6.136

The environment switcher now opens toward the available viewport space in both
left-to-right and right-to-left layouts. Its menu width is bounded on narrow
screens, and long environment names and actions wrap within the menu. The
change is scoped to the header's environment switcher; other dropdowns retain
their existing placement.

The shared error page now keeps right-to-left direction and alignment in its
compiled RTL stylesheets. This corrects Persian error text on denied pages.

When environment access is revoked, the console now rechecks a stored selection
with the API before reusing it. A 403 or 404 lets the console choose another
accessible environment; authentication and server errors still surface. The
environment management page uses the refreshed project collection so a revoked
environment does not remain in the list through the local store cache. A direct
URL to a permitted environment still works even if that environment is absent
from the collection.

Browser layout tests cover 1440, 375, and 320 pixel viewports in both directions
and both themes. Focused service and route tests cover revoked selections,
fresh lists, permitted direct environments, and error handling. This release
changes no Server authorization or project membership data.
