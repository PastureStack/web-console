import { alias } from '@ember/object/computed';
import Component from '@ember/component';

export default Component.extend({
  identity: null,
  link: true,
  size: 35,

  classNames: ['gh-avatar'],
  attributeBindings: ['aria-label:identity.name'],

  avatarSrc: alias('identity.avatarSrc'),
  url: alias('identity.profileUrl'),
});
