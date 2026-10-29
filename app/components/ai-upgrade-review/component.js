import Component from '@ember/component';
import { observer } from '@ember/object';
import { scheduleOnce } from '@ember/runloop';
import { service } from '@ember/service';

// Visible bridge from a tool-created preview into the existing human modal UI.
// This component is mounted only by an explicitly enabled build.
export default Component.extend({
  tagName: '',
  commands: service('ai-command-service'),
  modalService: service('modal'),

  pendingChanged: observer('commands.pendingPlan.planRef', function() {
    scheduleOnce('afterRender', this, this.openReview);
  }),

  openReview() {
    const plan = this.get('commands.pendingPlan');
    if (this.isDestroyed || this.isDestroying) { return; }
    if (!plan && this.get('modalService.modalVisible') && this.get('modalService.modalType') === 'modal-confirm-ai-upgrade') {
      this.get('modalService').toggleModal();
    }
    if (!plan || this.get('modalService.modalVisible')) { return; }
    this.get('modalService').toggleModal('modal-confirm-ai-upgrade', {plan});
  },

  actions: {
    review() { this.openReview(); },
  },
});
