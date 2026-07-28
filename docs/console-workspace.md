# Console Workspace

The Console Workspace keeps container terminals, container logs, and virtual
machine consoles in movable application windows instead of browser pop-ups or
fixed inline panels.

## Window behavior

- Each browser tab retains its own window positions, sizes, stacking order,
  minimized state, and maximized state.
- Closing a window hides it without ending its terminal or log session.
- The bottom dock reopens minimized windows and provides a list of every known
  session.
- Window titles identify the environment, stack, and container. The same
  context appears below each entry in the session list so similarly named
  containers remain distinguishable across environments.
- The dock keeps horizontal scrolling for large session sets while reserving
  space for hover magnification and the session-count badge.
- Holding the alternate action for a terminal or log command opens a separate
  session instead of reusing the existing logical session.
- Kubernetes and Swarm command-line pages launch the same managed terminal
  windows.

## Persistence and cross-tab behavior

Terminal and log sessions are owned by the Server console broker. Refreshing or
closing a browser tab disconnects only that browser client; the broker retains
the upstream session and a bounded output replay. A later tab can reconnect,
receive retained output, and continue the same terminal process.

Signed-in tabs share the session list through same-origin browser storage and a
`BroadcastChannel`. Live output is sent to every attached tab. Only one tab
controls terminal input at a time, and another tab must explicitly take
control. Window layout remains tab-local so arranging one tab does not move
windows in another. A browser tab retains its broker client identifier across a
reload so the broker immediately replaces the old socket and preserves control
without briefly attaching a second client. An ordinary new or duplicated tab
checks for a live identifier conflict over the workspace `BroadcastChannel` and
rotates its copied identifier before attaching. Both client identity and layout
remain tab-local in `sessionStorage`.

Virtual machine console windows retain their list and layout. Their graphical
connection is re-established when the window is reopened because the legacy
console protocol does not provide terminal-style output replay.

Log windows use themed vertical and horizontal scrollbars. Line wrapping is
disabled by default so long output remains intact and horizontally scrollable.
The localized **Wrap lines** option hides the horizontal scrollbar while
enabled, and its preference is retained in the browser.

## Browser storage

The global session record contains the cryptographically random session
identifier, a random session secret, resource identity, session kind, command,
and current status.
The per-tab records contain the broker client identifier and window geometry.

Upstream terminal and log access tokens are submitted once to the same-origin
broker and are never written to browser storage. The random broker secret is
carried in a WebSocket subprotocol header instead of the request URL so it is
not written to ordinary URL access logs. No terminal output or log content is
persisted by the browser.

## Ending a session

Minimize or close a window to keep its process active. The power button beside
the window close button opens a localized Yes/No confirmation before ending
the session because the running command will be stopped. Ended entries can be
removed from local history. A naturally ended session can still show its
bounded replay while the broker history remains available.

The corresponding Server release defines concurrent session, replay, frame,
idle lifetime, and ended-history limits.
