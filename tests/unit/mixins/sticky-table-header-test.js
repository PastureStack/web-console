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

  assert.equal(header.style.transform, 'translateX(-260px)');
  assert.equal(header.style.width, '1200px');
  assert.equal(actions.style.width, '600px');
  assert.ok(
    Math.abs(header.getBoundingClientRect().left - (host.getBoundingClientRect().left - 260)) <= 1,
    'the rendered header moves by the same amount as the body scroll'
  );

  run(() => subject.destroy());
  host.remove();
});
