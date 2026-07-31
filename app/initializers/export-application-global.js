import config from 'ui/config/environment';

function classifyModulePrefix(value = '') {
  return value
    .split(/[-_.\s/]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

export function initialize(application) {
  if (config.exportApplicationGlobal === false || typeof window === 'undefined') {
    return;
  }

  const configuredName = config.exportApplicationGlobal;
  const globalName = typeof configuredName === 'string' ?
    configuredName :
    classifyModulePrefix(config.modulePrefix);

  if (!window[globalName]) {
    window[globalName] = application;
    application.reopen({
      willDestroy() {
        this._super(...arguments);
        if (window[globalName] === application) {
          delete window[globalName];
        }
      },
    });
  }
}

export default {
  name: 'export-application-global',
  initialize,
};
