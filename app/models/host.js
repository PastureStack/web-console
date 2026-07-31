import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Util from 'ui/utils/util';
import Resource from 'ember-api-store/models/resource';
import { formatMib, formatSi } from 'ui/utils/util';
import C from 'ui/utils/constants';
import { denormalizeIdArray } from 'ember-api-store/utils/denormalize';
import { satisfies, compare } from 'ui/utils/parse-version';

var Host = Resource.extend({
  type: 'host',
  modalService: service('modal'),
  settings: service(),

  instances: denormalizeIdArray('instanceIds'),
  arrangedInstances: computed('instances.@each.{isSystem,displayName}', function() {
    return this.get('instances').sortBy('isSystem','displayName');
  }),

  actions: {
    activate: function() {
      return this.doAction('activate');
    },

    deactivate: function() {
      return this.doAction('deactivate');
    },

    promptEvacuate: function() {
      this.get('modalService').toggleModal('modal-host-evacuate', {
        model: [this]
      });
    },

    evacuate: function() {
      return this.doAction('evacuate');
    },

    purge: function() {
      return this.doAction('purge');
    },

    newContainer: function() {
      this.get('application').transitionToRoute('containers.new', {queryParams: {hostId: this.get('model.id')}});
    },

    clone: function() {
      this.get('application').transitionToRoute('hosts.new', {queryParams: {hostId: this.get('id'), driver: this.get('driver')}});
    },

    edit: function() {
      this.get('modalService').toggleModal('edit-host', this);
    },

    machineConfig: function() {
      var url = this.linkFor('config');
      if ( url )
      {
        Util.download(url);
      }
    }
  },

  availableActions: computed(
    'actionLinks.{activate,deactivate,evacuate,remove,purge,update}',
    'links.config',
    'driver',
    function() {
      var a = this.get('actionLinks');

      var out = [
        { label: 'action.activate',   icon: 'icon icon-play',         action: 'activate',      enabled: !!a.activate},
        { label: 'action.deactivate', icon: 'icon icon-pause',        action: 'deactivate',    enabled: !!a.deactivate},
        { label: 'action.evacuate',   icon: 'icon icon-snapshot',     action: 'promptEvacuate',enabled: !!a.evacuate, altAction: 'evacuate'},
        { label: 'action.remove',     icon: 'icon icon-trash',        action: 'promptDelete',  enabled: !!a.remove, altAction: 'delete'},
        { label: 'action.purge',      icon: '',                       action: 'purge',         enabled: !!a.purge},
        { divider: true },
        { label: 'action.viewInApi',  icon: 'icon icon-external-link',action: 'goToApi',      enabled: true},
      ];

      if ( this.get('links.config') )
      {
        out.push({ label: 'action.machineConfig', icon: 'icon icon-download', action: 'machineConfig', enabled: true});
      }

      out.push({ label: 'action.clone', icon: 'icon icon-copy', action: 'clone', enabled: !!this.get('driver') });
      out.push({ label: 'action.edit', icon: 'icon icon-edit', action: 'edit', enabled: !!a.update });

      return out;
    }
  ),

  displayIp: alias('agentIpAddress'),

  displayName: computed('name', 'hostname', 'id', function() {
    return this.get('name') || this.get('hostname') || '('+this.get('id')+')';
  }),

  osBlurb: computed('info.osInfo.operatingSystem', 'labels', function() {
    var out = this.get('info.osInfo.operatingSystem')||'';

    out = out.replace(/\s+\(.*?\)/,''); // Remove details in parens
    out = out.replace(/;.*$/,''); // Or after semicolons
    out = out.replace('Red Hat Enterprise Linux Server','RHEL'); // That's kinda long

    var hasKvm = (this.get('labels')||{})[C.LABEL.KVM] === 'true';
    if ( hasKvm && out )
    {
      out += ' (with KVM)';
    }

    return out;
  }),

  osDetail: alias('info.osInfo.operatingSystem'),

  dockerEngineVersion: computed('info.osInfo.dockerVersion', function() {
    if ( this.get('info.osInfo') )
    {
      return (this.get('info.osInfo.dockerVersion')||'').replace(/^Docker version\s*/i,'').replace(/,.*/,'');
    }
  }),

  supportState: computed(
    'dockerEngineVersion',
    `settings.${C.SETTING.SUPPORTED_DOCKER}`,
    `settings.${C.SETTING.NEWEST_DOCKER}`,
    function() {
      let my = this.get('dockerEngineVersion')||'';
      my = my.replace(/-(cs|ce|ee)[0-9.-]*$/,'');

      let supported = this.get(`settings.${C.SETTING.SUPPORTED_DOCKER}`);
      let newest = this.get(`settings.${C.SETTING.NEWEST_DOCKER}`);

      if ( !my || !supported || !newest) {
        return 'unknown';
      } else if ( satisfies(my, supported) ) {
        return 'supported';
      } else if ( compare(my, newest) > 0 ) {
        return 'untested';
      } else {
        return 'unsupported';
      }
    }
  ),

  dockerDetail: alias('info.osInfo.operatingSystem'),

  kernelBlurb: computed('info.osInfo.kernelVersion', function() {
    if ( this.get('info.osInfo') )
    {
      return (this.get('info.osInfo.kernelVersion')||'');
    }
  }),

  cpuBlurb: computed('info.cpuInfo.{count,mhz}', function() {
    if ( this.get('info.cpuInfo.count') )
    {
      var ghz = Math.round(this.get('info.cpuInfo.mhz')/10)/100;

      if ( this.get('info.cpuInfo.count') > 1 )
      {
        return this.get('info.cpuInfo.count')+'x' + ghz + ' GHz';
      }
      else
      {
        return ghz + ' GHz';
      }
    }
  }),

  cpuTooltip: alias('info.cpuInfo.modelName'),

  memoryBlurb: computed('info.memoryInfo.memTotal', function() {
    if ( this.get('info.memoryInfo') )
    {
      return formatMib(this.get('info.memoryInfo.memTotal'));
    }
  }),

  memoryLimitBlurb: computed('memory', function() {
    if ( this.get('memory') )
    {
      return formatSi(this.get('memory'), 1024, 'iB', 'B');
    }
  }),

  localStorageBlurb: computed('localStorageMb', function() {
    if (this.get('localStorageMb')) {
      return formatSi(this.get('localStorageMb'), 1024, 'iB', 'B', 2 /*start at 1024^2==MB */);
    }
  }),

  diskBlurb: computed(
    'info.diskInfo.mountPoints.@each.total',
    'info.diskInfo.fileSystems.@each.capacity',
    function() {
      var totalMb = 0;

      // New hotness
      if ( this.get('info.diskInfo.fileSystems') )
      {
        var fses = this.get('info.diskInfo.fileSystems')||[];
        Object.keys(fses).forEach((fs) => {
          totalMb += fses[fs].capacity;
        });

        return formatMib(totalMb);
      }
      else if ( this.get('info.diskInfo.mountPoints') )
      {
        // Old & busted
        var mounts = this.get('info.diskInfo.mountPoints')||[];
        Object.keys(mounts).forEach((mountPoint) => {
          totalMb += mounts[mountPoint].total;
        });

        return formatMib(totalMb);
      }
    }
  ),

  diskDetail: computed('info.diskInfo.fileSystems.@each.capacity', function() {
    // New hotness
    if ( this.get('info.diskInfo.fileSystems') )
    {
      var out = [];
      var fses = this.get('info.diskInfo.fileSystems')||[];
      Object.keys(fses).forEach((fs) => {
        out.pushObject(EmberObject.create({label: fs, value: formatMib(fses[fs].capacity)}));
      });

      return out;
    }
  }),

  // If you use this you must ensure that services and containers are already in the store
  //  or they will not be pulled in correctly.
  displayEndpoints: computed(
    'publicEndpoints.@each.{ipAddress,port,serviceId,instanceId}',
    function() {
      var store = this.get('store');
      return (this.get('publicEndpoints')||[]).map((endpoint) => {
        if ( !endpoint.service ) {
          endpoint.service = store.getById('service', endpoint.serviceId);
        }

        endpoint.instance = store.getById('instance', endpoint.instanceId);
        return endpoint;
      });
    }
  ),

  requireAnyLabels: computed(`labels.${C.LABEL.REQUIRE_ANY}`, function() {
    return  ((this.get('labels')||{})[C.LABEL.REQUIRE_ANY]||'').split(/\s*,\s*/).filter((x) => x.length > 0);
  }),
});

Host.reopenClass({
  defaultSortBy: 'name,hostname',
  stateMap: {
    'active':           {icon: 'icon icon-host',    color: 'text-success'},
    'provisioning':     {icon: 'icon icon-host',    color: 'text-info'},
    'reconnecting':     {icon: 'icon icon-help',    color: 'text-danger'},
  }
});

export default Host;
