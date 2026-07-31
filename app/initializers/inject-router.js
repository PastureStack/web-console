import Component from '@ember/component';
import Resource from 'ember-api-store/models/resource';
import ownerLookup from 'ui/utils/owner-lookup';

export function initialize() {
  const router = ownerLookup('router:main');

  Component.reopen({ router });
  Resource.reopen({ router });
}

export default {
  name: 'inject-router',
  initialize: initialize
};
