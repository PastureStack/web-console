import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import StickyTableHeader from 'lacsso/mixins/sticky-table-header';

function fixture() {
  let host = document.createElement('div');

  host.style.cssText = 'position:relative;width:600px;overflow-x:auto;';
  host.innerHTML = [
    '<table style="width:1200px">',
    '  <thead>',
    '    <tr class="fixed-header-actions" style="position:fixed"></tr>',
    '    <tr class="fixed-header" style="position:fixed"><th>Name</th><th>CPU</th></tr>',
    '  </thead>',
    '  <tbody>',
    '    <tr><td style="width:600px">container-a</td><td style="width:600px">10%</td></tr>',
    '  </tbody>',
    '</table>',
  ].join('');
  document.body.appendChild(host);

  return host;
}

module('Unit | Mixin | sticky table header');

test('it follows the table scroll host horizontally', function(assert) {
  let host = fixture();
  let Subject = EmberObject.extend(StickyTableHeader);
  let subject = Subject.create({
    element: host,
    showHeader: true,
  });
  let header = host.querySelector('.fixed-header');
  let actions = host.querySelector('.fixed-header-actions');

  host.scrollLeft = 260;
  subject.syncHorizontalPosition();

  assert.equal(header.style.left, `${host.querySelector('table').getBoundingClientRect().left}px`);
  assert.equal(header.style.transform, '');
  assert.equal(header.style.width, '1200px');
  assert.equal(actions.style.width, '600px');
  assert.equal(actions.style.right, 'auto', 'the sticky RTL inset cannot override fixed positioning');

  host.scrollLeft = 80;
  subject.syncHorizontalPosition();

  assert.equal(header.style.left, `${host.querySelector('table').getBoundingClientRect().left}px`,
    'the header follows subsequent body scroll changes');

  run(() => subject.destroy());
  host.remove();
});

test('the non-floating actions fit the scroll host instead of the wide table', function(assert) {
  let host = fixture();
  let Subject = EmberObject.extend(StickyTableHeader);
  let subject = Subject.create({element: host, showHeader: true});
  let actions = host.querySelector('.fixed-header-actions');

  actions.style.position = 'relative';
  host.querySelector('.fixed-header').style.position = 'relative';
  subject.buildTableWidths();
  host.scrollLeft = 260;
  subject.syncHorizontalPosition();

  assert.strictEqual(actions.style.width, '600px', 'all controls stay within the viewport');
  assert.strictEqual(actions.style.left, '260px',
    'actions counter-scroll while the data columns move');
  host.scrollLeft = 80;
  subject.syncHorizontalPosition();
  assert.strictEqual(actions.style.left, '80px',
    'subsequent horizontal scrolls preserve the alignment');
  assert.strictEqual(host.querySelector('.fixed-header').style.width, '1200px',
    'table columns retain their independently scrollable width');

  run(() => subject.destroy());
  host.remove();
});
