import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';

export default Route.extend({
  model() {
    return EmberObject.create({
      dashboardUrl: this.get('app.swarmDashboard').replace(this.get('app.projectToken'), this.get(`tab-session.${C.TABSESSION.PROJECT}`)),
    });
  },
});
