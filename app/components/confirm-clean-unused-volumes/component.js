import Ember from 'ember';
import ModalBase from 'lacsso/components/modal-base';
import { runWithConcurrency } from 'ui/utils/unused-volume-cleanup';

function displayName(volume) {
  return volume.get('displayName') || volume.get('name') || volume.get('id');
}

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal', 'unused-volume-cleanup-modal'],

  opts: Ember.computed.alias('modalService.modalOpts'),
  volumes: Ember.computed.alias('opts.volumes'),
  protectedCount: Ember.computed.alias('opts.protectedCount'),

  isRunning: false,
  isComplete: false,
  completedCount: 0,
  successful: null,
  failed: null,

  init() {
    this._super(...arguments);
    this.setProperties({
      successful: [],
      failed: [],
    });
  },

  previewVolumes: Ember.computed('volumes.[]', function() {
    return (this.get('volumes') || []).slice(0, 12);
  }),

  additionalCount: Ember.computed('volumes.length', function() {
    return Math.max(0, (this.get('volumes.length') || 0) - 12);
  }),

  hasFailures: Ember.computed.gt('failed.length', 0),

  escToClose() {
    return !this.get('isRunning') && this._super(...arguments);
  },

  actions: {
    confirm() {
      if ( this.get('isRunning') || this.get('isComplete') )
      {
        return;
      }

      let volumes = (this.get('volumes') || []).slice();
      this.set('isRunning', true);

      runWithConcurrency(volumes, 4, (volume) => {
        return volume.doAction('remove', {}, {catchGrowl: false}).then(() => {
          this.get('successful').pushObject(volume);
        }).catch(() => {
          this.get('failed').pushObject({
            name: displayName(volume),
          });
        }).then(() => {
          this.incrementProperty('completedCount');
        });
      }).then(() => {
        this.setProperties({
          isRunning: false,
          isComplete: true,
        });

        let onComplete = this.get('opts.onComplete');
        if ( typeof onComplete === 'function' )
        {
          onComplete(this.get('successful').slice());
        }
      });
    },

    close() {
      if ( !this.get('isRunning') )
      {
        this.send('cancel');
      }
    },
  },
});
