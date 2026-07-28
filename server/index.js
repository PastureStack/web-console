// To use it create some files under `routes/`
// e.g. `server/routes/ember-hamsters.js`
//
// module.exports = function(app) {
//   app.get('/ember-hamsters', function(req, res) {
//     res.send('hello');
//   });
// };

module.exports = function(app, options) {
  var glob       = require('glob');
  var path       = require('path');
  var globSync   = glob.globSync || glob.sync;
  var loadRoute  = function(file) { return require(path.resolve(__dirname, file)); };
  var mocks      = globSync('./mocks/**/*.js', { cwd: __dirname }).map(loadRoute);
  var proxies    = globSync('./proxies/**/*.js', { cwd: __dirname }).map(loadRoute);

  mocks.forEach(function(route) { route(app, options); });
  proxies.forEach(function(route) { route(app, options); });
};
