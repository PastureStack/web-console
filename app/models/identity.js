import { equal } from '@ember/object/computed';
import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

var Identity = Resource.extend({
  intl: service(),

  isUser: equal('externalIdType', C.PROJECT.TYPE_USER),
  isTeam: equal('externalIdType', C.PROJECT.TYPE_TEAM),
  isOrg: equal('externalIdType', C.PROJECT.TYPE_ORG),

  avatarSrc: computed('isGithub', 'externalId', 'profilePicture', function() {
    if ( this.get('isGithub') && this.get('profilePicture') )
    {
      return this.get('profilePicture');
    }
    else
    {
      return 'data:image/png;base64,' + new Identicon(md5(this.get('externalId')||'Unknown'), 80, 0.01).toString();
    }
  }),

  isGithub: computed('externalIdType', function() {
    return [
      C.PROJECT.TYPE_GITHUB_ORG,
      C.PROJECT.TYPE_GITHUB_TEAM,
      C.PROJECT.TYPE_GITHUB_USER
    ].indexOf(this.get('externalIdType')) >= 0;
  }),

  isMyRancher: computed('{externalId,externalIdType}', function() {
    return this.get('externalIdType') === C.PROJECT.TYPE_RANCHER &&
      this.get('externalId') === this.get('session').get(C.SESSION.ACCOUNT_ID);
  }),

  logicalType: computed('externalIdType', function() {
    switch ( this.get('externalIdType') )
    {
      case C.PROJECT.TYPE_RANCHER:
      case C.PROJECT.TYPE_AZURE_USER:
      case C.PROJECT.TYPE_GITHUB_USER:
      case C.PROJECT.TYPE_LDAP_USER:
      case C.PROJECT.TYPE_OPENLDAP_USER:
      case C.PROJECT.TYPE_OIDC_USER:
      case C.PROJECT.TYPE_SHIBBOLETH_USER:
        return C.PROJECT.PERSON;

      case C.PROJECT.TYPE_GITHUB_TEAM:
        return C.PROJECT.TEAM;

      case C.PROJECT.TYPE_GITHUB_ORG:
      case C.PROJECT.TYPE_AZURE_GROUP:
      case C.PROJECT.TYPE_LDAP_GROUP:
      case C.PROJECT.TYPE_OPENLDAP_GROUP:
      case C.PROJECT.TYPE_OIDC_GROUP:
      case C.PROJECT.TYPE_SHIBBOLETH_GROUP:
        return C.PROJECT.ORG;
    }
  }),

  logicalTypeSort: computed('logicalType', function() {
    switch (this.get('logicalType') )
    {
      case C.PROJECT.ORG: return 1;
      case C.PROJECT.TEAM: return 2;
      case C.PROJECT.PERSON: return 3;
      default: return 4;
    }
  }),

  displayType: computed('externalIdType', 'intl._locale', function() {
    let key = 'model.identity.displayType.unknown';
    let type = this.get('externalIdType');
    switch ( type )
    {
      case C.PROJECT.TYPE_GITHUB_USER:
      case C.PROJECT.TYPE_AZURE_USER:
      case C.PROJECT.TYPE_LDAP_USER:
      case C.PROJECT.TYPE_OPENLDAP_USER:
      case C.PROJECT.TYPE_OIDC_USER:
      case C.PROJECT.TYPE_SHIBBOLETH_USER:
        key = 'model.identity.displayType.user';
        break;
      case C.PROJECT.TYPE_AZURE_GROUP:
      case C.PROJECT.TYPE_LDAP_GROUP:
      case C.PROJECT.TYPE_OPENLDAP_GROUP:
      case C.PROJECT.TYPE_OIDC_GROUP:
      case C.PROJECT.TYPE_SHIBBOLETH_GROUP:
        key = 'model.identity.displayType.group';
        break;
      case C.PROJECT.TYPE_GITHUB_TEAM:
        key = 'model.identity.displayType.team';
        break;
      case C.PROJECT.TYPE_GITHUB_ORG:
        key = 'model.identity.displayType.org';
        break;
      case C.PROJECT.TYPE_RANCHER:
        key = 'model.identity.displayType.localUser';
        break;
    }

    return this.get('intl').t(key, {type: type});
  }),
});

export default Identity;
