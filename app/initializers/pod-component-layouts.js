import {
  getComponentTemplate,
  setComponentTemplate
} from '@ember/component';

const COMPONENT_PREFIX = 'ui/components/';
const COMPONENT_SUFFIX = '/component';
const TEMPLATE_SUFFIX = '/template';

export function associatePodComponentLayouts(moduleEntries, loadModule, getTemplate, setTemplate) {
  let associated = 0;

  Object.keys(moduleEntries || {}).forEach((moduleName) => {
    if (!moduleName.startsWith(COMPONENT_PREFIX) || !moduleName.endsWith(COMPONENT_SUFFIX)) {
      return;
    }

    let templateName = moduleName.slice(0, -COMPONENT_SUFFIX.length) + TEMPLATE_SUFFIX;
    if (!moduleEntries[templateName]) {
      return;
    }

    let component = loadModule(moduleName).default;
    let template = loadModule(templateName).default;
    if (!component || !template) {
      return;
    }

    let currentTemplate = getTemplate(component);
    if (!currentTemplate) {
      setTemplate(template, component);
      associated += 1;
    }
  });

  return associated;
}

export function initialize() {
  let moduleEntries = globalThis.requirejs && globalThis.requirejs.entries;
  let loadModule = globalThis.require;

  if (!moduleEntries || typeof loadModule !== 'function') {
    return;
  }

  associatePodComponentLayouts(
    moduleEntries,
    loadModule,
    getComponentTemplate,
    setComponentTemplate
  );
}

export default {
  name: 'pod-component-layouts',
  initialize
};
