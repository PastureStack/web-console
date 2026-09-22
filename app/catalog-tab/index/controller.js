import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller, { inject as controller } from '@ember/controller';
import { isAlternate } from 'ui/utils/platform';
import C from 'ui/utils/constants';

export default Controller.extend({
  application:       controller(),
  catalog:           service(),
  settings:          service(),
  projects:          service(),
  projectId:         alias(`tab-session.${C.TABSESSION.PROJECT}`),

  catalogController: controller('catalog-tab'),
  category:          alias('catalogController.category'),
  categories:        alias('model.categories'),
  catalogId:         alias('catalogController.catalogId'),
  modalService:      service('modal'),

  parentRoute: 'catalog-tab',
  launchRoute: 'catalog-tab.launch',

  search: '',

  updating: 'no',

  canCreateStack: computed('projects.current.id', function() {
    return this.get('store').canCreate('stack');
  }),

  canManageCatalog: computed(
    'projects.current.actionLinks',
    'projects.current.actionLinks.{update,setmembers}',
    function() {
      let actions = this.get('projects.current.actionLinks') || {};
      return Boolean(actions.update || actions.setmembers);
    }
  ),

  actions: {
    addEnvCatalog() {
      if ( !this.get('canManageCatalog') ) {
        return false;
      }

      this.get('modalService').toggleModal('modal-edit-env-catalogs', {
        project: this.get('projects.current'),
        catalogs: this.get('catalog.catalogs'),
      });
    },
    clearSearch() {
      this.set('search', '');
    },
    launch(id, onlyAlternate) {
      if ( !this.get('canCreateStack') ) {
        return false;
      }

      if ( onlyAlternate && !isAlternate(event) ) {
        return false;
      }

      this.get('router').transitionTo(this.get('launchRoute'), id);
    },

    update() {
      if ( !this.get('canManageCatalog') ) {
        return false;
      }

      this.set('updating', 'yes');
      this.get('catalog').refresh().then(() => {
        this.set('updating', 'no');
        this.send('refresh');
      }).catch(() => {
        this.set('updating', 'error');
      });

    },
    switch(catalog) {
      this.get('router').transitionTo(this.get('parentRoute'), this.get('projectId'), {queryParams: catalog.queryParams} );
    }
  },

  catalogURL: computed('model.catalogs', function() {
    var neu = {
      catalogs: {}
    };
    this.get('model.catalogs').forEach((cat) => {
      neu.catalogs[cat.id] = {
        branch: cat.branch,
        url: cat.url
      };
    });
    return JSON.stringify(neu);
  }),

  arrangedContent: computed('model.catalog', 'search', function() {
    var search = this.get('search').toUpperCase();
    var result = [];

    if (!search) {
      return this.get('model.catalog');
    }

    this.get('model.catalog').forEach((item) => {
      let name = item.get('localizedName') || '';
      let description = item.get('localizedDescription') || '';

      if (name.toUpperCase().indexOf(search) >= 0 || description.toUpperCase().indexOf(search) >= 0) {
        result.push(item);
      }
    });
    return result;
  }),
});
