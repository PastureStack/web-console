import { module, test } from 'qunit';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import StickyTableHeader from 'lacsso/mixins/sticky-table-header';

module('Unit | Vendor | Header viewport layout');

function layoutFrame(asset, direction) {
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => reject(new Error(`Timed out loading ${asset}`)), 10000);

    frame.style.cssText = 'position:absolute;top:0;left:0;width:1440px;height:320px;opacity:0;pointer-events:none;border:0';
    frame.onload = () => {
      clearTimeout(timer);
      let menu = frame.contentDocument.querySelector('.project-menu');
      if (frame.contentWindow.getComputedStyle(menu).maxWidth === 'none') {
        reject(new Error(`${asset} did not load`));
      } else {
        resolve(frame);
      }
    };
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head><link rel="stylesheet" href="/assets/${asset}"></head><body style="margin:0"><header><nav class="navbar"><ul class="nav"><li class="dropdown project-btn" style="position:absolute;top:0;${direction === 'rtl' ? 'right' : 'left'}:68px;width:200px"><ul class="dropdown-menu project-menu block"><li class="dropdown-header">All environments</li><li><a class="clip" href="#">pst-permission-matrix-20260925-with-a-long-project-name</a></li></ul></li></ul></nav></header><section class="fail-whale"><div class="error"><h2>خطا</h2><div><h4>اجازه</h4><p>شما اجازه افزودن میزبان ندارید</p></div></div></section></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('environment menu fits desktop and narrow viewports in LTR and RTL assets', async function(assert) {
  for (let theme of ['light', 'dark']) {
    for (let direction of ['ltr', 'rtl']) {
      let asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;
      let frame = await layoutFrame(asset, direction);
      let menu = frame.contentDocument.querySelector('.project-menu');

      for (let width of [1440, 375, 320]) {
        frame.style.width = `${width}px`;
        await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

        let bounds = menu.getBoundingClientRect();
        assert.ok(bounds.left >= -1, `${asset} at ${width}px has no left clipping`);
        assert.ok(bounds.right <= width + 1, `${asset} at ${width}px has no right clipping`);
        assert.ok(menu.querySelector('a').scrollWidth <= menu.clientWidth + 1, `${asset} at ${width}px keeps project text inside the menu`);
      }

      frame.remove();
    }
  }
});

test('failure page follows the selected document direction in both themes', async function(assert) {
  for (let theme of ['light', 'dark']) {
    for (let direction of ['ltr', 'rtl']) {
      let asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;
      let frame = await layoutFrame(asset, direction);
      let page = frame.contentDocument;

      for (let selector of ['.fail-whale .error h2', '.fail-whale .error h4', '.fail-whale .error p']) {
        assert.strictEqual(frame.contentWindow.getComputedStyle(page.querySelector(selector)).direction, direction, `${asset} ${selector} uses ${direction}`);
      }

      frame.remove();
    }
  }
});

module('Unit | Vendor | Sortable table viewport layout');

function sortableTableFrame(asset, language, list, direction = 'ltr') {
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => reject(new Error(`Timed out loading ${asset}`)), 10000);
    let labels = language === 'zh-tw' ?
      {actions: '操作', columns: '欄位', rows: '每頁顯示', search: '搜尋'} :
      {actions: 'Actions', columns: 'Columns', rows: 'Rows per page', search: 'Search'};

    frame.style.cssText = 'position:absolute;top:0;left:0;width:1440px;height:600px;opacity:0;pointer-events:none;border:0';
    frame.onload = () => {
      clearTimeout(timer);
      let doc = frame.contentDocument;
      let host = doc.querySelector('.table-column-scroll-host');

      if (frame.contentWindow.getComputedStyle(host).maxWidth !== '100%') {
        reject(new Error(`${asset} did not load`));
        return;
      }

      // Match the shared sortable template's DOM after the resize utilities
      // have left their desktop inline widths on the table and sticky rows.
      let table = doc.createElement('table');
      let headingCount = list === 'containers' ? 7 : 10;
      let headings = Array.from({length: headingCount}, (_, i) => `<th style="width:250px">${i ? `Column ${i}` : labels.actions}</th>`).join('');
      let cells = Array.from({length: headingCount}, (_, i) => `<td data-title="Column ${i + 1}" style="width:250px">Container ${i + 1}</td>`).join('');

      table.className = `fixed grid sortable-table lacsso${list === 'host-containers' ? ' container-table table-fit-content' : ''}`;
      table.dataset.resizableColumns = 'true';
      table.style.cssText = 'width:1799px;min-width:1799px;max-width:none;table-layout:fixed';
      table.innerHTML = `<thead class="lacsso"><tr class="fixed-header-placeholder lacsso">${headings}</tr><tr class="fixed-header lacsso" style="position:relative;top:60px;left:40px;width:1799px;height:40px">${headings}</tr></thead><tbody class="lacsso"><tr>${cells}</tr></tbody>`;

      let actions = doc.createElement('div');

      actions.className = 'fixed-header-actions row lacsso';
      actions.style.cssText = 'position:relative;top:60px;left:40px;width:1799px;height:60px';
      actions.innerHTML = `${list === 'containers' ? `<div class="sortable-table-action-controls lacsso"><div class="container-actions lacsso"><button class="btn btn-sm bg-primary">${labels.actions}</button></div></div>` : ''}
        <div class="sortable-table-filter-controls lacsso"><div class="sortable-table-filter-bar lacsso">
          ${list === 'host-containers' ? `<div class="sortable-table-column-selector"><button class="btn btn-sm bg-default">${labels.columns}</button></div>` : ''}
          <label class="sortable-table-page-size"><span>${labels.rows}</span><select class="input-sm"><option>10</option></select></label>
          <div class="row inline-form gutless sortable-table-search lacsso"><span class="col span-3 input-label bg-default input-sm lacsso"><label>${labels.search}:</label></span><input class="col span-8 input-sm lacsso" type="search"></div>
        </div></div>
        <div class="sortable-table-pagination lacsso"><div class="pagination-centered"><ul class="pagination">${Array.from({length: 10}, (_, i) => `<li><a href="#">${i + 1}</a></li>`).join('')}</ul></div></div>`;
      table.tHead.insertBefore(actions, table.tHead.querySelector('.fixed-header'));
      host.appendChild(table);
      resolve(frame);
    };
    frame.srcdoc = `<!doctype html><html lang="${language}" dir="${direction}"><head><link rel="stylesheet" href="/assets/${asset}"></head><body style="margin:0"><main style="padding:0 40px"><div class="table-column-scroll-host table-column-scroll-host-overflowing"></div></main></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('Container and adjacent Host Container lists stay within 375px cards without changing desktop scrolling', async function(assert) {
  for (let language of ['zh-tw', 'en-us']) {
    for (let list of ['containers', 'host-containers']) {
      let frame = await sortableTableFrame('ui-light.css', language, list);
      let doc = frame.contentDocument;
      let host = doc.querySelector('.table-column-scroll-host');
      let table = host.querySelector('table');
      let actions = host.querySelector('.fixed-header-actions');
      let header = host.querySelector('tr.fixed-header');
      let subject = EmberObject.extend(StickyTableHeader).create({element: host, showHeader: true});

      for (let width of [1440, 375]) {
        frame.style.width = `${width}px`;
        await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

        let context = `${list} ${language} ${width}px`;

        assert.ok(doc.documentElement.scrollWidth <= width + 1, `${context}: page does not scroll horizontally`);

        if (width === 1440) {
          assert.ok(host.scrollWidth > host.clientWidth, `${context}: wide table still scrolls inside its host`);
          assert.ok(table.getBoundingClientRect().width >= 1700, `${context}: desktop column widths remain intact`);
          // Execute the real mixin transition; styling the fixture directly
          // would not catch a broken fixed-to-normal lifecycle.
          subject.removePositions();
          host.scrollLeft = host.scrollWidth - host.clientWidth;
          subject.syncHorizontalPosition();
          await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
          let actionBounds = actions.getBoundingClientRect();
          let hostBounds = host.getBoundingClientRect();

          assert.ok(actionBounds.left >= hostBounds.left - 1 &&
            actionBounds.right <= hostBounds.right + 1,
          `${context}: toolbar remains reachable after horizontal table scroll ` +
            `(host ${hostBounds.left}/${hostBounds.right}, actions ` +
            `${actionBounds.left}/${actionBounds.right}, scroll ${host.scrollLeft})`);
          host.scrollLeft = 0;
        } else {
          assert.ok(table.getBoundingClientRect().width <= host.clientWidth + 1, `${context}: table becomes a card`);
          assert.ok(actions.getBoundingClientRect().width <= host.clientWidth + 1, `${context}: action row drops its desktop width`);
          assert.ok(header.getBoundingClientRect().width <= host.clientWidth + 1, `${context}: hidden header drops its desktop width`);
          let hostRight = host.getBoundingClientRect().right;
          let overflowSources = Array.from(host.querySelectorAll('*')).filter((element) =>
            element.getBoundingClientRect().right > hostRight + 1 && frame.contentWindow.getComputedStyle(element).visibility !== 'hidden'
          ).slice(0, 8).map((element) => `${element.tagName}.${element.className || ''}:${Math.round(element.getBoundingClientRect().right - hostRight)}`);

          assert.ok(host.scrollWidth <= host.clientWidth + 1, `${context}: controls and card fit without local clipping (${host.scrollWidth}/${host.clientWidth}; ${overflowSources.join(', ')})`);

          for (let selector of ['.sortable-table-filter-bar', '.sortable-table-search', '.sortable-table-page-size', '.sortable-table-pagination', '.pagination']) {
            let control = host.querySelector(selector);
            let bounds = control.getBoundingClientRect();
            let hostBounds = host.getBoundingClientRect();

            assert.ok(bounds.width > 0 && bounds.height > 0, `${context}: ${selector} remains visible`);
            assert.ok(bounds.left >= hostBounds.left - 1 && bounds.right <= hostBounds.right + 1, `${context}: ${selector} stays in card`);
          }
        }
      }

      run(() => subject.destroy());
      frame.remove();
    }
  }
});

test('a floating table toolbar aligns with its scroll host in LTR and RTL', async function(assert) {
  for (let direction of ['ltr', 'rtl']) {
    let frame = await sortableTableFrame(`ui-light${direction === 'rtl' ? '.rtl' : ''}.css`,
      'en-us', 'containers', direction);
    let host = frame.contentDocument.querySelector('.table-column-scroll-host');
    let actions = host.querySelector('.fixed-header-actions');
    let hostBounds = host.getBoundingClientRect();
    let subject = EmberObject.extend(StickyTableHeader).create({element: host, showHeader: true});

    subject.positionHeaders();
    await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

    let bounds = actions.getBoundingClientRect();

    assert.ok(Math.abs(bounds.left - hostBounds.left) <= 1 &&
      Math.abs(bounds.right - hostBounds.right) <= 1,
    `${direction}: fixed toolbar remains aligned with host, not viewport edge`);
    host.scrollLeft = direction === 'rtl' ? -320 : 320;
    subject.syncHorizontalPosition();
    await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
    let headingCell = host.querySelector('tr.fixed-header th').getBoundingClientRect();
    let dataCell = host.querySelector('tbody td').getBoundingClientRect();
    let leadingEdge = direction === 'rtl' ? 'right' : 'left';
    assert.ok(Math.abs(headingCell[leadingEdge] - dataCell[leadingEdge]) <= 1,
    `${direction}: floating first column lines up with the data column ` +
      `(heading ${headingCell.left}/${headingCell.right}, data ${dataCell.left}/${dataCell.right})`);
    subject.removePositions();
    host.scrollLeft = direction === 'rtl' ? -320 : 320;
    subject.syncHorizontalPosition();
    await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
    bounds = actions.getBoundingClientRect();
    hostBounds = host.getBoundingClientRect();
    assert.ok(Math.abs(bounds.left - hostBounds.left) <= 1 &&
      Math.abs(bounds.right - hostBounds.right) <= 1,
    `${direction}: normal toolbar remains aligned after horizontal scrolling`);
    assert.strictEqual(actions.style.transform, '',
      `${direction}: dropdown remains outside a transformed containing block`);
    run(() => subject.destroy());
    frame.remove();
  }
});

test('a desktop side panel does not hide table actions or the last page', async function(assert) {
  for (let direction of ['ltr', 'rtl']) {
    let asset = `ui-light${direction === 'rtl' ? '.rtl' : ''}.css`;
    let frame = await sortableTableFrame(asset, 'en-us', 'containers', direction);
    let host = frame.contentDocument.querySelector('.table-column-scroll-host');
    let subject = EmberObject.extend(StickyTableHeader).create({element: host, showHeader: true});

    host.style.width = '700px';
    await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
    subject.removePositions();
    host.scrollLeft = direction === 'rtl' ? -300 : 300;
    subject.syncHorizontalPosition();
    await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
    let bounds = host.getBoundingClientRect();
    let controls = [];

    for (let selector of ['.sortable-table-action-controls button',
      '.sortable-table-page-size select', '.sortable-table-search input',
      '.pagination li:last-child a']) {
      let element = host.querySelector(selector);
      let item = element.getBoundingClientRect();
      assert.ok(item.width > 0 && item.left >= bounds.left - 1 &&
        item.right <= bounds.right + 1,
      `${direction} 700px host: ${selector} remains usable inside the panel ` +
        `(host ${bounds.left}/${bounds.right}, item ${item.left}/${item.right})`);
      let hit = frame.contentDocument.elementFromPoint(
        (item.left + item.right) / 2, (item.top + item.bottom) / 2);
      assert.ok(hit && (hit === element || element.contains(hit)),
        `${direction} 700px host: ${selector} is not covered by another control`);
      controls.push({selector, item});
    }
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        let a = controls[i].item;
        let b = controls[j].item;
        let overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        let overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

        assert.ok(overlapX <= 1 || overlapY <= 1,
          `${direction} 700px host: ${controls[i].selector} and ` +
          `${controls[j].selector} do not overlap (${overlapX}/${overlapY})`);
      }
    }
    subject.positionHeaders();
    await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
    let floatingHeadingTop = host.querySelector('tr.fixed-header').getBoundingClientRect().top;
    let lowestControlBottom = Math.max(...controls.map(({selector}) =>
      host.querySelector(selector).getBoundingClientRect().bottom));

    assert.ok(lowestControlBottom <= floatingHeadingTop + 1,
      `${direction} 700px host: floating column headings start below all controls ` +
      `(controls ${lowestControlBottom}, headings ${floatingHeadingTop})`);
    run(() => subject.destroy());
    frame.remove();
  }
});

test('desktop floating controls return to the mobile card without leaving a gap', async function(assert) {
  let frame = await sortableTableFrame('ui-light.css', 'zh-tw', 'containers');
  let host = frame.contentDocument.querySelector('.table-column-scroll-host');
  let table = host.querySelector('table');
  let actions = host.querySelector('.fixed-header-actions');
  let header = host.querySelector('tr.fixed-header');
  let subject = EmberObject.extend(StickyTableHeader).create({element: host, showHeader: true});

  subject.positionHeaders();
  assert.ok(parseInt(table.style.marginTop, 10) >= 100, 'desktop floating rows reserve their height');
  frame.style.width = '375px';
  await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
  subject.onResize();
  assert.strictEqual(table.style.marginTop, '', 'mobile card has no stale desktop spacer');
  assert.strictEqual(frame.contentWindow.getComputedStyle(actions).position, 'relative', 'mobile toolbar flows in the card');
  assert.strictEqual(frame.contentWindow.getComputedStyle(header).position, 'relative', 'mobile heading is not fixed');

  frame.style.width = '1440px';
  await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
  subject.positionHeaders();
  assert.strictEqual(frame.contentWindow.getComputedStyle(header).position, 'fixed', 'desktop floating header can be entered again');
  assert.ok(parseInt(table.style.marginTop, 10) >= 100, 'desktop spacer is restored only while floating');
  run(() => subject.destroy());
  frame.remove();
});

test('floating controls remeasure when a desktop side panel narrows their host', async function(assert) {
  let frame = await sortableTableFrame('ui-light.css', 'en-us', 'containers');
  let host = frame.contentDocument.querySelector('.table-column-scroll-host');
  let table = host.querySelector('table');
  let actions = host.querySelector('.fixed-header-actions');
  let heading = host.querySelector('tr.fixed-header');
  let subject = EmberObject.extend(StickyTableHeader).create({element: host, showHeader: true});

  subject.didInsertElement();
  subject.positionHeaders();
  let wideHeight = actions.getBoundingClientRect().height;
  let resized = new Promise((resolve) => {
    let observer = new frame.contentWindow.ResizeObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(host);
  });
  host.style.width = '700px';
  await resized;
  await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

  let lastControlBottom = Math.max(...['.sortable-table-action-controls button',
    '.sortable-table-page-size select', '.sortable-table-search input',
    '.pagination li:last-child a'].map((selector) =>
    host.querySelector(selector).getBoundingClientRect().bottom));
  let headingTop = heading.getBoundingClientRect().top;
  let hostBounds = host.getBoundingClientRect();
  let actionBounds = actions.getBoundingClientRect();
  assert.ok(actions.getBoundingClientRect().height > wideHeight, 'narrow host wraps controls into a taller toolbar');
  assert.ok(lastControlBottom <= headingTop + 1, `headings start below wrapped controls (${lastControlBottom}/${headingTop})`);
  assert.ok(parseInt(table.style.marginTop, 10) >= actions.getBoundingClientRect().height + 40,
    'table spacer follows the measured toolbar height');
  assert.ok(Math.abs(actionBounds.left - hostBounds.left) <= 1 &&
    Math.abs(actionBounds.right - hostBounds.right) <= 1, 'floating toolbar stays aligned with narrow host');

  resized = new Promise((resolve) => {
    let observer = new frame.contentWindow.ResizeObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(host);
  });
  host.style.width = '';
  await resized;
  await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));
  assert.ok(actions.getBoundingClientRect().height <= wideHeight + 1, 'wide host returns to one toolbar row');
  assert.strictEqual(parseInt(table.style.marginTop, 10),
    Math.max(60, Math.ceil(actions.getBoundingClientRect().height)) + 40,
  'desktop spacer shrinks to the measured toolbar height');

  subject.willDestroyElement();
  run(() => subject.destroy());
  frame.remove();
});
