import Ember from 'ember';

export default Ember.TextField.extend({
  attributeBindings: ['checked'],

  change(event) {
    let type = this.get('type');

    if (type === 'checkbox' || type === 'radio') {
      let checked = !!(this.element && this.element.checked);

      this.set('checked', checked);
      this.sendAction('change', checked, event);

      return;
    }

    return this._super(event);
  }
});
