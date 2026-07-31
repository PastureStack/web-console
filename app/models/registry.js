import { alias } from '@ember/object/computed';
import EmberObject, { computed } from '@ember/object';
import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';

var Registry = Resource.extend({
  type: 'registry',
  serverAddress: null,
  modalService: service('modal'),

  actions: {
    deactivate: function() {
      return this.doAction('deactivate');
    },

    activate: function() {
      return this.doAction('activate');
    },

    edit: function() {
      this.get('store').find('registry').then((registries) => {
        this.get('modalService').toggleModal('edit-registry', EmberObject.create({
          registries: registries,
          registry: this,
          credential: this.get('credential'),
        }));
      });
    },
  },

  availableActions: computed(
    'actionLinks.{update,activate,deactivate,restore,remove,purge}',
    function() {
      var a = this.get('actionLinks');

      return [
        { label: 'action.activate',   icon: 'icon icon-play',         action: 'activate',     enabled: !!a.activate },
        { label: 'action.deactivate', icon: 'icon icon-pause',        action: 'deactivate',   enabled: !!a.deactivate },
        { label: 'action.remove',     icon: 'icon icon-trash',        action: 'promptDelete', enabled: !!a.remove, altAction: 'delete' },
        { divider: true },
        { label: 'action.purge',      icon: '',                       action: 'purge',        enabled: !!a.purge },
        { label: 'action.restore',    icon: 'icon icon-medicalcross', action: 'restore',      enabled: !!a.restore },
        { label: 'action.viewInApi',  icon: 'icon icon-external-link',action: 'goToApi',      enabled: true },
        { divider: true },
        { label: 'action.edit',       icon: 'icon icon-edit',         action: 'edit',         enabled: !!a.update },
      ];
    }
  ),

  displayName: alias('displayAddress'),
  displayAddress: computed('serverAddress', function() {
    var address = this.get('serverAddress').toLowerCase();
    if ( address === 'index.docker.io' )
    {
      return 'DockerHub';
    }
    else if ( address === 'quay.io' )
    {
      return 'Quay';
    }
    else
    {
      return address;
    }
  }),

  _allCredentials: null,
  credential: computed('_allCredentials.@each.registryId', 'id', function() {
    let all = this.get('_allCredentials');
    if ( !all ) {
      all = this.get('store').all('registrycredential');
      this.set('_allCredentials', all);
    }

    return all.filterBy('registryId', this.get('id')).get('lastObject');
  }),
});

export default Registry;
