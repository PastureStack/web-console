import Ember from 'ember';
import layout from '../templates/components/sortable-table';
import Sortable from '../mixins/sortable-base';
import StickyHeader from '../mixins/sticky-table-header';
import pagedArray from 'ember-cli-pagination/computed/paged-array';
import {isAlternate, isMore, isRange} from '../utils/platform';

const {get,set} = Ember;

function resolvedColumnKey(header, index) {
  return get(header, 'columnKey') || get(header, 'name') || `column-${index}`;
}

export default Ember.Component.extend(Sortable, StickyHeader, {
  layout,
  prefs:             Ember.inject.service(),
  body:              null,
  sortBy:            null,
  descending:        false,
  headers:           null,
  prefix:            false,
  suffix:            false,
  bulkActions:       true,
  search:            true,
  columnSelector:    false,
  columnPreference:  null,
  paging:            true,
  pageSizeOptions:   null,
  perPagePreference: null,
  onPageContentChange: null,
  animateLiveSort:   false,
  bulkActionsList:   null,
  bulkActionCallee:  null,
  perPage:           10,

  availableActions:  null,
  selectedNodes:     null,
  prevNode:          null,
  searchText:        null,
  page:              1,

  showHeader: Ember.computed.or('bulkActions','search','columnSelector','paging'),

  columnOptions: Ember.computed('headers.[]', 'columnSelector', function() {
    let headers = this.get('headers') || [];
    let preference = this.get('columnPreference');
    let saved = preference ? this.get(`prefs.${preference}`) : null;
    let savedVisible = saved && Ember.isArray(saved.visible) ? saved.visible : null;

    return Ember.A(headers.map((header, index) => {
      let key = resolvedColumnKey(header, index);
      let isActions = !!get(header, 'isActions');
      let visible = savedVisible ?
        savedVisible.indexOf(key) >= 0 :
        get(header, 'defaultHidden') !== true;

      return Ember.Object.create({
        key,
        header,
        translationKey: get(header, 'translationKey'),
        displayName: get(header, 'displayName'),
        hideable: this.get('columnSelector') && !isActions && get(header, 'hideable') !== false,
        visible: isActions ? true : visible,
      });
    }));
  }),

  selectableColumnOptions: Ember.computed('columnOptions.@each.hideable', function() {
    return Ember.A((this.get('columnOptions') || []).filterBy('hideable', true));
  }),

  visibleHeaders: Ember.computed('columnOptions.@each.visible', function() {
    return Ember.A((this.get('columnOptions') || [])
      .filterBy('visible', true)
      .mapBy('header'));
  }),

  visibleColumnMap: Ember.computed('columnOptions.@each.visible', 'bulkActions', function() {
    let output = {};
    let visible = (this.get('columnOptions') || []).filterBy('visible', true);

    visible.forEach((option) => {
      output[option.get('key')] = true;
    });
    output.count = visible.length + (this.get('bulkActions') ? 1 : 0);

    return Ember.Object.create(output);
  }),

  init: function() {
    this._super(...arguments);

    if ( !this.get('pageSizeOptions') ) {
      this.set('pageSizeOptions', [10, 25, 50, 100]);
    }

    if ( !this.get('paging') ) {
      this.set('perPage', 100000);
    }

    this.set('selectedNodes', []);
    this._updateFiltered();

    Ember.run.schedule('afterRender', () => {
      let tbody = Ember.$(this.element).find('table tbody');
      let self = this; // need this context in click function and can't use arrow func there

      tbody.on('click', 'tr', function(e) {
        self.rowClick(e);
      });

      tbody.on('mousedown', 'tr', function(e) {
        if ( isRange(e) || e.target.tagName === 'INPUT') {
          e.preventDefault();
        }

      });
    });
  },

  actions: {
    clearSearch() {
      this.set('searchText', '');
    },

    executeBulkAction(name, e) {
      e.preventDefault();
      if (isAlternate(e)) {
        var aa = this.get('availableActions');
        var action = aa.findBy('action', name);
        if (get(action, 'altAction')) {
          this.get('bulkActionCallee')(get(action, 'altAction'), this.get('selectedNodes'));
        } else {
          this.get('bulkActionCallee')(name, this.get('selectedNodes'));
        }
      } else {
        this.get('bulkActionCallee')(name, this.get('selectedNodes'));
      }
    },

    executeAction(action) {
      var node = this.get('selectedNodes')[0];
      node.send(action);
    },

    changePerPage(value) {
      let parsed = parseInt(value, 10);
      let options = this.get('pageSizeOptions') || [];

      if ( !Number.isFinite(parsed) || options.indexOf(parsed) === -1 ) {
        return;
      }

      this.setProperties({
        page: 1,
        perPage: parsed,
      });

      let preference = this.get('perPagePreference');

      if ( preference ) {
        this.get('prefs').set(preference, parsed);
      }
    },

    toggleColumn(option, event) {
      if ( event ) {
        event.preventDefault();
      }

      if ( !option || !option.get('hideable') ) {
        return;
      }

      option.toggleProperty('visible');
      Ember.run.debounce(this, this.persistColumnVisibility, 150);
    },
  },

  persistColumnVisibility() {
    let preference = this.get('columnPreference');

    if ( !preference ) {
      return;
    }

    let visible = (this.get('columnOptions') || [])
      .filterBy('visible', true)
      .mapBy('key');

    this.get('prefs').set(preference, {visible});
  },

  // -----
  // Table content
  // Flow: body [-> sortableContent] -> arranged -> filtered -> pagedContent
  // -----
  sortableContent: Ember.computed.alias('body'),
  pagedContent: pagedArray('filtered', {pageBinding:  "page", perPageBinding:  "perPage"}),

  // For data-title properties on <td>s
  dt: Ember.computed('visibleHeaders.@each.{name,displayName}', function() {
    let out = {};
    this.get('visibleHeaders').forEach((header) => {
      let name = get(header,'name');
      if ( name ) {
        out[name] = get(header, 'displayName') + ': ';
      }
    });

    return out;
  }),

  // Pick a new sort if the current column disappears.
  headersChanged: Ember.observer('visibleHeaders.@each.name', function() {
    let sortBy = this.get('sortBy');
    let headers = this.get('visibleHeaders') || [];
    if ( headers && headers.get('length') ) {
      let cur = headers.findBy('name', sortBy);
      if ( !cur ) {
        let fallback = headers.find((header) => get(header, 'name') && !get(header, 'isActions'));

        Ember.run.next(this, function() {
          if ( fallback ) {
            this.send('changeSort', get(fallback, 'name'));
          }
        });
      }
    }
  }),

  searchFields: Ember.computed('headers.@each.{searchField,name}', function() {
    let out = [];

    this.get('headers').forEach((header) => {
      let field = get(header, 'searchField');
      if ( field ) {
        if ( typeof field === 'string' ) {
          out.addObject(field);
        } else if ( Ember.isArray(field) ) {
          out.addObjects(field);
        }
      } else if ( field === false ) {
        // Don't add the name
      } else {
        out.addObject(get(header,'name'));
      }
    });

    return out;
  }),

  filtered: null,
  _filteredShouldChangeContent: Ember.observer('arranged.[]', function() {
    // Throttle so it's updated even if continuously changing
    Ember.run.throttle(this, '_updateFiltered', 100, false);
  }),
  _filteredShouldChangeSearch: Ember.observer('searchText', function() {
    // Debounce so it's not updating while typing even if continuously changing
    Ember.run.debounce(this, '_updateFiltered', 100, false);
  }),

  _updateFiltered() {
    let out = this.get('arranged').slice();
    let searchFields = this.get('searchFields');
    let searchText =  (this.get('searchText')||'').trim().toLowerCase();

    if ( searchText.length ) {
      let searchTokens = searchText.split(/\s*[, ]\s*/);

      for ( let j = 0 ; j < searchTokens.length ; j++ ) {
        let token = searchTokens[j];

        out = out.filter((item) => {
          for ( let i = 0 ; i < searchFields.length ; i++ ) {
            let field = searchFields[i];
            if ( field ) {
              let val = (item.get(field)+'').toLowerCase();
              if ( val && val.indexOf(token) >= 0) {
                return true;
              }
            }
          }
        });
      }
    }

    this.set('filtered', out);
  },

  pagedContentChanged: Ember.observer('pagedContent.[]', function() {
    // Remove selected items not in the current content
    let content = this.get('pagedContent');
    let nodesToRemove = this.get('selectedNodes').filter((node) => {
      return !content.includes(node);
    });

    this.toggleMulti([], nodesToRemove);
    this.notifyPageContentChange(content);
    this.scheduleRowAnimation();
  }),

  notifyPageContentChange(content) {
    let callback = this.get('onPageContentChange');

    if ( typeof callback === 'function' ) {
      callback(content && typeof content.toArray === 'function' ? content.toArray() : (content || []).slice());
    }
  },

  scheduleRowAnimation() {
    let previous = this._rowPositions || {};

    Ember.run.scheduleOnce('afterRender', this, this.animateRows, previous);
  },

  captureRowPositions() {
    let output = {};
    let element = this.get('element');

    if ( !element ) {
      return output;
    }

    Ember.$(element).find('tbody tr[data-row-id]').each(function() {
      let row = Ember.$(this);
      let id = row.attr('data-row-id');

      if ( id ) {
        output[id] = this.getBoundingClientRect().top;
      }
    });

    return output;
  },

  animateRows(previous) {
    let current = this.captureRowPositions();
    let liveFields = this.get('liveSortFields') || [];
    let shouldAnimate = this.get('animateLiveSort') && liveFields.indexOf(this.get('sortBy')) >= 0;
    let element = this.get('element');

    this._rowPositions = current;

    if ( !shouldAnimate || !element ) {
      return;
    }

    Ember.$(element).find('tbody tr[data-row-id]').each(function() {
      let row = this;
      let id = row.getAttribute('data-row-id');
      let oldTop = previous[id];
      let newTop = current[id];

      if ( oldTop === undefined || newTop === undefined || Math.abs(oldTop - newTop) < 1 ) {
        return;
      }

      row.style.transition = 'none';
      row.style.transform = `translateY(${oldTop - newTop}px)`;
      row.style.willChange = 'transform';
      row.offsetHeight;

      requestAnimationFrame(() => {
        row.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
        row.style.transform = 'translateY(0)';

        window.setTimeout(() => {
          if ( row.isConnected ) {
            row.style.removeProperty('transition');
            row.style.removeProperty('transform');
            row.style.removeProperty('will-change');
          }
        }, 400);
      });
    });
  },

  didInsertElement() {
    this._super(...arguments);
    Ember.run.scheduleOnce('afterRender', this, function() {
      this._rowPositions = this.captureRowPositions();
      this.notifyPageContentChange(this.get('pagedContent'));
    });
  },

  indexFrom: Ember.computed('page','perPage', function() {
    var current =  this.get('page');
    var perPage =  this.get('perPage');
    return Math.max(0, 1 + perPage*(current-1));
  }),

  indexTo: Ember.computed('indexFrom','perPage','filtered.length', function() {
    return Math.min(this.get('filtered.length'), this.get('indexFrom') + this.get('perPage') - 1);
  }),

  pageCountContent: Ember.computed('indexFrom','indexTo','pagedContent.totalPages', function() {
    let from = this.get('indexFrom') || 0;
    let to = this.get('indexTo') || 0;
    let count = this.get('filtered.length') || 0;
    let pages = this.get('pagedContent.totalPages') || 0;
    let out = '';

    if ( pages <= 1 ) {
      out = `${count} Item` + (count === 1 ? '' : 's');
    } else {
      out = `${from} - ${to} of ${count}`;
    }

    return out;
  }),

  pageCountChanged: Ember.observer('indexFrom', 'filtered.length', function() {
    // Go to the last page if we end up past the last page
    let from = this.get('indexFrom');
    let last = this.get('filtered.length');
    var perPage = this.get('perPage');

    if ( this.get('page') > 1 && from > last) {
      let page = Math.ceil(last/perPage);
      this.set('page', page);
    }
  }),

  sortKeyChanged: Ember.observer('sortBy', function() {
    this.set('page',1);
  }),

  // ------
  // Clicking
  // ------
  rowClick(e) {
    let tagName = e.target.tagName;
    let content = this.get('pagedContent');
    let selection = this.get('selectedNodes');
    let isCheckbox = tagName === 'INPUT' || Ember.$(e.target).hasClass('select-for-action');
    let nodeId = Ember.$(e.currentTarget).find('input[type="checkbox"]').attr('nodeid');
    let node = content.findBy('id', nodeId);

    if ( !node || tagName === 'A' ) {
      return;
    }

    let isSelected = selection.includes(node);

    let prevNode = this.get('prevNode');
    // PrevNode is only valid if it's in the current content
    if ( !content.includes(prevNode) ) {
      prevNode = null;
    }

    if ( !prevNode ) {
      prevNode = node;
    }

    if ( isMore(e) ) {
      this.toggleSingle(node);
    } else if ( isRange(e) ) {
      let from = content.indexOf(prevNode);
      let to = content.indexOf(node);
      [from, to] = [Math.min(from,to), Math.max(from,to)];
      let toToggle = content.slice(from,to+1);

      if ( isSelected ) {
        this.toggleMulti([], toToggle);
      } else {
        this.toggleMulti(toToggle,[]);
      }
    } else if ( isCheckbox ) {
      this.toggleSingle(node);
    } else {
      this.toggleMulti([node], content);
    }

    this.set('prevNode', node);
  },

  isAll: Ember.computed('selectedNodes.length', 'pagedContent.length', {
    get() {
      return this.get('selectedNodes.length') === this.get('pagedContent.length');
    },

    set(key, value) {
      var content = this.get('pagedContent');
      if ( value ) {
        this.toggleMulti(content, []);
          return true;
      } else {
        this.toggleMulti([], content);
          return false;
      }
    }
  }),

  toggleSingle(node) {
    let selectedNodes = this.get('selectedNodes');

    if ( selectedNodes.includes(node) ) {
      this.toggleMulti([], [node]);
    } else {
      this.toggleMulti([node], []);
    }
  },

  toggleMulti(nodesToAdd, nodesToRemove) {
    let selectedNodes = this.get('selectedNodes');

    if (nodesToRemove.length) {
      // removeObjects doesn't use ArrayProxy-safe looping
      if ( typeof nodesToRemove.toArray === 'function' ) {
        nodesToRemove = nodesToRemove.toArray();
      }
      selectedNodes.removeObjects(nodesToRemove);
      nodesToRemove.forEach((node) => {
        toggle(node, false);
      });
    }

    if (nodesToAdd.length) {
      selectedNodes.addObjects(nodesToAdd);
      nodesToAdd.forEach((node) => {
        toggle(node, true);
      });
    }

    function toggle(node, on) {
      let id = get(node,'id');
      if ( id ) {
        let input = Ember.$(`input[nodeid=${id}]`);
        if ( input && input.length ) {
          Ember.run.next(function() { input[0].checked = on; });
          Ember.$(input).closest('tr').toggleClass('row-selected', on);
        }
      }
    }
  },

  actionsChanged: Ember.observer('selectedNodes.@each.translatedAvailableActions', function() {
    let data = this.get('selectedNodes');
    var out = null;

    if (data.length > 1) {
      out = this.mergeBulkActions(data);
    } else if (data.length === 1) {
      out = this.mergeSingleActions(data[0]);
    }

    this.set('availableActions', out);
  }),

  mergeBulkActions(nodes) {
    var commonActions =  Ember.$().extend(true, [], this.get('bulkActionsList'));

    // loop over every selectedNode to find available actions
    nodes.forEach((item) => {
      let actions = get(item, 'translatedAvailableActions').filter((action) => {
        return action.enabled && action.bulkable;
      });

      commonActions.forEach((action) => {
        if (!actions.findBy('action', action.action)) {
          set(action, 'disabled', true);
        }
      });

    });

    return commonActions;
  },

  mergeSingleActions(node) {
    var commonActions =  Ember.$().extend(true, [], this.get('bulkActionsList'));
    var localActions =   [];

    // no others selected just push the availabe actions out
    localActions = get(node, 'translatedAvailableActions').filter((action) => {
      return action.enabled;
    });

    // combine both arrays into a unique set
    commonActions = commonActions.concat(localActions).uniqBy('action');

    // find items that need to be disbaled
    commonActions.forEach((action) => {
      if (!localActions.findBy('action', action.action)) {
        set(action, 'disabled', true);
      }
    });

    return commonActions;
  },
});
