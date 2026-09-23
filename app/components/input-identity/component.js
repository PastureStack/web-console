import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';

export default Component.extend({
  access: service(),
  intl: service(),
  allowTeams: true,
  checking: false,
  addInput: '',
  allIdentities: null,
  showDropdown: function() {
    return this.get('access.provider') !== 'localauthconfig';
  }.property('access.provider'),

  init: function() {
    this.set('allIdentities', this.get('userStore').all('identity'));
    this.get('userStore').findAll('identity').then(null, (err) => {
      this.sendAction('onError', this.identitySearchError(err));
    });
    this._super();
  },

  actions: {
    add: function() {
      if ( this.get('checking') )
      {
        return;
      }

      this.set('checking', true);
      var input = this.get('addInput').trim();

      return this.get('userStore').find('identity', null, {filter: {name: input}}).then(
        (info) => {
          var obj = info.objectAt(0);
          if (obj)
          {
            this.set('addInput','');
            this.send('addObject', obj);
          }
          else
          {
            this.sendAction('onError', this.get('intl').t('inputIdentity.error.notFound'));
          }
        },
        (err) => {
          this.sendAction('onError', this.identitySearchError(err));
        }
      ).finally(() => {
        this.set('checking', false);
      });
    },

    addObject: function(info) {
      this.sendAction('action', info);
    }
  },

  identitySearchError(err) {
    let status = Errors.status(err);
    let key = 'unavailable';
    if ( status === 401 ) {
      key = 'sessionExpired';
    } else if ( status === 403 ) {
      key = 'forbidden';
    }
    return this.get('intl').t(`inputIdentity.error.${key}`);
  },

  addDisabled: function() {
    return this.get('checking') || this.get('addInput').trim().length === 0;
  }.property('addInput','checking'),

  dropdownChoices: function() {
    var allowTeams = this.get('allowTeams');
    return this.get('allIdentities').filter((identity) => {
      var type = identity.get('externalIdType');
      var logicalType = identity.get('logicalType');

      // Don't show people
      if ( logicalType === C.PROJECT.PERSON )
      {
        return false;
      }

      // Don't show teams if disabled
      if ( !allowTeams && type === C.PROJECT.TYPE_GITHUB_TEAM )
      {
        return false;
      }

      return true;
    }).sortBy('logicalTypeSort','profileUrl','name');
  }.property('allIdentities.@each.{logicalType,externalIdType}','allowTeams'),

  dropdownLabel: function() {
    let out = '';
    let intl = this.get('intl');
    if ( this.get('access.provider') === 'githubconfig' )
    {
      out = intl.findTranslationByKey('inputIdentity.dropdownLabel.teams');
    }
    else
    {
      out = intl.findTranslationByKey('inputIdentity.dropdownLabel.groups');
    }
    return intl.formatMessage(out);
  }.property('access.provider', 'intl._locale'),
});
