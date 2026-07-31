import Mixin from '@ember/object/mixin';

export default Mixin.create({
  getPage: function() {
    return parseInt(this.get('page') || 1);
  },

  getPerPage: function() {
    return parseInt(this.get('perPage'));
  }
});