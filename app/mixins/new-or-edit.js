import { resolve } from 'rsvp';
import { alias } from '@ember/object/computed';
import Mixin from '@ember/object/mixin';
import Resource from 'ember-api-store/models/resource';
import Errors from 'ui/utils/errors';

export default Mixin.create({
  originalModel: null,
  errors: null,
  saving: false,
  editing: true,
  primaryResource: alias('model'),
  originalPrimaryResource: alias('originalModel'),

  initFields: function() {
    this._super();
    this.set('errors',null);
    this.set('saving',false);
  },

  didReceiveAttrs: function() {
    this._super();
    this.set('errors',null);
    this.set('saving',false);
  },

  validate: function() {
    var model = this.get('primaryResource');
    var errors = model.validationErrors();
    if ( errors.get('length') )
    {
      this.set('errors', errors);
      return false;
    }

    this.set('errors', null);
    return true;
  },

  actions: {
    error: function(err) {
      if (err)
      {
        var body = Errors.stringify(err);
        this.set('errors', [body]);
      }
      else
      {
        this.set('errors', null);
      }
    },

    save: function(cb) {
      let owner = {};

      // Reserve this submission before entering an RSVP turn. This closes the
      // gap in which two clicks could both observe saving=false. A duplicate
      // submission completes its own callback but never owns or clears the
      // first submission's lock.
      if ( this._saveOwner ) {
        return resolve().then(() => {
          if ( cb ) {
            cb(false);
          }
          return {saved: false, reason: 'busy'};
        });
      }

      this._saveOwner = owner;
      let initialSaving = this.get('saving');
      let ownsSaving = false;
      let callbackSuccess = false;

      // Starting with an empty RSVP turn makes synchronous hook exceptions
      // indistinguishable from Promise rejections and adopts plain values and
      // thenables returned by every hook.
      return resolve()
        .then(() => this.willSave())
        .then((ok) => {
          if ( !ok ) {
            return {saved: false, reason: 'cancelled'};
          }

          ownsSaving = true;
          if ( !this.get('saving') ) {
            this.set('saving', true);
          }

          return resolve()
            .then(() => this.doSave())
            .then((result) => this.didSave(result))
            .then((result) => this.doneSaving(result))
            .then((result) => {
              callbackSuccess = true;
              return {saved: true, value: result};
            });
        })
        .then(null, (error) => {
          return this._handleSaveFailure(error).then(() => {
            return {saved: false, error};
          });
        })
        .finally(() => {
          let finalizerError = null;

          if ( this._saveOwner === owner ) {
            this._saveOwner = null;
            // A hook that turned saving on and then threw still owns that
            // state, but a submission which found a pre-existing saving=true
            // must not clear another operation's lock.
            if (
              !this.isDestroyed &&
              !this.isDestroying &&
              (ownsSaving || (!initialSaving && this.get('saving')))
            ) {
              try {
                this.set('saving', false);
              } catch (error) {
                finalizerError = error;
              }
            }
          }

          try {
            if ( cb ) {
              cb(callbackSuccess);
            }
          } catch (error) {
            if ( finalizerError && error && typeof error === 'object' && !error.cause ) {
              error.cause = finalizerError;
            }
            throw error;
          }

          if ( finalizerError ) {
            throw finalizerError;
          }
        })
        .then((outcome) => outcome.saved ? outcome.value : outcome);
    }
  },

  _handleSaveFailure(error) {
    // The display action and the overridable cleanup hook both participate in
    // the returned lifecycle. If displaying the first error itself fails, the
    // cleanup hook still runs. A display/finalizer exception remains an
    // observable rejection instead of being reduced to outcome metadata.
    let displayError = null;

    return resolve()
      .then(() => this.send('error', error))
      .then(
        () => undefined,
        (failure) => {
          displayError = failure;
        }
      )
      .then(() => resolve().then(() => this.errorSaving(error)))
      .then(
        () => {
          if ( displayError ) {
            throw displayError;
          }
        },
        (cleanupError) => {
          if (
            displayError &&
            cleanupError &&
            typeof cleanupError === 'object' &&
            !cleanupError.cause
          ) {
            cleanupError.cause = displayError;
          }
          throw cleanupError;
        }
      );
  },

  // willSave happens before save and can stop the save from happening
  willSave: function() {
    this.set('errors',null);
    var ok = this.validate();
    if ( !ok )
    {
      // Validation failed
      return false;
    }

    if ( this.get('saving') )
    {
      // Already saving
      return false;
    }

    this.set('saving',true);
    return true;
  },

  doSave: function(opt) {
    return this.get('primaryResource').save(opt).then((newData) => {
      return this.mergeResult(newData);
    });
  },

  mergeResult: function(newData) {
    var original = this.get('originalPrimaryResource');
    if ( original )
    {
      if ( Resource.detectInstance(original) )
      {
        original.merge(newData);
        return original;
      }
    }

    return newData;
  },

  // didSave can be used to do additional saving of dependent resources
  didSave: function(neu) {
    return neu;
  },

  // doneSaving happens after didSave
  doneSaving: function(neu) {
    return neu || this.get('originalPrimaryResource') || this.get('primaryResource');
  },

  // errorSaving can be used to do additional cleanup of dependent resources on failure
  errorSaving: function(/*err*/) {
  },
});
