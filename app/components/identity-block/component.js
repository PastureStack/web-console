import { alias } from '@ember/object/computed';
import EmberObject from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';

export default Component.extend({
  intl              : service(),

  // Identity or externalId+externalIdType
  identity          : null,
  externalIdType    : null,
  externalId        : null,
  identityNotParsed : null,

  avatar            : true,
  link              : true,
  size              : 35,

  loading           : false,

  init() {
    this._super(...arguments);

    var eType = this.get('externalIdType');
    var eId = this.get('externalId');
    var id = this.get('identityNotParsed');

    if ( !id && eType && eId ) {
     id =`1i!${eType}:${eId}`;
    }

    let suppliedIdentity = this.get('identity');

    if ( !suppliedIdentity && eType && eId ) {
      this.set('identity', EmberObject.create({
        externalId     : eId,
        externalIdType : eType,
        login          : eId,
      }));
    }

    if ( !suppliedIdentity )
    {
      if ( id )
      {
        this.set('loading', true);
        this.get('userStore').find('identity', id).then((identity) => {
          if ( this.isDestroyed || this.isDestroying ) {
            return;
          }

          this.set('identity', identity);
        }).catch((/*err*/) => {
          // Do something..
        }).finally(() => {
          if ( this.isDestroyed || this.isDestroying ) {
            return;
          }

          this.set('loading', false);
        });
      }
    }
  },

  classNames: ['gh-block'],
  attributeBindings: ['ariaLabel:aria-label', 'role'],
  role             : 'group',

  avatarSrc: alias('identity.profilePicture'),
  url: alias('identity.profileUrl'),
  login: alias('identity.login'),

  ariaLabel: function() {
    return this.get('identity.name') || this.get('identity.login') || this.get('identity.externalId');
  }.property('identity.{name,login,externalId}'),

  displayDescription: function() {
    var out;
    var name = this.get('identity.name');
    var login = this.get('identity.login');
    if ( name === 'System Service' )
    {
      out = this.get('intl').t('identityBlock.systemService');
    }
    else if ( name && this.get('identity.externalIdType') === C.PROJECT.TYPE_GITHUB_TEAM )
    {
      out = name.replace(/:.*/,'') + ' team';
    }
    else
    {
      if ( name && name !== login ) {
        out = name;
      } else {
        let externalId = this.get('identity.externalId');
        if ( externalId && externalId !== login ) {
          out = externalId;
        }
      }
    }
    return out;
  }.property('identity.{externalIdType,name,login,externalId}', 'intl._locale'),
});
