import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import EmberObject, { get } from '@ember/object';
import C from 'ui/utils/constants';
import { catalogVersionOptions } from 'ui/utils/catalog-version-options';

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

  parentRoute: 'catalog-tab',

  model: function(params/*, transition*/) {
    var store = this.get('store');

    var dependencies = {
      tpl: this.get('catalog').fetchTemplate(params.template),
    };

    if ( params.upgrade )
    {
      dependencies.upgrade = this.get('catalog').fetchTemplate(params.upgrade, true);
    }

    if ( params.stackId )
    {
      dependencies.stack = store.find('stack', params.stackId);
    }

    return hash(dependencies, 'Load dependencies').then((results) => {
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
