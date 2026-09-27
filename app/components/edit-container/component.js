import EmberObject, { get } from '@ember/object';
import { all, allSettled, resolve } from 'rsvp';
import { next } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';

function settleSaves(promises) {
  return allSettled(promises).then((results) => {
    let failed = results.find((result) => result.state === 'rejected');
    if ( failed ) {
      throw failed.reason;
    }

    return results.map((result) => result.value);
  });
}

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
      return this._super(...arguments).then((outcome) => {
        // NewOrEdit waits for the container, ports, and links before resolving.
        // Keep the modal (and its error display) open if any save failed.
        if ( !outcome || outcome.saved !== false ) {
          this.send('cancel');
        }

        return outcome;
      });
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
    return settleSaves([
      resolve().then(() => this.savePorts()),
      resolve().then(() => this.saveLinks()),
    ]);
  },

  savePorts: function() {
    var promises = [];
    this.get('portsArray').forEach(function(port) {
      promises.push(resolve().then(() => {
        var neu = parseInt(port.public,10);
        if ( isNaN(neu) )
        {
          neu = null;
        }

        var obj = port.obj;
        var old = get(obj,'publicPort');
        if ( neu !== old )
        {
          //console.log('Changing port',obj.serialize(),'to',neu);
          obj.set('publicPort', neu);
          return resolve().then(() => obj.save()).catch((error) => {
            obj.set('publicPort', old);
            throw error;
          });
        }
      }));
    });

    return settleSaves(promises);
  },

  saveLinks: function() {
    var promises = [];
    this.get('linksArray').forEach(function(link) {
      promises.push(resolve().then(() => {
        var neu = link.targetInstanceId;
        var obj = link.obj;
        var old = get(obj,'targetInstanceId');
        if ( neu !== old )
        {
          //console.log('Changing link',obj.serialize(),'to',neu);
          obj.set('targetInstanceId', neu);
          return resolve().then(() => obj.save()).catch((error) => {
            obj.set('targetInstanceId', old);
            throw error;
          });
        }
      }));
    });

    return settleSaves(promises);
  },

  doneSaving: function() {
    this.sendAction('dismiss');
  },
});
