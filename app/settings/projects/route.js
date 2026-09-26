import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  projects: service(),

  model: function() {
    var userStore = this.get('userStore');
    var projects = this.get('projects');
    return hash({
      projects: projects.getAll().then((all) => projects.set('all', all)),
      projectTemplates: userStore.find('projecttemplate', null, {url: 'projectTemplates', forceReload: true, removeMissing: true}),
    }).then(() => {
      return {
        projects: projects.get('all'),
        projectTemplates: userStore.all('projecttemplate'),
      };
    });
  },
});
