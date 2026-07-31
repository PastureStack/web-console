import EmberObject, { get } from '@ember/object';
import { all } from 'rsvp';
import { next } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  editing: true,
  isService: false,
  isSidekick: false,
  loading: true,


  model: null,

  primaryResource: alias('model.instance'),
  launchConfig: alias('model.instance'),
  portsArray: null,

  linksArray: null,

  actions: {
    setPorts(ports) {
      this.set('portsArray', ports);
    },

    setLinks(links) {
      this.set('linksArray', links);
    },

    save() {
      this._super(...arguments);
      this.send('cancel');
    }
  },

  didInsertElement: function() {
    next(this, 'loadDependencies');
  },

  loadDependencies: function() {
    var instance = this.get('originalModel');

    return all([
      instance.followLink('ports'),
      instance.followLink('instanceLinks'),
      this.get('store').findAll('host'), // Need inactive ones in case a link points to an inactive host
    ]).then((results) => {
      var model = EmberObject.create({
        instance: instance.clone(),
        ports: results[0],
        instanceLinks: results[1],
        allHosts: results[2],
      });

      this.setProperties({
        originalModel: instance,
        model: model,
        loading: false,
      });
    });
  },

  didSave: function() {
    return all([
      this.savePorts(),
      this.saveLinks(),
    ]);
  },

  savePorts: function() {
    var promises = [];
    this.get('portsArray').forEach(function(port) {
      var neu = parseInt(port.public,10);
      if ( isNaN(neu) )
      {
        neu = null;
      }

      var obj = port.obj;
      if ( neu !== get(obj,'publicPort') )
      {
        //console.log('Changing port',obj.serialize(),'to',neu);
        obj.set('publicPort', neu);
        promises.push(obj.save());
      }
    });

    return all(promises);
  },

  saveLinks: function() {
    var promises = [];
    this.get('linksArray').forEach(function(link) {
      var neu = link.targetInstanceId;
      var obj = link.obj;
      if ( neu !== get(obj,'targetInstanceId') )
      {
        //console.log('Changing link',obj.serialize(),'to',neu);
        obj.set('targetInstanceId', neu);
        promises.push(obj.save());
      }
    });

    return all(promises);
  },

  doneSaving: function() {
    this.sendAction('dismiss');
  },
});
