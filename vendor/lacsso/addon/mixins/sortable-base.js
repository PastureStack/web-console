import { alias } from '@ember/object/computed';
import Mixin from '@ember/object/mixin';
import { get, computed } from '@ember/object';
import { naturalSort } from 'ui/utils/natural-sort';

export default Mixin.create({
  sortableContent: alias('model'),
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

  currentSort: computed('sortBy','headers.@each.{name,sort}', function() {
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

  arranged: computed(
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
