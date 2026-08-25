import { computed } from '@ember/object';
import { service } from '@ember/service';
import { alias } from '@ember/object/computed';
import { alternateLabel } from 'ui/utils/platform';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],
  resources: alias('modalService.modalOpts'),
  alternateLabel: alternateLabel,
  settings: service(),
  intl: service(),

  actions: {
    confirm: function() {
      this.get('resources').forEach((resource) => {
        resource.delete();
      });

      this.send('cancel');
    },

  },

  isEnvironment: computed('resources', function() {
    let resources = this.get('resources');
    let out = false;

    resources.forEach((resource) => {
      if (resource.type === 'project') {
        out = true;
      }
    });

    return out;
  }),

  largeDeleteText: computed(function() {
    var resources = this.get('resources');
    return this.get('intl').t('confirmDelete.largeDeleteText', {
      key: resources[0].get('displayName'),
      othersCount: resources.length
    });
  }),

  didRender: function() {
    setTimeout(() => {
      try {
        this.$('BUTTON')[0].focus();
      } catch (e) {}
    }, 500);
  }
});
