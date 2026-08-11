import Resource from 'ember-api-store/models/resource';

// The control API exposes a writable provider displayName.  The shared
// Resource mixin also defines a read-only computed displayName for ordinary
// infrastructure resources, so this embedded configuration model must own a
// plain writable field of its own.
export default Resource.extend({
  displayName: null,
});
