'use strict';

const os = require('os');

const isWindows = process.platform === 'win32';

function memo(name, lookup) {
  let cached;
  let hasCached = false;

  exports[name] = function value(cb) {
    if (!hasCached) {
      cached = lookup();
      hasCached = true;
    }
    if (cb) {
      process.nextTick(cb.bind(null, null, cached));
    }
    return cached;
  };
}

memo('user', () => {
  if (!isWindows) {
    return process.env.USER;
  }
  return [process.env.USERDOMAIN, process.env.USERNAME].filter(Boolean).join('\\');
});

memo('prompt', () => isWindows ? process.env.PROMPT : process.env.PS1);
memo('hostname', () => isWindows ? process.env.COMPUTERNAME : (process.env.HOSTNAME || os.hostname()));
memo('tmpdir', () => os.tmpdir());
memo('home', () => os.homedir());
memo('path', () => String(process.env.PATH || process.env.Path || process.env.path || '').split(isWindows ? ';' : ':').filter(Boolean));
memo('editor', () => process.env.EDITOR || process.env.VISUAL || (isWindows ? 'notepad.exe' : 'vi'));
memo('shell', () => isWindows ? (process.env.ComSpec || 'cmd') : (process.env.SHELL || 'bash'));
