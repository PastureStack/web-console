import Component from '@ember/component';
import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import Serializable from 'ember-api-store/mixins/serializable';

// Don't serialize the injected session
Serializable.reopen({
  reservedKeys: ['session'],
});

export function initialize() {
  Controller.reopen({
    session: service('session'),
    'tab-session': service('tab-session'),
  });
  Route.reopen({
    session: service('session'),
    'tab-session': service('tab-session'),
  });
  Component.reopen({
    session: service('session'),
    'tab-session': service('tab-session'),
  });
  Resource.reopen({
    session: service('session'),
    'tab-session': service('tab-session'),
  });
}

export default {
  name: 'session',
  initialize: initialize
};
