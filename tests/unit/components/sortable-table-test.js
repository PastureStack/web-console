import Ember from 'ember';
import { module, test } from 'qunit';

import SortableTableComponent from 'lacsso/components/sortable-table';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | sortable table');

function afterFilterRefresh(callback) {
  Ember.run.later(callback, 140);
}

test('it refreshes rows when a relationship is populated after initialization', function(assert) {
  assert.expect(5);

  let done = assert.async();
  let body = Ember.A([]);
  let component;

  Ember.run(() => {
    component = createOwned(SortableTableComponent, {
      renderer: inertRenderer(),
      prefs: Ember.Object.create(),
      body,
      headers: Ember.A([
        Ember.Object.create({name: 'name', searchField: 'name'}),
      ]),
      sortBy: 'name',
      paging: false,
    }, 'component');
  });

  assert.equal(component.get('filtered.length'), 0, 'starts empty');

  Ember.run(() => body.pushObjects([
    Ember.Object.create({id: '2', name: 'Beta'}),
    Ember.Object.create({id: '1', name: 'Alpha'}),
  ]));

  afterFilterRefresh(() => {
    assert.equal(component.get('filtered.length'), 2, 'late rows become visible');
    assert.deepEqual(component.get('filtered').mapBy('name'), ['Alpha', 'Beta'], 'late rows retain natural sorting');

    Ember.run(() => component.set('searchText', 'beta'));
    afterFilterRefresh(() => {
      assert.deepEqual(component.get('filtered').mapBy('name'), ['Beta'], 'search refreshes through the modern run-loop API');

      Ember.run(() => component.set('searchText', ''));
      afterFilterRefresh(() => {
        assert.equal(component.get('filtered.length'), 2, 'clearing search restores every row');
        destroyOwned(component);
        done();
      });
    });
  });
});

test('it refreshes rows when the relationship collection replaces the initial body', function(assert) {
  assert.expect(3);

  let done = assert.async();
  let component;

  Ember.run(() => {
    component = createOwned(SortableTableComponent, {
      renderer: inertRenderer(),
      prefs: Ember.Object.create(),
      headers: Ember.A([
        Ember.Object.create({name: 'name', searchField: 'name'}),
      ]),
      sortBy: 'name',
      paging: false,
    }, 'component');
  });

  assert.equal(component.get('filtered.length'), 0, 'starts without a relationship collection');

  Ember.run(() => component.set('body', Ember.A([
    Ember.Object.create({id: '12', name: 'Container 12'}),
    Ember.Object.create({id: '2', name: 'Container 2'}),
  ])));

  afterFilterRefresh(() => {
    assert.equal(component.get('filtered.length'), 2, 'replacement relationship rows become visible');
    assert.deepEqual(
      component.get('filtered').mapBy('name'),
      ['Container 2', 'Container 12'],
      'replacement relationship rows retain natural sorting'
    );
    destroyOwned(component);
    done();
  });
});

test('it derives initial rows after invocation attributes are received', function(assert) {
  assert.expect(2);

  let component;
  let body = Ember.A([
    Ember.Object.create({id: '9', name: 'Container 9'}),
    Ember.Object.create({id: '1', name: 'Container 1'}),
  ]);

  Ember.run(() => {
    component = createOwned(SortableTableComponent, {
      renderer: inertRenderer(),
      prefs: Ember.Object.create(),
      body,
      headers: Ember.A([
        Ember.Object.create({name: 'name', searchField: 'name'}),
      ]),
      sortBy: 'name',
      paging: false,
    }, 'component');
    component.set('filtered', Ember.A([]));
    component.didReceiveAttrs();
  });

  assert.equal(component.get('filtered.length'), 2, 'received body is visible before the first render');
  assert.deepEqual(component.get('filtered').mapBy('name'), ['Container 1', 'Container 9'], 'received body keeps natural sorting');
  destroyOwned(component);
});
