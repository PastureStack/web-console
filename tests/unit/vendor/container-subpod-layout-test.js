import { module, test } from 'qunit';

module('Unit | Vendor | Container subpod name layout');

const NAMES = [
  'pasturestack-server-v1.6.496-rollback-20261001T161902Z',
  'pasturestack-server-v1.6.497-rollback-20261002T022057Z',
  'pasturestack-server-v1.6.498-rollback-20261002T054238Z',
  'pasturestack-server-v1.6.499-rollback-20261002T064106Z',
  'pasturestack-server',
  'containerwithaverylongunbrokennameandadistinguishingsuffix',
  '容器名稱與完整回復版本必須可辨識',
  'short'
];

function layoutFrame(asset, direction) {
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => reject(new Error(`Timed out loading ${asset}`)), 10000);

    frame.style.cssText = 'position:absolute;top:0;left:0;width:1440px;height:1200px;opacity:0;pointer-events:none;border:0';
    frame.onload = () => {
      clearTimeout(timer);
      if (frame.contentWindow.getComputedStyle(frame.contentDocument.querySelector('.container-subpod')).display !== 'flex') {
        reject(new Error(`${asset} did not load the container pod styles`));
      } else {
        resolve(frame);
      }
    };
    let rows = NAMES.map((name, index) => `<div class="subpod instance"><div class="container-subpod"><div class="subpod-name clip"><i class="dot"></i><a href="#container-${index}"><span>${name}</span></a></div><div class="subpod-detail">172.17.0.2</div><div class="btn-group resource-actions action-menu"><button class="btn btn-default btn-xs more-actions must-propagate" type="button" aria-label="Actions" aria-controls="resource-actions" aria-haspopup="menu" aria-expanded="false"><i class="icon icon-fw icon-vertical-ellipsis"></i></button></div></div>${index === 0 ? '<div class="subpod-children clearfix"><h6 class="pull-left">Related containers</h6><span><i class="dot"></i></span></div>' : ''}</div>`).join('');
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head><link rel="stylesheet" href="/assets/${asset}"></head><body style="margin:0"><div class="pod" style="width:260px;margin:0">${rows}</div></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

for (let theme of ['light', 'dark']) {
  for (let direction of ['ltr', 'rtl']) {
    let asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;

    test(`${asset}: full names remain readable beside IP and actions`, async function(assert) {
      let frame = await layoutFrame(asset, direction);
      let doc = frame.contentDocument;

      try {
        for (let width of [1440, 375, 320]) {
          frame.style.width = `${width}px`;
          await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

          for (let [index, row] of Array.from(doc.querySelectorAll('.container-subpod')).entries()) {
            let name = row.querySelector('.subpod-name');
            let detail = row.querySelector('.subpod-detail');
            let actions = row.querySelector('.resource-actions');
            let style = frame.contentWindow.getComputedStyle(name);
            let bounds = [name, detail, actions].map((node) => node.getBoundingClientRect());
            let range = doc.createRange();
            range.selectNodeContents(name.querySelector('span'));
            let glyphs = Array.from(range.getClientRects());
            let context = `${asset}/${width}/${index}`;

            assert.strictEqual(name.textContent.trim(), NAMES[index], `${context}: retains full source name`);
            assert.strictEqual(style.whiteSpace, 'normal', `${context}: wraps rather than ellipsizes`);
            assert.strictEqual(style.overflowWrap, 'anywhere', `${context}: unbroken suffixes fit`);
            assert.ok(name.scrollWidth <= name.clientWidth + 1 && name.scrollHeight <= name.clientHeight + 1, `${context}: no hidden name overflow`);
            assert.ok(glyphs.length > 0 && glyphs.every((rect) => rect.width > 0 && rect.height > 0 && rect.left >= bounds[0].left - 1 && rect.right <= bounds[0].right + 1 && rect.top >= bounds[0].top - 1 && rect.bottom <= bounds[0].bottom + 1), `${context}: nonempty visible glyphs fit on every line`);
            let sorted = bounds.slice().sort((a, b) => a.left - b.left);
            assert.ok(sorted[0].right <= sorted[1].left + 1 && sorted[1].right <= sorted[2].left + 1, `${context}: name, IP and actions do not overlap`);
            assert.ok(detail.scrollWidth <= detail.clientWidth + 1 && bounds[2].width >= 20, `${context}: IP and action trigger remain usable`);
            if (index < 4) {
              assert.ok(new Set(glyphs.map((rect) => Math.round(rect.top))).size > 1, `${context}: rollback text really occupies multiple visible lines`);
            }
          }
          assert.ok(doc.documentElement.scrollWidth <= width + 1, `${asset}/${width}: no horizontal page overflow`);
          let child = doc.querySelector('.subpod-children');
          assert.ok(child.getBoundingClientRect().top >= doc.querySelector('.container-subpod').getBoundingClientRect().bottom, `${asset}/${width}: child remains below parent`);
        }
      } finally {
        frame.remove();
      }
    });
  }
}
