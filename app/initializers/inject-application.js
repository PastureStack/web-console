import Component from '@ember/component';
import Resource from 'ember-api-store/models/resource';
import ownerLookup from 'ui/utils/owner-lookup';

export function initialize() {
  Component.reopen({ application: ownerLookup('controller:application') });
  Resource.reopen({ application: ownerLookup('controller:application') });
}

export default {
  name: 'inject-application',
  initialize: initialize
};
