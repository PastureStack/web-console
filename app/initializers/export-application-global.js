import { classify } from '@ember/string';
import config from '../config/environment';

function globalObject() {
  if (typeof window !== 'undefined') {
    return window;
  }

  if (typeof global !== 'undefined') {
    return global;
  }

  if (typeof self !== 'undefined') {
    return self;
  }
}

export function initialize() {
  let application = arguments[1] || arguments[0];

  if (config.exportApplicationGlobal === false) {
    return;
  }

  let target = globalObject();

  if (!target) {
    return;
  }

  let globalName = typeof config.exportApplicationGlobal === 'string' ?
    config.exportApplicationGlobal : classify(config.modulePrefix);

  if (!target[globalName]) {
    target[globalName] = application;

    application.reopen({
      willDestroy() {
        this._super(...arguments);
        delete target[globalName];
      },
    });
  }
}

export default {
  name: 'export-application-global',
  initialize,
};
