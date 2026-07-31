import EmberObject from '@ember/object';
import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';

export default Route.extend({
  access: service(),
  catalog: service(),

  model: function(/*params, transition*/) {
    var userStore = this.get('userStore');
    return hash({
      all: userStore.findAll('project'),
      projectTemplates: userStore.findAll('projectTemplate'),
      catalogTemplates: this.get('catalog').fetchTemplates({templateBase: C.EXTERNAL_ID.KIND_INFRA, category: C.EXTERNAL_ID.KIND_ALL}),
    }).then((hash) => {
      let tplId = null;
      let tpl = hash.projectTemplates.objectAt(0);
      if ( tpl ) {
        tplId = tpl.get('id');
      }

      var project = userStore.createRecord({
        type: 'project',
        name: '',
        description: '',
        projectTemplateId: tplId,
      });

      if ( this.get('access.enabled') )
      {
        var identity = this.get('session.'+C.SESSION.IDENTITY);
        identity.type = 'identity';
        var me = userStore.createRecord(identity);
        me.set('role', C.PROJECT.ROLE_OWNER);
        project.set('projectMembers', [me]);
      }
      else
      {
        project.set('projectMembers',[]);
      }

      return EmberObject.create({
        originalProject: null,
        project: project,
        all: hash.all,
        projectTemplates: hash.projectTemplates,
        stacks: [],
      });
    });
  },
});
