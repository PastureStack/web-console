import { setOwner } from '@ember/application';

const nonInteractiveEnvironment = {isInteractive: false};
const testOwner = {
  lookup(name) {
    if ( name === '-environment:main' ) {
      return nonInteractiveEnvironment;
    }
  },
};

export default function componentWithTestOwner(ComponentClass) {
  return ComponentClass.extend({
    init() {
      setOwner(this, testOwner);
      this._super(...arguments);
    },
  });
}
