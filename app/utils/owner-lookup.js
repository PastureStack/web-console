import { getOwner } from '@ember/application';
import { computed } from '@ember/object';

export default function ownerLookup(fullName) {
  return computed(function() {
    return getOwner(this).lookup(fullName);
  }).readOnly();
}
