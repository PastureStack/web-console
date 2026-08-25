import { hash } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    var userStore = this.get('userStore');
    return hash({
      projects: userStore.find('project', null, {url: 'projects', filter: {all: 'true'}, forceReload: true, removeMissing: true}),
      projectTemplates: userStore.find('projecttemplate', null, {url: 'projectTemplates', forceReload: true, removeMissing: true}),
    }).then(() => {
      return {
        projects: userStore.all('project'),
        projectTemplates: userStore.all('projecttemplate'),
      };
    });
  },
});
