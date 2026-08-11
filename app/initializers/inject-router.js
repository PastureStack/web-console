import Component from '@ember/component';
import Controller from '@ember/controller';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';

function injectRouter(Factory) {
  Factory.reopen({ router: service('router') });
}

export function initialize() {
  injectRouter(Component);
  injectRouter(Controller);
  injectRouter(Route);
  injectRouter(Resource);
}

export default {
  name: 'inject-router',
  initialize: initialize
};
