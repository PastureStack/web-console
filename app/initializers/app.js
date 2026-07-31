import Component from '@ember/component';
import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import Service from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import ownerLookup from 'ui/utils/owner-lookup';
import ShortcutManager from 'ui/utils/shortcut-manager';

export function initialize(application) {
  application.register('shortcuts:main', ShortcutManager);

  Controller.reopen({ app: ownerLookup('application:main') });
  Route.reopen({
    app: ownerLookup('application:main'),
    shortcutManager: ownerLookup('shortcuts:main'),
  });
  Component.reopen({
    app: ownerLookup('application:main'),
    shortcuts: ownerLookup('shortcuts:main'),
  });
  Service.reopen({ app: ownerLookup('application:main') });
  Resource.reopen({ app: ownerLookup('application:main') });
}

export default {
  name: 'app',
  initialize: initialize
};
