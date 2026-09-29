import { module, test } from 'qunit';

module('Unit | Vendor | Growl viewport layout');

function growlFrame(asset, direction) {
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => reject(new Error(`Timed out loading ${asset}`)), 10000);

    frame.style.cssText = 'position:absolute;top:0;left:0;width:1440px;height:600px;opacity:0;pointer-events:none;border:0';
    frame.onload = () => {
      clearTimeout(timer);
      resolve(frame);
    };
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head>
      <link rel="stylesheet" href="/assets/vendor.css">
      <link rel="stylesheet" href="/assets/${asset}">
      </head><body style="margin:0">
      <header><nav class="navbar"></nav></header>
      <div id="jGrowl" class="jGrowl top-right">
        <div class="jGrowl-notification error" style="display:block">
          <div class="jGrowl-close">×</div>
          <div class="jGrowl-header">沒有權限建立服務</div>
          <div class="jGrowl-message">您沒有權限在此專案建立服務。</div>
        </div>
      </div></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('global notices clear the navbar and fit desktop and mobile viewports', async function(assert) {
  for (let theme of ['light', 'dark']) {
    for (let direction of ['ltr', 'rtl']) {
      let asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;
      let frame = await growlFrame(asset, direction);
      let page = frame.contentDocument;
      let notice = page.querySelector('.jGrowl-notification');

      for (let width of [1440, 375, 280]) {
        frame.style.width = `${width}px`;
        await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

        let navbar = page.querySelector('nav.navbar').getBoundingClientRect();
        let bounds = notice.getBoundingClientRect();
        let close = page.querySelector('.jGrowl-close').getBoundingClientRect();
        let context = `${asset} ${width}px`;

        assert.ok(bounds.top >= navbar.bottom, `${context}: notice starts below the navbar`);
        assert.ok(bounds.left >= -1 && bounds.right <= width + 1,
          `${context}: notice stays within the viewport`);
        assert.ok(bounds.width > 0 && bounds.height > 0, `${context}: notice remains visible`);
        assert.ok(close.left >= bounds.left && close.right <= bounds.right,
          `${context}: dismiss control remains inside the notice`);
        assert.strictEqual(frame.contentWindow.getComputedStyle(notice).opacity, '1',
          `${context}: notice remains opaque and readable`);
      }

      frame.remove();
    }
  }
});
