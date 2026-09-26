import { module, test } from 'qunit';

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
