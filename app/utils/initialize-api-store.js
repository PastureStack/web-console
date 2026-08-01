import Component from '@ember/component';
import Controller from '@ember/controller';
import { getOwner, setOwner } from '@ember/application';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import Collection from 'ember-api-store/models/collection';
import ApiError from 'ember-api-store/models/error';
import Resource from 'ember-api-store/models/resource';
import Schema from 'ember-api-store/models/schema';
import Store from 'ember-api-store/services/store';

let storeOwnerCompatibilityInstalled = false;

export function adoptStoreOwner(instance, store) {
  let owner = store && getOwner(store);

  if (instance && owner && getOwner(instance) !== owner) {
    setOwner(instance, owner);
  }

  return instance;
}

function installStoreOwnerCompatibility() {
  if (storeOwnerCompatibilityInstalled) {
    return;
  }

  storeOwnerCompatibilityInstalled = true;
  Store.reopen({
    createRecord() {
      return adoptStoreOwner(this._super(...arguments), this);
    },

    createCollection() {
      return adoptStoreOwner(this._super(...arguments), this);
    },

    _bulkAdd(type) {
      let result = this._super(...arguments);

      this._group(type).forEach((instance) => adoptStoreOwner(instance, this));

      return result;
    },
  });
}

function injectService(Factory, propertyName, serviceName) {
  let properties = {};

  // Create a separate descriptor for every class. Ember consumes descriptors
  // while reopening a class, so sharing one instance is not safe.
  properties[propertyName] = service(serviceName);
  Factory.reopen(properties);
}

// ember-api-store 2.8.5 still calls the Registry#inject API removed in Ember
// 6. Keep its public store/model contract while performing injection through
// supported service descriptors on the classic application base classes.
export default function initializeApiStore(serviceName = 'store', injectAs = null) {
  let propertyName = injectAs || serviceName;

  return function initialize(application) {
    installStoreOwnerCompatibility();
    application.register(`service:${serviceName}`, Store);

    if ( !application.hasRegistration('model:resource') ) {
      application.register('model:resource', Resource);
      application.register('model:collection', Collection);
      application.register('model:schema', Schema);
      application.register('model:error', ApiError);
    }

    injectService(Controller, propertyName, serviceName);
    injectService(Route, propertyName, serviceName);
    injectService(Component, propertyName, serviceName);
  };
}
