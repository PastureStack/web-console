import Ember from 'ember';
import { module, test } from 'qunit';

import NewSelectComponent, {
  groupedSelectContent,
  ungroupedSelectContent
} from 'ui/components/new-select/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new select');

test('it exposes catalog version options through class-level computed properties', function(assert) {
  let content = Ember.A([
    {version: 'v0.3.15 (current)', link: '/templates/healthcheck:0'},
    {version: 'v0.3.16-pasturestack.1', link: '/templates/healthcheck:1'},
  ]);
  let component;

  Ember.run(() => {
    component = createOwned(NewSelectComponent, {
      renderer: inertRenderer(),
      content: content,
      optionLabelPath: 'version',
      optionValuePath: 'link',
    }, 'component');
  });

  assert.deepEqual(
    component.get('ungroupedContent').map((option) => option.version),
    ['v0.3.15 (current)', 'v0.3.16-pasturestack.1']
  );
  assert.deepEqual(component.get('groupedContent'), []);

  Ember.run(() => content.pushObject({version: 'v0.3.17', link: '/templates/healthcheck:2'}));
  assert.equal(component.get('ungroupedContent.length'), 3, 'updates when a version is added');

  destroyOwned(component);
});

test('it partitions grouped and ungrouped choices without losing options', function(assert) {
  let content = [
    {label: 'Automatic', value: 'auto'},
    {label: 'Node B', value: 'b', group: 'Nodes'},
    {label: 'Node A', value: 'a', group: 'Nodes'},
    {label: 'Zone A', value: 'zone-a', group: 'Zones'},
  ];

  assert.deepEqual(ungroupedSelectContent(content), [content[0]]);
  assert.deepEqual(groupedSelectContent(content), [
    {group: 'Nodes', options: [content[1], content[2]]},
    {group: 'Zones', options: [content[3]]},
  ]);
});
