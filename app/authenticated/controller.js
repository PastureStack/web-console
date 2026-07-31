import { schedule } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller, { inject as controller } from '@ember/controller';
import C from 'ui/utils/constants';

import { on } from '@ember/object/evented';
import { computed } from '@ember/object';

export default Controller.extend({
  application : controller(),
  settings    : service(),
  prefs       : service(),
  projects    : service(),
  currentPath : alias('application.currentPath'),
  error       : null,

  isPopup: alias('application.isPopup'),

  bootstrap: on('init', function() {
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
  }),

  hasCattleSystem: computed('model.stacks.@each.externalId', function() {
    var out = false;
    (this.get('model.stacks')||[]).forEach((stack) => {
      var info = stack.get('externalIdInfo');
      if ( info && C.EXTERNAL_ID.SYSTEM_KINDS.indexOf(info.kind) >= 0 )
      {
        out = true;
      }
    });

    return out;
  }),

  hasHosts: computed('model.hosts.length', function() {
    return (this.get('model.hosts.length') > 0);
  }),

  isReady: computed('projects.isReady', 'hasHosts', function() {
    return this.get('projects.isReady') && this.get('hasHosts');
  }),

  forceUpgrade: computed('currentPath', function() {
    const currentPath = this.get('currentPath') || '';

    return currentPath.indexOf('authenticated.settings.projects') !== 0 &&
      currentPath.indexOf('authenticated.admin-tab.') !== 0;
  }),
});
