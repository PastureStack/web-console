import { getOwner } from '@ember/application';
import { computed } from '@ember/object';

// Replacement for the Registry#inject API removed from modern Ember.  These
// values are stable application singletons, so a read-only computed lookup is
// appropriate and keeps the legacy property names available to classic code.
export default function ownerLookup(fullName) {
  return computed(function() {
    let owner = getOwner(this);

    return owner ? owner.lookup(fullName) : undefined;
  }).readOnly();
}
