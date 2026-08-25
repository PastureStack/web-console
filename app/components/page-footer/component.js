import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';

export default Component.extend({
  tagName: 'footer',
  className: 'clearfix',

  settings: service(),

  projectId        : alias(`tab-session.${C.TABSESSION.PROJECT}`),

  modalService: service('modal'),

  init() {
    this._super(...arguments);
    let settings = this.get('settings');

    let cli = {};
    Object.keys(C.SETTING.CLI_URL).forEach((key) => {
      cli[key.toLowerCase()] = settings.get(C.SETTING.CLI_URL[key]);
    });

    let compose = {};
    Object.keys(C.SETTING.COMPOSE_URL).forEach((key) => {
      compose[key.toLowerCase()] = settings.get(C.SETTING.COMPOSE_URL[key]);
    });

    this.setProperties({
      cli: cli,
      compose: compose,
    });
  },

  actions: {
    showAbout() {
      this.get('modalService').toggleModal('modal-about', {
        closeWithOutsideClick: true
      });
    },
  }
});


