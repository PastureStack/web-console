import { schedule } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller, { inject as controller } from '@ember/controller';
import C from 'ui/utils/constants';

export default Controller.extend({
  application : controller(),
  settings    : service(),
  prefs       : service(),
  projects    : service(),
  currentPath : alias('router.currentRouteName'),
  error       : null,

  isPopup: alias('application.isPopup'),

  bootstrap: function() {
    schedule('afterRender', this, () => {
      this.get('application').setProperties({
        error: null,
        error_description: null,
        state: null,
      });

      let bg = this.get(`prefs.${C.PREFS.BODY_BACKGROUND}`);
      if ( bg ) {
        $('BODY').css('background', bg);
      }
    });
  }.on('init'),

  hasCattleSystem: function() {
    var out = false;
    (this.get('model.stacks')||[]).forEach((stack) => {
      var info = stack.get('externalIdInfo');
      if ( info && C.EXTERNAL_ID.SYSTEM_KINDS.indexOf(info.kind) >= 0 )
      {
        out = true;
      }
    });

    return out;
  }.property('model.stacks.@each.externalId'),

  hasHosts: function() {
    return (this.get('model.hosts.length') > 0);
  }.property('model.hosts.length'),

  isReady: function() {
    return this.get('projects.isReady') && this.get('hasHosts');
  }.property('projects.isReady','hasHosts'),

  forceUpgrade: function() {
    return this.get('currentPath').indexOf('authenticated.settings.projects') !== 0 &&
      this.get('currentPath').indexOf('authenticated.admin-tab.') !== 0;
  }.property('currentPath'),
});
