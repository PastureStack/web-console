import Ember from 'ember';
import Sortable from 'ui/mixins/sortable';
import { classifyUnusedVolumes } from 'ui/utils/unused-volume-cleanup';

export default Ember.Controller.extend(Sortable, {
  modalService: Ember.inject.service('modal'),

  nonRootVolumes: function() {
    return this.get('model').filter(function(volume) {
      return !volume.get('instanceId') &&
        ['removing', 'removed', 'purging', 'purged'].indexOf(volume.get('state')) === -1;
    });
  }.property('model.@each.{instanceId,state}'),

  cleanupClassification: Ember.computed(
    'nonRootVolumes.[]',
    'nonRootVolumes.@each.{state,name,externalId,instanceId,removed,actionLinks,mounts}',
    function() {
      return classifyUnusedVolumes(this.get('nonRootVolumes'));
    }
  ),

  cleanupCandidates: Ember.computed.alias('cleanupClassification.candidates'),
  cleanupProtectedCount: Ember.computed.alias('cleanupClassification.protected.length'),
  hasCleanupCandidates: Ember.computed.gt('cleanupCandidates.length', 0),

  sortableContent: Ember.computed.alias('nonRootVolumes'),
  sortBy: 'name',
  sorts: {
    state:    ['stateSort','displayUri','id'],
    hostPath: ['displayUri','id'],
  },

  actions: {
    promptCleanup() {
      let candidates = this.get('cleanupCandidates').slice();

      if ( candidates.length === 0 )
      {
        return;
      }

      this.get('modalService').toggleModal('confirm-clean-unused-volumes', {
        volumes: candidates,
        protectedCount: this.get('cleanupProtectedCount'),
        escToClose: true,
        onComplete: (successful) => {
          Ember.run(() => {
            this.get('model').removeObjects(successful);
          });
        },
      });
    },
  },
});
