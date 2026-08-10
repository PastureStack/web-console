import Ember from 'ember';
import { naturalSort } from 'ui/utils/natural-sort';
const { get } = Ember;

export default Ember.Mixin.create({
  sortableContent: Ember.computed.alias('model'),
  headers: null,
  sortBy: null,
  descending: false,
  sortRevision: 0,
  liveSortFields: null,
  liveSortHysteresis: 0.05,

  actions: {
    changeSort: function(name) {
      if ( this.get('sortBy') === name )
      {
        this.set('descending', !this.get('descending'));
      }
      else
      {
        let headers = this.get('headers') || [];
        let header = headers.findBy('name', name);

        this.setProperties({
          descending: !!(header && get(header, 'defaultDescending')),
          sortBy: name
        });
      }
    },

    // Like changeSort, but without the auto-flipping
    setSort: function(name) {
      this.setProperties({
        descending: false,
        sortBy: name
      });
    },
  },

  currentSort: Ember.computed('sortBy','headers.@each.{name,sort}', function() {
    var headers = this.get('headers');
    if ( headers )
    {
      var header = headers.findBy('name', this.get('sortBy'));
      if ( header ) {
        let sort = get(header,'sort');
        if ( sort && sort.length) {
          return sort;
        }
      }
    }

    return ['id'];
  }),

  arranged: Ember.computed(
    'sortableContent.[]',
    'currentSort',
    'sortBy',
    'descending',
    'sortRevision',
    function() {
      let content = this.get('sortableContent') || [];
      let sortBy = this.get('sortBy');
      let descending = this.get('descending');
      let liveSortFields = this.get('liveSortFields') || [];
      let live = liveSortFields.indexOf(sortBy) >= 0;
      let orderKey = `${sortBy}:${descending}`;
      let previousOrder = [];

      if ( live && this._liveOrderKey === orderKey ) {
        previousOrder = this._liveOrder || [];
      }

      let output = naturalSort(content, this.get('currentSort'), {
        descending,
        previousOrder,
        hysteresis: live ? this.get('liveSortHysteresis') : 0,
      });

      if ( live ) {
        this._liveOrderKey = orderKey;
        this._liveOrder = output.map((item) => get(item, 'id'));
      } else {
        this._liveOrderKey = null;
        this._liveOrder = null;
      }

      return output;
    }
  ),
});
