import { isEmpty } from '@ember/utils';
import { observer, computed } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  projects: service(),

  // Inputs
  instance: null,
  classNameBindings: ['editing:component-editing:component-static'],
  editing: true,
  resourcesOnly: false,
  securityOnly: false,

  actions: {
    addDevice: function() {
      this.get('devicesArray').pushObject({host: '', container: '', permissions: 'rwm'});
    },

    removeDevice: function(obj) {
      this.get('devicesArray').removeObject(obj);
    },

    setLogDriver: function(driver) {
      this.set('instance.logConfig.driver', driver);
    },

    modifyCapabilities: function(type, select) {
      let options = Array.prototype.slice.call(select.target.options, 0);
      let selectedOptions = [];

      options.filterBy('selected', true).forEach((cap) => {
        return selectedOptions.push(cap.value);
      });

      this.set(`instance.${type}`, selectedOptions);
    },
  },

  init() {
    this._super(...arguments);

    if ( this.get('projects.current.isWindows') ) {
    } else {
      if ( !this.get('resourcesOnly') ) {
        this.initCapability();
        this.initPidMode();
      }
      if ( !this.get('securityOnly') ) {
        this.initDevices();
        this.initMemory();
      }
    }

    if ( !this.get('resourcesOnly') ) { this.initLogging(); }
  },

  didInsertElement() {
    if ( !this.get('resourcesOnly') && ! this.get('projects.current.isWindows') ) {
      this.initMultiselect();
      this.privilegedDidChange();
    }
  },

  // ----------------------------------
  // Capability
  // ----------------------------------
  capabilityChoices: null,
  initCapability: function() {
    this.set('instance.capAdd', this.get('instance.capAdd') || []);
    this.set('instance.capDrop', this.get('instance.capDrop') || []);
    var choices = this.get('store').getById('schema','container').get('resourceFields.capAdd').options.sort();
    this.set('capabilityChoices',choices);
  },

  // ----------------------------------
  // Memory
  // ----------------------------------
  memoryMb: null,
  memoryReservationMb: null,
  swapMb: null,
  initMemory: function() {
    this._initializingResources = true;
    var memBytes = this.get('instance.memory') || 0;
    var memPlusSwapBytes = this.get('instance.memorySwap') || 0;
    var memReservation = this.get('instance.memoryReservation');
    var swapBytes = Math.max(0, memPlusSwapBytes - memBytes);

    if (memReservation) {
      this.set('memoryReservationMb', parseInt(memReservation,10)/1048576);
    } else {
      this.set('memoryReservationMb', '');
    }
    if ( memBytes )
    {
      this.set('memoryMb', parseInt(memBytes,10)/1048576);
    }
    else
    {
      this.set('memoryMb','');
    }

    if ( swapBytes )
    {
      this.set('swapMb', parseInt(swapBytes,10)/1048576);
    }
    else
    {
      this.set('swapMb','');
    }
    this._initializingResources = false;
  },

  memoryReservationChanged: observer('memoryReservationMb', function() {
    if ( this._initializingResources || !this.get('editing') ) { return; }
    var mem = this.get('memoryReservationMb');

    if ( isNaN(mem) || mem <= 0) {
      this.set('instance.memoryReservation', '');
    }
    else {
      this.set('instance.memoryReservation', mem * 1048576);
    }
  }),

  memoryDidChange: function() {
    if ( this._initializingResources || !this.get('editing') ) { return; }
    // The actual parameter we're interested in is 'memory', in bytes.
    var mem = parseInt(this.get('memoryMb'),10);
    if ( isNaN(mem) || mem <= 0)
    {
      this.setProperties({
        'memoryMb': '',
        'swapMb': '',
        'instance.memory': null,
        'instance.memorySwap': null,
      });
    }
    else
    {
      this.set('instance.memory', mem * 1048576);

      var swap = parseInt(this.get('swapMb'),10);
      if ( isNaN(swap) || swap <= 0)
      {
        this.setProperties({
          'swapMb': '',
          'instance.memorySwap': null
        });
      }
      else
      {
        this.set('instance.memorySwap', (mem+swap) * 1048576);
      }
    }
  }.observes('memoryMb','swapMb'),

  // ----------------------------------
  // PID Mode
  // ----------------------------------
  pidHost: null,
  initPidMode: function() {
    this._initializingPid = true;
    this.set('pidHost', this.get('instance.pidMode') === 'host');
    this._initializingPid = false;
  },

  didReceiveAttrs() {
    this._super(...arguments);
    if ( this.get('resourcesOnly') && !this.get('projects.current.isWindows') && this._resourceInstance !== this.get('instance') ) {
      this._resourceInstance = this.get('instance');
      this.initDevices();
      this.initMemory();
    }
  },
  pidModeDidChange: function() {
    if ( this._initializingPid || !this.get('editing') ) { return; }
    this.set('instance.pidMode', this.get('pidHost') ? 'host' : null);
  }.observes('pidHost'),

  // ----------------------------------
  // Devices
  // ----------------------------------
  devicesArray: null,
  initDevices: function() {
    this._initializingDevices = true;
    var ary = this.get('instance.devices');
    if ( !ary )
    {
      ary = [];
    }

    this.set('devicesArray', ary.map(function(dev) {
      var parts = dev.split(':');
      var target = parts[1] && parts[1].charAt(0) === '/' ? parts[1] : parts[0];
      var permissions = parts[2] || (parts[1] && parts[1].charAt(0) !== '/' ? parts[1] : 'rwm');
      return {host: parts[0], container: target, permissions};
    }));
    this._initializingDevices = false;
  },
  externalDevicesChanged: observer('instance.devices', function() {
    if ( !this.get('securityOnly') && !this._publishingDevices ) { this.initDevices(); }
  }),
  devicesDidChange: function() {
    if ( this._initializingDevices || !this.get('editing') ) { return; }
    var out = [];
    this.get('devicesArray').forEach(function(row) {
      if ( row.host )
      {
        out.push(row.host+":"+(row.container || row.host)+":"+(row.permissions || 'rwm'));
      }
    });
    this._publishingDevices = true;
    this.set('instance.devices', out);
    this._publishingDevices = false;
  }.observes('devicesArray.@each.{host,container,permissions}'),

  initMultiselect: function() {
    var view = this;

    var opts = {
      maxHeight: 200,
      buttonClass: 'btn btn-default',
      buttonWidth: '100%',

      templates: {
        li: '<li><a tabindex="0"><label></label></a></li>',
      },

      buttonText: function(options, select) {
        var label = (select.hasClass('select-cap-add') ? 'Add' : 'Drop') + ": ";
        if ( options.length === 0 )
        {
          label += 'None';
        }
        else if ( options.length === 1 )
        {
          label += $(options[0]).text();
        }
        else
        {
          label += options.length + ' Selected';
        }

        return label;
      },

      onChange: function(/*option, checked*/) {
        var self = this;
        var options = $('option', this.$select);
        var selectedOptions = this.getSelected();
        var allOption = $('option[value="ALL"]',this.$select)[0];

        var isAll = $.inArray(allOption, selectedOptions) >= 0;

        if ( isAll )
        {
          options.each(function(k, option) {
            var $option = $(option);
            if ( option !== allOption )
            {
              self.deselect($(option).val());
              $option.prop('disabled',true);
              $option.parent('li').addClass('disabled');
            }
          });

          // @TODO Figure out why deslect()/select() doesn't fix the state in the ember object and remove this hackery...
          var ary = view.get('instance.' + (this.$select.hasClass('select-cap-add') ? 'capAdd' : 'capDrop'));
          ary.clear();
          ary.pushObject('ALL');
        }
        else
        {
          options.each(function(k, option) {
            var $option = $(option);
            $option.prop('disabled',false);
            $option.parent('li').removeClass('disabled');
          });
        }

        this.$select.multiselect('refresh');
      }
    };

    this.$('.select-cap-add').multiselect(opts);
    this.$('.select-cap-drop').multiselect(opts);
  },

  privilegedDidChange: function() {
    var add = this.$('.select-cap-add');
    var drop = this.$('.select-cap-drop');
    if ( !this.get('resourcesOnly') && add && drop )
    {
      if ( this.get('instance.privileged') )
      {
        add.multiselect('disable');
        drop.multiselect('disable');
      }
      else
      {
        add.multiselect('enable');
        drop.multiselect('enable');
      }
    }
  }.observes('instance.privileged'),

  initLogging: function() {
    if (!this.get('instance.logConfig') ) {
      this.set('instance.logConfig', {});
    }

    if (!this.get('instance.logConfig.driver') ) {
      this.set('instance.logConfig.driver', '');
    }

    if (!this.get('instance.logConfig.config') ) {
      this.set('instance.logConfig.config', {});
    }
  },

  logDriverChoices: [
    'none',
    'json-file',
    'awslogs',
    'etwlogs',
    'fluentd',
    'gcplogs',
    'gelf',
    'journald',
    'splunk',
    'syslog',
  ],

  hasLogConfig: computed('instance.logConfig.config', function() {
    return isEmpty(this.get('instance.logConfig.config'));
  }),

  isolationChoices: function() {
    return [
      {label: 'formSecurity.isolation.default', value: 'default'},
      {label: 'formSecurity.isolation.hyperv', value: 'hyperv'},
    ];
  }.property(),
});
