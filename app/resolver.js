import { getComponentTemplate, setComponentTemplate } from '@ember/component';
import EmberResolver from 'ember-resolver';

export default class Resolver extends EmberResolver {
  resolveComponent(parsedName) {
    let component = this.resolveOther(parsedName);

    if ( component && !getComponentTemplate(component) ) {
      let template = this.resolve(`template:components/${parsedName.fullNameWithoutType}`);

      if ( template ) {
        setComponentTemplate(template, component);
      }
    }

    return component;
  }
}
