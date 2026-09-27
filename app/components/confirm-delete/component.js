import { computed } from '@ember/object';
import { service } from '@ember/service';
import { alias } from '@ember/object/computed';
import { alternateLabel } from 'ui/utils/platform';
import { resolve } from 'rsvp';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],
  resources: alias('modalService.modalOpts'),
  alternateLabel: alternateLabel,
  settings: service(),
  intl: service(),
  deleting: false,

  init() {
    this._super(...arguments);
    this._completedDeletes = new Set();
  },

  escToClose() {
    return !this.get('deleting') && this._super(...arguments);
  },

  actions: {
    confirm: function() {
      if ( this.get('deleting') ) {
        return resolve({deleted: false, reason: 'busy'});
      }

      this.set('deleting', true);
      let resources = this.get('resources') || [];
      let pending = resources.reduce((chain, resource) => {
        return chain.then(() => {
          if ( this._completedDeletes.has(resource) ) {
            return;
          }

          return resolve().then(() => resource.delete()).then((result) => {
            this._completedDeletes.add(resource);
            return result;
          });
        });
      }, resolve());

      return pending.then(
        () => {
          this.set('deleting', false);
          this.send('cancel');
        },
        // Resource.delete already showed the error growl. The button action is
        // the final consumer of its rejection; leave the modal open for retry.
        (error) => ({deleted: false, error})
      ).finally(() => {
        if ( !this.isDestroyed && !this.isDestroying ) {
          this.set('deleting', false);
        }
      });
    },

    cancel() {
      if ( !this.get('deleting') ) {
        return this.get('modalService').toggleModal();
      }
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
