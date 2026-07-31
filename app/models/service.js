import EmberObject, { computed } from '@ember/object';
import { cancel, later } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Resource from 'ember-api-store/models/resource';
import C from 'ui/utils/constants';
import Util from 'ui/utils/util';
import { denormalizeId, denormalizeIdArray } from 'ember-api-store/utils/denormalize';

var Service = Resource.extend({
  type: 'service',
  intl: service(),
  growl: service(),
  modalService: service('modal'),

  instances: denormalizeIdArray('instanceIds'),
  instanceCount: alias('instances.length'),
  projectId: alias(`tab-session.${C.TABSESSION.PROJECT}`),
  stack: denormalizeId('stackId'),

  actions: {
    edit() {
      var type = this.get('type').toLowerCase();
      if ( type === 'dnsservice' )
      {
        this.get('modalService').toggleModal('edit-aliasservice', this);
      }
      else if ( type === 'externalservice' )
      {
        this.get('modalService').toggleModal('edit-externalservice', this);
      }
      else
      {
        this.get('modalService').toggleModal('edit-service', this);
      }
    },

    activate() {
      return this.doAction('activate');
    },

    deactivate() {
      return this.doAction('deactivate');
    },

    restart() {
      return this.doAction('restart', {rollingRestartStrategy: {}});
    },

    cancelUpgrade() {
      return this.doAction('cancelupgrade');
    },

    cancelRollback() {
      return this.doAction('cancelrollback');
    },

    finishUpgrade() {
      return this.doAction('finishupgrade');
    },

    rollback() {
      return this.doAction('rollback');
    },

    promptStop: function() {
      this.get('modalService').toggleModal('modal-confirm-deactivate', {
        originalModel: this,
        action: 'deactivate'
      });
    },

    scaleUp() {
      this.incrementProperty('scale');
      this.saveScale();
    },

    scaleDown() {
      if ( this.get('scale') >= 1 )
      {
        this.decrementProperty('scale');
        this.saveScale();
      }
    },

    upgrade(upgradeImage='false') {
      var route = 'service.new';
      if ( (this.get('launchConfig.kind')||'').toLowerCase() === 'virtualmachine') {
        route = 'service.new-virtualmachine';
      } else if ( this.get('type').toLowerCase() === 'loadbalancerservice' ) {
        route = 'service.new-balancer';
      }

      this.get('application').transitionToRoute(route, {queryParams: {
        serviceId: this.get('id'),
        upgrade: true,
        upgradeImage: upgradeImage,
        stackId: this.get('stackId'),
      }});
    },

    clone() {
      var route;
      switch ( this.get('type').toLowerCase() )
      {
        case 'service':
          if ( (this.get('launchConfig.kind')||'').toLowerCase() === 'virtualmachine')
          {
            route = 'service.new-virtualmachine';
          }
          else
          {
            route = 'service.new';
          }
          break;
        case 'dnsservice':          route = 'service.new-alias';    break;
        case 'loadbalancerservice': route = 'service.new-balancer'; break;
        case 'externalservice':     route = 'service.new-external'; break;
        default: return void this.send('error','Unknown service type: ' + this.get('type'));
      }

      this.get('application').transitionToRoute(route, {queryParams: {
        serviceId: this.get('id'),
        stackId: this.get('stackId'),
      }});
    },
  },

  scaleTimer: null,
  saveScale() {
    if ( this.get('scaleTimer') )
    {
      cancel(this.get('scaleTimer'));
    }

    var timer = later(this, function() {
      this.save().catch((err) => {
        this.get('growl').fromError('Error updating scale',err);
      });
    }, 500);

    this.set('scaleTimer', timer);
  },

  availableActions: computed(
    'actionLinks.{activate,deactivate,restart,update,remove,purge,finishupgrade,cancelupgrade,rollback,cancelrollback}',
    'type',
    'isK8s',
    'isSwarm',
    'canHaveContainers',
    'canUpgrade',
    'isBalancer',
    function() {
      var a = this.get('actionLinks');

      var canUpgrade = this.get('canUpgrade');
      var isK8s = this.get('isK8s');
      var isSwarm = this.get('isSwarm');
      var canHaveContainers = this.get('canHaveContainers');
      var isBalancer = this.get('isBalancer');
      var isDriver = ['networkdriverservice','storagedriverservice'].includes(this.get('type').toLowerCase());

      var choices = [
        { label: 'action.start',          icon: 'icon icon-play',             action: 'activate',       enabled: !!a.activate},
        { label: 'action.finishUpgrade',  icon: 'icon icon-success',          action: 'finishUpgrade',  enabled: !!a.finishupgrade },
        { label: (isBalancer ? 'action.upgradeOrEdit' : 'action.upgrade'),        icon: 'icon icon-arrow-circle-up',  action: 'upgrade',        enabled: canUpgrade },
        { label: 'action.rollback',       icon: 'icon icon-history',          action: 'rollback',       enabled: !!a.rollback },
        { label: 'action.cancelUpgrade',  icon: 'icon icon-life-ring',        action: 'cancelUpgrade',  enabled: !!a.cancelupgrade },
        { label: 'action.cancelRollback', icon: 'icon icon-life-ring',        action: 'cancelRollback', enabled: !!a.cancelrollback },
        { divider: true },
        { label: 'action.restart',        icon: 'icon icon-refresh'    ,      action: 'restart',        enabled: !!a.restart && canHaveContainers },
        { label: 'action.stop',           icon: 'icon icon-stop',             action: 'promptStop',     enabled: !!a.deactivate, altAction: 'deactivate'},
        { label: 'action.remove',         icon: 'icon icon-trash',            action: 'promptDelete',   enabled: !!a.remove, altAction: 'delete'},
        { label: 'action.purge',          icon: '',                           action: 'purge',          enabled: !!a.purge},
        { divider: true },
        { label: 'action.viewInApi',      icon: 'icon icon-external-link',    action: 'goToApi',        enabled: true },
        { label: 'action.clone',          icon: 'icon icon-copy',             action: 'clone',          enabled: !isK8s && !isSwarm && !isDriver },
        { label: 'action.edit',           icon: 'icon icon-edit',             action: 'edit',           enabled: !!a.update && !isK8s && !isSwarm && !isBalancer},
      ];

      return choices;
    }
  ),


  serviceLinks: null, // Used for clone
  reservedKeys: [
    'serviceLinks',
  ],

  init() {
    this._super();
  },

  displayStack: computed('stack.displayName', function() {
    var stack = this.get('stack');
    if ( stack ) {
      return stack.get('displayName');
    } else {
      return '...';
    }
  }),

  consumedServicesWithNames: computed('linkedServices', function() {
    let store = this.get('store');
    let links = this.get('linkedServices')||{};
    let out = Object.keys(links).map((key) => {
      let name = key;
      let pos = name.indexOf('/');
      if ( pos >= 0 ) {
        name = name.substr(pos+1);
      }
      const id = links[key];
      const service = store.getById('service', id);
      return EmberObject.create({
        name: name,
        service: service ? service : EmberObject.create({
          name: id,
          id: id,
          arbitraryString: true,
        })
      });
    });

    return out.sortBy('name');
  }),

  combinedState: computed('state', 'healthState', function() {
    var service = this.get('state');
    var health = this.get('healthState');

    if ( ['active','updating-active'].indexOf(service) === -1 )
    {
      // If the service isn't active, return its state
      return service;
    }

    if ( health === 'healthy' )
    {
      return service;
    }
    else
    {
      return health;
    }
  }),

  isGlobalScale: computed('launchConfig.labels', function() {
    return (this.get('launchConfig.labels')||{})[C.LABEL.SCHED_GLOBAL] + '' === 'true';
  }),

  canScale: computed('isReal', 'isGlobalScale', function() {
    if ( this.get('isReal') )
    {
      return !this.get('isGlobalScale');
    }
    else
    {
      return false;
    }
  }),

  canHaveContainers: computed('isReal', 'type', function() {
    if ( this.get('isReal') ) {
      return true;
    }

    return [
      'kubernetesservice',
      'composeservice',
    ].includes(this.get('type').toLowerCase());
  }),

  isReal: computed('type', function() {
    return [
      'service',
      'scalinggroup',
      'networkdriverservice',
      'storagedriverservice',
      'loadbalancerservice',
    ].includes(this.get('type').toLowerCase());
  }),

  hasPorts: alias('isReal'),
  hasImage: alias('isReal'),
  hasLabels: alias('isReal'),

  canUpgrade: computed('isReal', 'actionLinks.upgrade', function() {
    return this.get('isReal') && !!this.get('actionLinks.upgrade');
  }),

  isBalancer: computed('type', function() {
    return ['loadbalancerservice'].indexOf(this.get('type').toLowerCase()) >= 0;
  }),

  canBalanceTo: computed('type', 'hostname', function() {
    if ( this.get('type').toLowerCase() === 'externalservice' && this.get('hostname') !== null) {
      return false;
    }

    return true;
  }),

  isK8s: computed('type', function() {
    return ['kubernetesservice'].indexOf(this.get('type').toLowerCase()) >= 0;
  }),

  isSwarm: computed('type', function() {
    return ['composeservice'].indexOf(this.get('type').toLowerCase()) >= 0;
  }),

  displayType: computed('type', 'intl._locale', function() {
    let known = [
      'loadbalancerservice',
      'dnsservice',
      'externalservice',
      'kubernetesservice',
      'composeservice',
      'networkdriverservice',
      'storagedriverservice',
      'service',
      'scalinggroup'
    ];

    let type = this.get('type').toLowerCase();
    if ( !known.includes(type) ) {
      type = 'service';
    }

    return this.get('intl').t('servicePage.type.'+ type);
  }),

  hasSidekicks: computed('secondaryLaunchConfigs.length', function() {
    return this.get('secondaryLaunchConfigs.length') > 0;
  }),

  displayDetail: computed('launchConfig.imageUuid', 'intl._locale', function() {
    let translation = this.get('intl').findTranslationByKey('generic.image');
    translation = this.get('intl').formatMessage(translation);
      return htmlSafe('<label>'+ translation +': </label><span>' + (this.get('launchConfig.imageUuid')||'').replace(/^docker:/,'') + '</span>');
  }),


  activeIcon: computed('type', function() {
    return activeIcon(this);
  }),

  endpointsMap: computed('publicEndpoints.@each.{ipAddress,port}', function() {
    var out = {};
    (this.get('publicEndpoints')||[]).forEach((endpoint) => {
      if ( !endpoint.port )
      {
        // Skip nulls
        return;
      }

      if ( out[endpoint.port] )
      {
        out[endpoint.port].push(endpoint.ipAddress);
      }
      else
      {
        out[endpoint.port] = [endpoint.ipAddress];
      }
    });

    return out;
  }),

  endpointsByPort: computed('endpointsMap', function() {
    var out = [];
    var map = this.get('endpointsMap');
    Object.keys(map).forEach((key) => {
      out.push({
        port: parseInt(key,10),
        ipAddresses: map[key]
      });
    });

    return out;
  }),

  displayPorts: computed('endpointsByPort.@each.{port,ipAddresses}', 'intl._locale', function() {
    var pub = '';

    this.get('endpointsByPort').forEach((obj) => {
      var url = Util.constructUrl(false, obj.ipAddresses[0], obj.port);
      pub += '<span>' +
        '<a href="'+ url +'" target="_blank">' +
          obj.port +
        '</a>,' +
      '</span> ';
    });

    // Remove last comma
    pub = pub.replace(/,([^,]*)$/,'$1');


    if ( pub )
    {
      let out = this.get('intl').findTranslationByKey('generic.ports');
      out = this.get('intl').formatMessage(out);
      return htmlSafe('<label>'+out+': </label>' + pub);
    }
    else
    {
      return '';
    }
  }),

  memoryReservationBlurb: computed('launchConfig.memoryReservation', function() {
    if ( this.get('launchConfig.memoryReservation') ) {
      return Util.formatSi(this.get('launchConfig.memoryReservation'), 1024, 'iB', 'B');
    }
  }),

  localizedServiceUILabel: computed('launchConfig.labels', 'intl._locale', function(){
    let labels = this.get('launchConfig.labels');
    if(!labels){
      return;
    }
    let serviceUILabel = labels[C.LABEL.SERVICE_UI_LABEL] || '';
    let serviceName = this.get('name');
    if(!serviceUILabel){
      return;
    }
    let language = this.get('intl._locale')[0];
    let localizedLabel = '';
    // if the label is not a valid JSON map, default to use the service name.
    try{
      serviceUILabel = JSON.parse(serviceUILabel);
      // if the label is not a Object, just use service name as label
      if(serviceUILabel.constructor !== Object){
        console.warn(`${C.LABEL.SERVICE_UI_LABEL} in ${serviceName} is not a JSON map`);
        return this.get('name');
      }
      localizedLabel = serviceUILabel[Object.keys(serviceUILabel)[0]];
      if(serviceUILabel[language]){
        localizedLabel = serviceUILabel[language];
      }
    }
    catch(err){
      console.warn(`${C.LABEL.SERVICE_UI_LABEL} in ${serviceName} is not valid`);
      localizedLabel = this.get('name');
    }
    return localizedLabel;
  }),

  serviceApp: computed('name', 'launchConfig.labels', 'localizedServiceUILabel', function(){
    let labels = this.get('launchConfig.labels');
    if(!labels){
      return null;
    }
    let serviceName = this.get('name');
    let serviceUIPath = labels[C.LABEL.SERVICE_UI_PATH] || '/';
    let serviceUIPort = labels[C.LABEL.SERVICE_UI_PORT] || '';
    let localizedServiceUILabel = this.get('localizedServiceUILabel');
    let url;
    if( localizedServiceUILabel ){
      url = `${window.location.origin}${this.get('app.magicEndpoint')}/projects/${this.get('projectId')}`;
      if(!serviceUIPort){
        url += `/${serviceName}${serviceUIPath}`;
      }else{
        url += `/${serviceName}:${serviceUIPort}${serviceUIPath}`;
      }
      return {
        label: localizedServiceUILabel,
        url: url
      };
    } else {
      return null;
    }
  }),
});

export function activeIcon(service)
{
  var out = 'icon icon-services';
  switch ( service.get('type').toLowerCase() )
  {
    case 'loadbalancerservice': out = 'icon icon-fork';    break;
    case 'dnsservice':          out = 'icon icon-compass'; break;
    case 'externalservice':     out = 'icon icon-cloud';   break;
    case 'kubernetesservice':   out = 'icon icon-kubernetes'; break;
    case 'composeservice':      out = 'icon icon-docker'; break;
  }

  return out;
}

Service.reopenClass({
  stateMap: {
    'active':             {icon: activeIcon,                  color: 'text-success'},
    'canceled-rollback':  {icon: 'icon icon-life-ring',       color: 'text-info'},
    'canceled-upgrade':   {icon: 'icon icon-life-ring',       color: 'text-info'},
    'canceling-rollback': {icon: 'icon icon-life-ring',       color: 'text-info'},
    'canceling-upgrade':  {icon: 'icon icon-life-ring',       color: 'text-info'},
    'finishing-upgrade':  {icon: 'icon icon-arrow-circle-up', color: 'text-info'},
    'rolling-back':       {icon: 'icon icon-history',         color: 'text-info'},
    'upgraded':           {icon: 'icon icon-arrow-circle-up', color: 'text-info'},
    'upgrading':          {icon: 'icon icon-arrow-circle-up', color: 'text-info'},
  }
});

export default Service;
