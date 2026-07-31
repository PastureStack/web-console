import { computed } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';

export default Component.extend({
  prefs     : service(),
  userTheme : service('user-theme'),

  classNames : ['btn-group', 'btn-group-sm'],

  theme: computed(`prefs.${C.PREFS.THEME}`, function() {
    return this.get(`prefs.${C.PREFS.THEME}`);
  }),

  actions: {
    changeTheme: function(theme) {
      var userTheme = this.get('userTheme');
      var currentTheme  = userTheme.getTheme();

      if (theme !== currentTheme) {
        userTheme.setTheme(theme);
      }
    }
  },

});
