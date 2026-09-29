import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import EmberObject, { get } from '@ember/object';
import C from 'ui/utils/constants';
import { catalogVersionOptions } from 'ui/utils/catalog-version-options';
import Errors from 'ui/utils/errors';

function resourceValue(resource, path) {
  if ( !resource ) {
    return undefined;
  }

  if ( typeof resource.get === 'function' ) {
    return resource.get(path);
  }

  return get(resource, path);
}

export default Route.extend({
  catalog: service(),
  intl: service(),
  projects: service(),

  parentRoute: 'catalog-tab',

  unavailable(key, status=403) {
    return {status, code: status === 404 ? 'NotFound' : 'Forbidden', messageKey: key, message: this.get('intl').t(key)};
  },

  fetchTemplate(id, upgrade=false) {
    return this.get('catalog').fetchTemplate(id, upgrade).catch((err) => {
      let status = Errors.status(err);
      if ( status === 403 || status === 404 ) {
        throw this.unavailable(upgrade ? 'newCatalog.upgradeUnavailable' : 'newCatalog.templateUnavailable', 404);
      }
      throw err;
    });
  },

  model: function(params/*, transition*/) {
    var store = this.get('store');
    let projectId = this.get('projects.current.id');

    if ( !params.stackId && !this.get('projects').canCreateResource('stack') ) {
      throw this.unavailable('newCatalog.permissionDenied');
    }
    if ( params.upgrade && !params.stackId ) {
      throw this.unavailable('newCatalog.upgradeUnavailable');
    }

    var dependencies = {
      tpl: this.fetchTemplate(params.template),
    };

    if ( params.upgrade )
    {
      dependencies.upgrade = this.fetchTemplate(params.upgrade, true);
    }

    if ( params.stackId )
    {
      dependencies.stack = store.find('stack', params.stackId).catch((err) => {
        let status = Errors.status(err);
        if ( status === 403 || status === 404 ) {
          throw this.unavailable('resourceLoadError.stackUnavailable', 404);
        }
        throw err;
      });
    }

    return hash(dependencies, 'Load dependencies').then((results) => {
      if ( results.stack && !resourceValue(results.stack, 'actionLinks.upgrade') ) {
        throw this.unavailable('newCatalog.upgradeUnavailable');
      }

      if ( !results.stack )
      {
        results.stack = store.createRecord({
          type: 'stack',
          name: results.tpl.get('defaultName'),
          startOnCreate: true,
          system: (results.tpl.get('templateBase') === C.EXTERNAL_ID.KIND_INFRA),
          environment: {}, // Question answers
        });
      }

      var links;
      if ( results.upgrade )
      {
        links = resourceValue(results.upgrade, 'upgradeVersionLinks') || {};
      }
      else
      {
        links = resourceValue(results.tpl, 'versionLinks') || {};
      }

      let currentOption = results.upgrade ? {
        version: `${resourceValue(results.upgrade, 'version')} (current)`,
        link: resourceValue(results.upgrade, 'links.self'),
      } : null;
      let verArr = catalogVersionOptions(links, currentOption);

      return EmberObject.create({
        projectId,
        stack: results.stack,
        tpl: results.tpl,
        upgrade: results.upgrade,
        versionLinks: links,
        versionsArray: verArr,
        allTemplates: this.modelFor(this.get('parentRoute')).get('catalog'),
        templateBase: this.modelFor(this.get('parentRoute')).get('templateBase'),
      });
    });
  },

  resetController: function (controller, isExiting/*, transition*/) {
    if (isExiting)
    {
      controller.set('stackId', null);
      controller.set('upgrade', null);
    }
  }
});
