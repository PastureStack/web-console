import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import { get, computed } from '@ember/object';

function noop() {}

export function ungroupedSelectContent(content, groupPath='group') {
  return (content || []).filter((option) => !get(option, groupPath));
}

export function groupedSelectContent(content, groupPath='group') {
  let groups = [];

  (content || []).forEach((option) => {
    let key = get(option, groupPath);
    if ( !key ) {
      return;
    }

    let group = groups.find((item) => item.group === key);
    if ( !group ) {
      group = {group: key, options: []};
      groups.push(group);
    }

    group.options.push(option);
  });

  return groups.sort((a, b) => String(a.group).localeCompare(String(b.group)));
}

export default Component.extend({
  tagName: 'select',
  // possible passed-in values with their defaults:
  content: null,
  prompt: null,
  optionValuePath: 'value',
  optionLabelPath: 'label',
  optionGroupPath: 'group',
  optionDisabledPath: 'disabled',
  action: noop, // action to fire on change
  value: null,
  localizedLabel: false,
  disabled: false,
  attributeBindings: ['disabled'],

  ungroupedContent: computed('content.[]', 'content.@each.group', 'optionGroupPath', function() {
    return ungroupedSelectContent(this.get('content'), this.get('optionGroupPath'));
  }),

  groupedContent: computed('content.[]', 'content.@each.group', 'optionGroupPath', function() {
    return groupedSelectContent(this.get('content'), this.get('optionGroupPath'));
  }),

  // shadow the passed-in `selection` to avoid
  // leaking changes to it via a 2-way binding
  _selection: reads('selection'),

  init() {
    this._super(...arguments);
    if (!this.get('content')) {
      this.set('content', []);
    }

    this.on('change', this, this._change);
  },

  didRender: function () {
    const selectEl = this.$()[0];
    const value = this.get('value');
    for (let i = 0; i < selectEl.options.length; i++) {
      if(selectEl.options[i].value === value) {
        selectEl.value = value;
        break;
      }
    }

    if (value !== selectEl.value) {
      this._change();
    }
  },

  willDestroyElement() {
    this.off('change', this, this._change);
  },

  _change() {
    const selectEl = this.$()[0];
    const selectedIndex = selectEl.selectedIndex;
    if ( selectedIndex === -1 ) {
      return;
    }
    
    const selectedValue = selectEl.options[selectedIndex].value;
    const content = (this.get('content')||[]);

    const selection = content.filterBy(this.get('optionValuePath'), selectedValue)[0];

    if ( selection ) {
      // set the local, shadowed selection to avoid leaking
      // changes to `selection` out via 2-way binding
      this.set('_selection', selection);

      const changeCallback = this.get('action');
      if ( changeCallback )
      {
        changeCallback(selection);
      }

      this.set('value', get(selection, this.get('optionValuePath')));
    } else {
      this.set('value', null);
    }
  }
});
