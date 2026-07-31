import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import PolledResource from 'ui/mixins/cattle-polled-resource';

import { computed } from '@ember/object';

var ProjectTemplate = Resource.extend(PolledResource, {
  access: service(),

  actions: {
    edit: function() {
      this.get('router').transitionTo('settings.projects.edit-template', this.get('id'));
    },
  },

  displayStacks: computed('stacks.@each.name', function() {
    return (this.get('stacks')||[]).map((s) => s.name).join(', ');
  }),

  canEdit: computed('access.admin', 'isPublic', function() {
    return !this.get('isPublic') || this.get('access.admin');
  }),

  availableActions: computed('canEdit', function() {
    var choices = [
      { label: 'action.edit',             icon: 'icon icon-edit',         action: 'edit',         enabled: this.get('canEdit')},
//      { label: 'action.clone',            icon: 'icon icon-copy',         action: 'clone',        enabled: true},
      { divider: true },
      { label: 'action.remove',           icon: 'icon icon-trash',        action: 'promptDelete', enabled: this.get('canEdit'), altAction: 'delete' },
      { label: 'action.viewInApi',        icon: 'icon icon-external-link',action: 'goToApi',      enabled: true },
    ];


    return choices;
  }),

  icon: 'icon icon-file',

  allThere: computed('stacks.@each.catalogTemplate', function() {
    let bad = this.get('stacks').find((stack) => { return !stack.get('catalogTemplate'); });
    return !bad;
  }),

  summary: computed('stacks.[]', function() {
    let map = {
      'Orchestration': '',
    };

    this.get('stacks').forEach((stack) => {
      let categories = stack.get('categories')||['Unknown'];
      categories.forEach((category) => {
        if ( !map[category] ) {
          map[category] = '';
        }

        let tpl = stack.get('catalogTemplate');
        let name;
        if ( tpl ) {
          name = tpl.get('name');
        } else {
          name = stack.get('name');
        }

        map[category] += (map[category] ? ', ' : '') + name;
      });
    });

    if ( !map['Orchestration'] ) {
      map['Orchestration'] = 'Cattle';
    }

    // Sort the keys by map
    Object.keys(map).sort().forEach((key) => {
      if ( key === 'Orchestration') {
        return;
      }

      let tmp = map[key];
      delete map[key];
      map[key] = tmp;
    });

    return map;
  }),

  orchestrationIcon: computed('stacks.[]', function() {
    let orch = this.get('stacks').find((stack) => {
      return stack.get('categories').includes('Orchestration');
    });

    if ( orch ) {
      return orch.get('icon');
    } else {
      return `${this.get('app.baseAssets')}assets/images/logos/pasturestack-mark.svg`;
    }
  }),
});

// Projects don't get pushed by /subscribe WS, so refresh more often
ProjectTemplate.reopenClass({
  pollTransitioningDelay: 1000,
  pollTransitioningInterval: 5000,
});

export default ProjectTemplate;
