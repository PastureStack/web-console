import { resolve } from 'rsvp';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import Sortable from 'ui/mixins/sortable';
import C from 'ui/utils/constants';
import NewOrEdit from 'ui/mixins/new-or-edit';
import Errors from 'ui/utils/errors';
import { sortInsensitiveBy } from 'ui/utils/sort';

export default Component.extend(NewOrEdit, Sortable, {
  projects: service(),
  access: service(),
  growl: service(),
  intl: service(),
  accessEnabled: alias('access.enabled'),
  queryParams: ['editing'],

  project: null,
  originalProject: null,
  allProjects: null,
  policyManager: null,
  editing: false,
  tab: 'access',

  primaryResource: alias('project'),
  sortableContent: alias('project.projectMembers'),
  sortBy: 'name',
  sorts: {
    name:   ['name', 'externalId'],
    type:   ['externalIdType','externalId'],
    role:   ['role','externalId'],
  },

  stacks: null,

  actions: {
    selectTemplate(id) {
      this.set('project.projectTemplateId', id);
    },

    changeProject(project) {
      this.get('router').transitionTo('settings.projects.detail', project.get('id'));
    },

    cancel() {
      this.sendAction('cancel');
    },

    checkMember(member) {
      var existing = this.get('project.projectMembers')
                      .filterBy('externalIdType', member.get('externalIdType'))
                      .filterBy('externalId', member.get('externalId'));

      if ( existing.get('length') )
      {
        this.send('error','Member is already in the list');
        return;
      }

      member.set('role', (this.get('hasOwner') ? 'member' : 'owner'));

      this.send('error',null);
      this.get('project.projectMembers').pushObject(member);
    },

    removeMember(item) {
      this.get('project.projectMembers').removeObject(item);
    },
  },

  didInsertElement() {
    if ( this.get('showEdit') )
    {
      var elem = this.$('INPUT[type="text"]')[0];
      if ( elem )
      {
        elem.focus();
      }
    }
  },

  projectBase: function() {
    return this.get('app.projectEndpoint').replace(this.get('app.projectToken'), this.get('project.id'));
  }.property('project.id'),

  roleOptions: function() {
    return (this.get('userStore').getById('schema','projectmember').get('resourceFields.role.options')||[]).map((role) => {
      return {
        label: 'model.projectMember.role.'+role,
        value: role
      };
    });
  }.property(),

  templateChoices: function() {
    var active = this.get('project.projectTemplateId');

    var choices = this.get('projectTemplates').map((tpl) => {
      return {id: tpl.id, name: tpl.get('localizedName'), image: tpl.get('orchestrationIcon')};
    });

    if ( !choices.length ) {
      choices.push({id: null, name: 'None', image: `${this.get('app.baseAssets')}assets/images/logos/pasturestack-mark.svg`});
    }

    choices.forEach(function(driver) {
      driver.active = ( active === driver.name );
    });

    return sortInsensitiveBy(choices,'name');
  }.property('project.projectTemplateId','projectTemplates.@each.name'),

  selectedProjectTemplate: function() {
    return this.get('projectTemplates').findBy('id', this.get('project.projectTemplateId'));
  }.property('project.projectTemplateId'),

  hasOwner: function() {
    return this.get('project.projectMembers').filterBy('role', C.PROJECT.ROLE_OWNER).get('length') > 0;
  }.property('project.projectMembers.@each.role'),

  npWithinStack: function() {
    return this.get('network.policy').findBy('within','stack');
  }.property('network.policy.@each.within'),

  npWithinService: function() {
    return this.get('network.policy').findBy('within','service');
  }.property('network.policy.@each.within'),

  npWithinLinked: function() {
    return this.get('network.policy').findBy('within','linked');
  }.property('network.policy.@each.within'),

  missingManager: function() {
    return !this.get('policyManager');
  }.property('policyManager'),

  canEditProject: function() {
    return !this.get('project.id') || !!this.get('project.actionLinks.update');
  }.property('project.actionLinks.update'),

  hasUnsupportedPolicy: function() {
    return this.get('network.policy').filter((x) => { return !!!(x.get('within')); }).length > 0;
  }.property('network.policy.@each.within'),

  validate() {
    this._super();
    var errors = this.get('errors')||[];

    if ( !this.get('hasOwner') && this.get('access.enabled') )
    {
      errors.push('You must have at least one owner');
    }

    if ( errors.length )
    {
      this.set('errors', errors);
      return false;
    }

    return true;
  },

  willSave() {
    var out = this._super();
    if ( out && !this.get('project.id') )
    {
      // For create the members go in the request
      this.set('project.members', this.get('project.projectMembers'));
    }

    return out;
  },

  doSave() {
    if ( this.get('canEditProject') ) {
      return this._super(...arguments).then(null, (err) => {
        throw this.saveError(err, 'viewEditProject.error.projectNotSaved', 'viewEditProject.error.projectFailed');
      });
    } else {
      return resolve();
    }
  },

  didSave() {
    let setMembers = resolve();
    if ( this.get('editing') )
    {
      if ( this.get('access.enabled') )
      {
        var members = this.get('project.projectMembers').map((member) => {
          return {
            type: 'projectMember',
            externalId: member.externalId,
            externalIdType: member.externalIdType,
            role: member.role
          };
        });

        setMembers = resolve()
          .then(() => this.get('project').doAction('setmembers', {members}))
          .then(null, (err) => {
            throw this.saveError(err, 'viewEditProject.error.membersNotSaved', 'viewEditProject.error.membersFailed');
          });
      }
    }

    return setMembers.then(() => {
      if ( this.get('project.id') && this.get('network') && !this.get('hasUnsupportedPolicy') )
      {
        return resolve()
          .then(() => this.get('network').save({
            headers: {
              [C.HEADER.PROJECT_ID]: this.get('project.id'),
            }
          }))
          .then(null, (err) => {
            throw this.saveError(err, 'viewEditProject.error.networkNotSaved', 'viewEditProject.error.networkFailed');
          });
      }
    });
  },

  doneSaving() {
    var out = this._super();
    this.get('projects').refreshAll();
    this.sendAction('done');
    return out;
  },

  saveError(err, deniedKey, failedKey) {
    let status = Errors.status(err);
    if ( status === 401 ) {
      return {status, message: this.get('intl').t('login.error.timedOut')};
    }
    if ( status === 403 || status === 404 ) {
      return {status, message: this.get('intl').t(deniedKey)};
    }
    if ( status >= 500 && status <= 599 ) {
      return {status, message: this.get('intl').t(failedKey)};
    }

    // The shared NewOrEdit error action displays this in the existing
    // top-errors block. Preserve validation errors so their field details
    // remain available; 401/403/404/5xx must be understandable and distinct.
    return err;
  },
});
