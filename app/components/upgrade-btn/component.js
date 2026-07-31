import Component from '@ember/component';
import UpgradeComponent from 'ui/mixins/upgrade-component';

export default Component.extend(UpgradeComponent, {
  tagName             : 'button',
  classNames          : ['btn','btn-sm'],
  classNameBindings   : ['color'],

  click: function() {
    this.doUpgrade();
  },
});
