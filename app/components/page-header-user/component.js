import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';

export default Component.extend({
  tagName: '',

  access: service(),
  modalService: service('modal'),

  accessEnabled    : alias('access.enabled'),

  isLocalAuth: function() {
    return this.get('access.enabled') && this.get('access.provider') === 'localauthconfig';
  }.property('access.{enabled,provider}'),

  actions: {
    changePassword() {
      let us = this.get('userStore');

      us.findAll('password').then(() => {
        us.find('account', this.get('session.'+C.SESSION.ACCOUNT_ID)).then((account) => {
          this.get('modalService').toggleModal('edit-account', account);
        });
      });
    },
  },
});
