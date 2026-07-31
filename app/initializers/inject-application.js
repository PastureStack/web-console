import Component from '@ember/component';
import Resource from 'ember-api-store/models/resource';
import ownerLookup from 'ui/utils/owner-lookup';

export function initialize() {
  const application = ownerLookup('controller:application');

  Component.reopen({ application });
  Resource.reopen({ application });
}

export default {
  name: 'inject-application',
  initialize: initialize
};
