import { service } from '@ember/service';
import Component from '@ember/component';
import { get } from '@ember/object';
import { Promise, reject } from 'rsvp';
import Errors from 'ui/utils/errors';

const OIDC_ACCESS_POLICY_PURPOSE = 'oidcAccessPolicyUpdate';
const CONFIG_ERROR_TRANSLATIONS = {
  LocalRecoveryRequired: 'siteAccess.errors.localRecoveryRequired',
  MfaConfirmationRequired: 'siteAccess.errors.mfaConfirmationRequired',
  MfaConfirmationUnavailable: 'siteAccess.errors.mfaConfirmationUnavailable',
  InvalidAccessMode: 'siteAccess.errors.invalidAccessMode',
  InvalidAllowedIdentity: 'siteAccess.errors.invalidAllowedIdentity',
};

export function configUpdateErrorBody(err) {
  let body = err && (err.body || err.responseJSON ||
    (err.xhr && err.xhr.responseJSON));
  if ( typeof body === 'string' ) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  return body || err || {};
}

export function configUpdateErrorCode(err) {
  let body = configUpdateErrorBody(err);
  return (err && err.code) || body.code || body.type || (err && err.type);
}

export default Component.extend({
  tagName: 'section',
  classNames: ['well'],
  settings: service(),
  access: service(),
  intl: service(),
  modalService: service('modal'),

  model: null,
  individuals: 'siteAccess.users',
  collection: 'siteAccess.groups',

  saved: true,
  errors: null,

  showList: function() {
    return this.get('copy.accessMode') !== 'unrestricted';
  }.property('copy.accessMode'),

  saveConfiguration(btnCb) {
    this.send('clearError');

    if ( this.get('showList') && !this.get('copy.allowedIdentities.length') )
    {
      this.send('gotError', this.get('intl').t('siteAccess.errors.authorizedIdentityRequired'));
      btnCb();
      return Promise.resolve();
    }

    this.set('saved', false);

    let copy = this.get('copy');
    if ( copy.get('accessMode') === 'unrestricted' ) {
      copy.set('allowedIdentities', []);
    }
    return this.saveWithBoundConfirmation(copy, true).then(() => {
      this.get('model').replaceWith(copy);
      this.set('copy.allowedIdentities', this.get('copy.allowedIdentities').slice());
      this.set('saved', true);
    }).catch((err) => {
      if ( !err || !err.mfaConfirmationCancelled ) {
        this.send('gotError', err);
      }
    }).finally(() => {
      btnCb();
    });
  },

  actions: {
    addAuthorized: function(data) {
      this.send('clearError');
      this.set('saved', false);
      let identities = this.get('copy.allowedIdentities');
      let duplicate = identities.find((identity) => {
        return get(identity, 'externalIdType') === get(data, 'externalIdType') &&
          get(identity, 'externalId') === get(data, 'externalId');
      });
      if ( !duplicate ) {
        identities.pushObject(data);
      }
    },

    removeIdentity: function(ident) {
      this.set('saved', false);
      this.get('copy.allowedIdentities').removeObject(ident);
    },

    save: function(btnCb) {
      return this.saveConfiguration(btnCb);
    },

    gotError: function(err) {
      let translation = CONFIG_ERROR_TRANSLATIONS[configUpdateErrorCode(err)];
      this.set('errors', [translation ? this.get('intl').t(translation) : Errors.stringify(err)]);
    },

    clearError: function() {
      this.set('errors', null);
    },
  },

  saveWithBoundConfirmation(copy, mayConfirm) {
    return copy.save().catch((err) => {
      let body = configUpdateErrorBody(err);
      let code = configUpdateErrorCode(err);
      let digest = body.requestDigest;
      if ( !mayConfirm || code !== 'MfaConfirmationRequired' ||
        !/^[0-9a-f]{64}$/.test(digest || '') ) {
        return reject(err);
      }

      return new Promise((resolve, rejectSave) => {
        this.get('modalService').toggleModal('mfa-security-confirmation', {
          closeWithOutsideClick: false,
          escToClose: false,
          purpose: OIDC_ACCESS_POLICY_PURPOSE,
          requestDigest: digest,
          onComplete: (confirmation) => {
            copy.set('securityConfirmation', confirmation);
            this.saveWithBoundConfirmation(copy, false)
              .finally(() => copy.set('securityConfirmation', null))
              .then(resolve, rejectSave);
          },
          onCancel: () => rejectSave({mfaConfirmationCancelled: true}),
        });
      });
    });
  },

  didReceiveAttrs() {
    this.set('copy', this.get('model').clone());
    this.set('copy.allowedIdentities', (this.get('copy.allowedIdentities')||[]).slice());
  },

  accessModeChanged: function() {
    this.set('saved',false);
    let identities = this.get('copy.allowedIdentities');
    if ( !identities )
    {
      identities = [];
      this.set('copy.allowedIdentities', identities);
    }

    if ( this.get('copy.accessMode') === 'unrestricted' )
    {
      this.set('copy.allowedIdentities', []);
    }
    else
    {
      let me = this.get('access.identity');
      let found = identities.filterBy('id', me.get('id')).length > 0;
      if ( !found )
      {
        identities.push(me);
      }
    }
  }.observes('copy.accessMode'),

});
