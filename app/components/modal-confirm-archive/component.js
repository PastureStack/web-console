import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import { resolve } from 'rsvp';
import ModalBase from 'lacsso/components/modal-base';
import Errors from 'ui/utils/errors';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal', 'archive-modal'],
  attributeBindings: ['role', 'aria-modal', 'aria-labelledby'],
  role: 'dialog',
  'aria-modal': 'true',
  'aria-labelledby': 'archive-modal-title',
  intl: service(),
  projects: service(),
  originalModel: alias('modalService.modalOpts.originalModel'),
  targetArchived: alias('modalService.modalOpts.archived'),
  saving: false,
  errors: null,

  init() {
    this._super(...arguments);
    this.set('requestProjectId', this.get('projects.current.id'));
  },

  blockReason: computed('originalModel.archiveBlockReason', 'originalModel.isArchived',
    'targetArchived', 'requestProjectId', 'projects.current.id', function() {
      if ( this.get('requestProjectId') !== this.get('projects.current.id') ) {
        return 'archive.readOnly';
      }
      if ( this.get('originalModel.isArchived') === this.get('targetArchived') ) {
        return 'archive.alreadyChanged';
      }
      return this.get('originalModel.archiveBlockReason');
    }),

  submitDisabled: computed('saving', 'blockReason', function() {
    return this.get('saving') || !!this.get('blockReason');
  }),

  didInsertElement() {
    this._super(...arguments);
    // Put initial focus on the safe action; native buttons support Enter/Space.
    this.element.querySelector('[data-testid="archive-cancel"]').focus();
  },

  escToClose() {
    return !this.get('saving') && this._super(...arguments);
  },

  actions: {
    confirm() {
      if ( this.get('submitDisabled') ) {
        return resolve(false);
      }
      this.setProperties({saving: true, errors: null});
      let resource = this.get('originalModel');
      let archived = this.get('targetArchived');
      return resolve().then(() => resource.save({data: {archived}})).then(() => {
        // The normal store request merges the server response, including WS data.
        if ( !this.isDestroyed && !this.isDestroying ) {
          this.set('saving', false);
          this.send('cancel');
        }
        return true;
      }, (error) => {
        if ( !this.isDestroyed && !this.isDestroying ) {
          this.set('errors', [Errors.stringify(error, this.get('intl'))]);
        }
        return false;
      }).finally(() => {
        if ( !this.isDestroyed && !this.isDestroying ) {
          this.set('saving', false);
        }
      });
    },

    cancel() {
      if ( !this.get('saving') ) {
        this.get('modalService').toggleModal();
      }
    },
  },
});
