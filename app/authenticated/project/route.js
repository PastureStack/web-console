import EmberObject from '@ember/object';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  access    : service(),
  intl      : service(),
  projects  : service(),

  model(params/*, transition*/) {
    var project = this.get('projects.current');

    if ( !project || project.get('id') !== params.project_id ) {
      let messageKey = 'viewEditProject.error.projectUnavailable';
      throw {status: 404, message: this.get('intl').t(messageKey), messageKey};
    }

    return EmberObject.create({
      project: project,
    });
  },

  loadingError(err, transition, ret) {
    if ( err && err.status === 401 )
    {
      let target = transition && typeof transition.send === 'function' ? transition : this;
      target.send('sessionInvalid', transition, true, null,
        transition && transition.authGeneration, 401);
      return;
    }

    this.get('router').transitionTo('authenticated');
    return ret;
  },
});
