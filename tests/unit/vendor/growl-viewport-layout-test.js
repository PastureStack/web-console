import { module, test } from 'qunit';

module('Unit | Vendor | Growl viewport layout');

function growlFrame(asset, direction, headingLayout) {
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
      </head><body style="margin:0" dir="${direction}">
      <header><nav class="navbar"></nav></header>
      <div id="growl-mount">
        <div id="jGrowl" class="jGrowl top-right">
          <div class="jGrowl-notification error" style="display:block">
            <div class="jGrowl-close">×</div>
            <div class="jGrowl-header">沒有權限建立服務</div>
            <div class="jGrowl-message">您沒有權限在此專案建立服務。</div>
          </div>
        </div>
      </div>
      <main><section class="${headingLayout}"><h1>應用程式堆疊</h1>
        <a class="btn btn-sm btn-primary">新增堆疊</a>
        <div class="pull-right"><button class="btn btn-sm btn-default">狀態</button></div>
      </section></main>
      </body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('global notices clear the navbar and page titles and fit the viewport', async function(assert) {
  for (let theme of ['light', 'dark']) {
    for (let direction of ['ltr', 'rtl']) {
      let asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;
      for (let headingLayout of ['header clearfix', 'clearfix']) {
        let frame = await growlFrame(asset, direction, headingLayout);
        let page = frame.contentDocument;
        let notice = page.querySelector('.jGrowl-notification');

        for (let width of [1440, 375, 280]) {
          frame.style.width = `${width}px`;
          await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

          let navbar = page.querySelector('nav.navbar').getBoundingClientRect();
          let bounds = notice.getBoundingClientRect();
          let close = page.querySelector('.jGrowl-close').getBoundingClientRect();
          let main = page.querySelector('main').getBoundingClientRect();
          let title = page.querySelector('main h1').getBoundingClientRect();
          let action = page.querySelector('main .btn').getBoundingClientRect();
          let headerActions = page.querySelector('main .pull-right').getBoundingClientRect();
          let context = `${asset} ${headingLayout} ${width}px`;

          assert.ok(bounds.top >= navbar.bottom, `${context}: notice starts below the navbar`);
          assert.ok(bounds.left >= -1 && bounds.right <= width + 1,
            `${context}: notice stays within the viewport`);
          assert.ok(bounds.bottom <= frame.contentWindow.innerHeight + 1,
            `${context}: notice stays above the viewport bottom`);
          assert.ok(bounds.width > 0 && bounds.height > 0, `${context}: notice remains visible`);
          assert.ok(close.left >= bounds.left && close.right <= bounds.right,
            `${context}: dismiss control remains inside the notice`);
          assert.ok(close.top >= bounds.top && close.bottom <= bounds.bottom,
            `${context}: dismiss control stays within the notice vertically`);
          assert.strictEqual(frame.contentWindow.getComputedStyle(notice).opacity, '1',
            `${context}: notice remains opaque and readable`);

          assert.ok(main.top >= bounds.bottom,
            `${context}: main content starts below the notice`);
          assert.ok(title.top >= bounds.bottom,
            `${context}: page title starts below the notice`);
          assert.ok(action.top >= bounds.bottom,
            `${context}: page action starts below the notice`);
          assert.ok(headerActions.top >= bounds.bottom && headerActions.right <= width + 1,
            `${context}: header actions clear the notice and fit the viewport`);
        }

        frame.remove();
      }
    }
  }
});
