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
  assert.expect(8);

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
  assert.equal(component.get('pagedContent.length'), 0, 'starts with an empty rendered page');

  Ember.run(() => body.pushObjects([
    Ember.Object.create({id: '2', name: 'Beta'}),
    Ember.Object.create({id: '1', name: 'Alpha'}),
  ]));

  afterFilterRefresh(() => {
    assert.equal(component.get('filtered.length'), 2, 'late rows become visible');
    assert.equal(component.get('pagedContent.length'), 2, 'late rows reach the rendered page');
    assert.deepEqual(component.get('filtered').mapBy('name'), ['Alpha', 'Beta'], 'late rows retain natural sorting');

    Ember.run(() => component.set('searchText', 'beta'));
    afterFilterRefresh(() => {
      assert.deepEqual(component.get('filtered').mapBy('name'), ['Beta'], 'search refreshes through the modern run-loop API');
      assert.deepEqual(component.get('pagedContent').mapBy('name'), ['Beta'], 'search refreshes the rendered page');

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
  assert.expect(5);

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
  assert.equal(component.get('pagedContent.length'), 0, 'rendered page starts without relationship rows');

  Ember.run(() => component.set('body', Ember.A([
    Ember.Object.create({id: '12', name: 'Container 12'}),
    Ember.Object.create({id: '2', name: 'Container 2'}),
  ])));

  afterFilterRefresh(() => {
    assert.equal(component.get('filtered.length'), 2, 'replacement relationship rows become visible');
    assert.equal(component.get('pagedContent.length'), 2, 'replacement relationship rows reach the rendered page');
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
  assert.expect(3);

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
  assert.equal(component.get('pagedContent.length'), 2, 'received body reaches the first rendered page');
  assert.deepEqual(component.get('filtered').mapBy('name'), ['Container 1', 'Container 9'], 'received body keeps natural sorting');
  destroyOwned(component);
});

test('it synchronizes page and page size without legacy string bindings', function(assert) {
  assert.expect(3);

  let component;
  let body = Ember.A([
    Ember.Object.create({id: '1', name: 'Container 1'}),
    Ember.Object.create({id: '2', name: 'Container 2'}),
    Ember.Object.create({id: '3', name: 'Container 3'}),
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
      perPage: 1,
      paging: true,
    }, 'component');
    component.didReceiveAttrs();
  });

  assert.deepEqual(component.get('pagedContent').mapBy('name'), ['Container 1'], 'first page uses the requested page size');

  Ember.run(() => component.set('page', 2));
  assert.deepEqual(component.get('pagedContent').mapBy('name'), ['Container 2'], 'changing page updates rendered rows');

  Ember.run(() => component.setProperties({page: 1, perPage: 2}));
  assert.deepEqual(component.get('pagedContent').mapBy('name'), ['Container 1', 'Container 2'], 'changing page size updates rendered rows');

  destroyOwned(component);
});

test('it keeps the invocation page size read-only while selecting all rows', function(assert) {
  assert.expect(6);

  let prefs = Ember.Object.create();
  let body = Ember.A([
    Ember.Object.create({id: '1', name: 'Volume 1'}),
    Ember.Object.create({id: '2', name: 'Volume 2'}),
    Ember.Object.create({id: '3', name: 'Volume 3'}),
  ]);
  let component;

  Ember.run(() => {
    component = createOwned(SortableTableComponent, {
      renderer: inertRenderer(),
      prefs,
      body,
      headers: Ember.A([
        Ember.Object.create({name: 'name', searchField: 'name'}),
      ]),
      sortBy: 'name',
      perPage: 1,
      pageSizeOptions: [1, 2, 0],
      perPagePreference: 'storageTableCount',
      paging: true,
    }, 'component');
    component.didReceiveAttrs();
  });

  assert.equal(component.get('perPage'), 1, 'retains the caller-owned input value');
  assert.equal(component.get('effectivePerPage'), 1, 'uses the initial input internally');

  Ember.run(() => component.send('changePerPage', '0'));

  assert.equal(component.get('perPage'), 1, 'does not write through the caller-owned input');
  assert.equal(component.get('selectedPageSize'), 0, 'keeps All selected in the control');
  assert.equal(component.get('pagedContent.length'), 3, 'renders every filtered row');
  assert.equal(prefs.get('storageTableCount'), 0, 'persists the semantic All preference');

  destroyOwned(component);
});

test('it clamps the current page immediately when live rows are removed', function(assert) {
  assert.expect(4);

  let body = Ember.A([
    Ember.Object.create({id: '1', name: 'Volume 1'}),
    Ember.Object.create({id: '2', name: 'Volume 2'}),
    Ember.Object.create({id: '3', name: 'Volume 3'}),
  ]);
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
      perPage: 1,
      paging: true,
    }, 'component');
    component.didReceiveAttrs();
    component.set('page', 3);
  });

  assert.equal(component.get('page'), 3, 'starts on the last page');
  assert.deepEqual(component.get('pagedContent').mapBy('name'), ['Volume 3'], 'renders the last row');

  Ember.run(() => {
    body.removeObjects(body.slice(1));
    component.didReceiveAttrs();
  });

  assert.equal(component.get('page'), 1, 'moves to the last valid page synchronously');
  assert.deepEqual(component.get('pagedContent').mapBy('name'), ['Volume 1'], 'renders the remaining row immediately');

  destroyOwned(component);
});
