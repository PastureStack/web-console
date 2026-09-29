import Component from '@ember/component';
import UpgradeComponent from 'ui/mixins/upgrade-component';

export default Component.extend(UpgradeComponent, {
  tagName             : 'button',
  classNames          : ['btn','btn-sm'],
  classNameBindings   : ['color'],
  attributeBindings   : ['disabled'],
  disabled            : function() {
    return !this.get('canApplyUpgrade');
  }.property('canApplyUpgrade'),

  click: function() {
    this.doUpgrade();
  },
});
