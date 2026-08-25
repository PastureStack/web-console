import { run } from '@ember/runloop';
import Application from '@ember/application';
import EmberObject from '@ember/object';

let nextSubjectId = 0;
let TestResolver = EmberObject.extend({
  normalize(fullName) {
    return fullName;
  },

  resolve() {
    return undefined;
  },
});

export function createOwned(Factory, properties, type) {
  let OwnedFactory = Factory.extend(properties || {});

  if (type !== 'component') {
    return OwnedFactory.create();
  }

  let application = Application.create({
    autoboot: false,
    Resolver: TestResolver,
  });
  let fullName = `${type || 'service'}:test-subject-${++nextSubjectId}`;

  application.register('-environment:main', {isInteractive: false}, {instantiate: false});
  application.register(fullName, OwnedFactory);

  let owner = application.buildInstance();
  let subject = owner.lookup(fullName);

  Object.defineProperty(subject, '__testOwnerContext', {
    configurable: true,
    value: {application, owner},
  });

  return subject;
}

export function destroyOwned(subject) {
  let context = subject && subject.__testOwnerContext;

  run(() => {
    if (context) {
      context.owner.destroy();
      context.application.destroy();
    } else if (subject) {
      subject.destroy();
    }
  });
}
