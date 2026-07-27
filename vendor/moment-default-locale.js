/* global moment */

// Loading a Moment locale also selects it. Keep the bundle deterministic until
// the user-language service selects the signed-in user's locale.
moment.locale('en');
