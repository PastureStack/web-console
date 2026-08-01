import {
  setComponentTemplate
} from '@ember/component';
import LegacyContextPartial from 'ui/components/legacy-context-partial/component';

export const LEGACY_CONTEXT_PARTIALS = [
  'alias-service-addtl-info',
  'ext-service-addtl-info',
  'host-add-common',
  'host-add-options',
  'ldap-config',
  'mfa-self-service',
  'mfa-status-summary',
  'oidc-identity-mapping',
  'service-addtl-info-content',
  'shibboleth-config',
  'shibboleth-configured',
  'tooltip-content-action-menu',
  'tooltip-content-basic',
  'tooltip-content-basic-literal',
  'tooltip-content-container-subpod',
  'tooltip-content-cpu',
  'tooltip-content-select-dot',
  'tooltip-content-snapshot-timeline',
  'tooltip-content-static',
  'tooltip-content-storage'
];

export function registerLegacyContextPartials(application, moduleEntries, loadModule, setTemplate) {
  LEGACY_CONTEXT_PARTIALS.forEach((name) => {
    let templateName = `ui/components/${name}/template`;

    if (!moduleEntries || !moduleEntries[templateName]) {
      throw new Error(`Legacy context component template is missing: ${templateName}`);
    }

    let template = loadModule(templateName).default;
    let ComponentClass = LegacyContextPartial.extend({});

    setTemplate(template, ComponentClass);
    application.register(`component:${name}`, ComponentClass);
  });
}

export function initialize(application) {
  let moduleEntries = globalThis.requirejs && globalThis.requirejs.entries;
  let loadModule = globalThis.require;

  if (!moduleEntries || typeof loadModule !== 'function') {
    return;
  }

  registerLegacyContextPartials(
    application,
    moduleEntries,
    loadModule,
    setComponentTemplate
  );
}

export default {
  name: 'legacy-context-partials',
  initialize
};
