import Ember from 'ember';

let nextSubjectId = 0;
let TestResolver = Ember.Object.extend({
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

  let application = Ember.Application.create({
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

  Ember.run(() => {
    if (context) {
      context.owner.destroy();
      context.application.destroy();
    } else if (subject) {
      subject.destroy();
    }
  });
}
