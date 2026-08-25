import EmberObject from '@ember/object';
import { isArray } from '@ember/array';
import { hash } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function(params/*, transition*/) {
    var store = this.get('store');

    var dependencies = {
      allHosts: store.findAll('host'), // Need inactive ones in case a link points to an inactive host
      allStorageDrivers: store.findAll('storageDriver'),
      allStoragePools: store.findAll('storagePool'),
      allVolumes: store.findAll('volume'),
      allServices: store.findAll('service'),
    };

    if ( params.containerId )
    {
      dependencies.existing = store.find('container', params.containerId, {include: ['ports','instanceLinks']});
    }

    return hash(dependencies, 'Load container dependencies').then(function(results) {

      var data, healthCheckData;
      if ( results.existing )
      {
        data = results.existing.serializeForNew();
        data.ports = (data.ports||[]).map((port) => {
          delete port.id;
          return port;
        });

        if ( isArray(data.instanceLinks) )
        {
          data.instanceLinks = (data.instanceLinks||[]).map((link) => {
            delete link.id;
            return link;
          });
        }

        if ( !data.environment )
        {
          data.environment = {};
        }

        healthCheckData = data.healthCheck;
        delete data.healthCheck;
      }
      else
      {
        data = {
          type: 'container',
          requestedHostId: params.hostId,
          tty: true,
          stdinOpen: true,
        };
      }

      var instance = store.createRecord(data);
      if ( healthCheckData )
      {
        // The type isn't set on an existing one
        healthCheckData.type = 'instanceHealthCheck';
        instance.set('healthCheck', store.createRecord(healthCheckData));
      }

      return EmberObject.create({
        instance: instance,
        allHosts: results.allHosts,
        allStorageDrivers: results.allStorageDrivers,
        allStoragePools: results.allStoragePools,
        allVolumes: results.allVolumes,
        allServices: results.allServices,
      });
    });
  },

  resetController: function (controller, isExiting/*, transition*/) {
    if (isExiting)
    {
      controller.set('hostId', null);
      controller.set('stackId', null);
      controller.set('containerId', null);
    }
  }
});
