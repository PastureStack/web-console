import { module, test } from 'qunit';

module('Unit | Vendor | Pod empty message layout');

const RUSSIAN_EMPTY_MESSAGE = 'Ни хостов, ни контейнеров - скучно у вас тут!';
const LONG_UNBROKEN_MESSAGE = 'environment-with-a-very-long-unbroken-name-that-must-not-overflow';

function layoutFrame(asset, direction) {
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => reject(new Error(`Timed out loading ${asset}`)), 10000);

    frame.style.cssText = 'position:absolute;top:0;left:0;width:1440px;height:900px;opacity:0;pointer-events:none;border:0';
    frame.onload = () => {
      clearTimeout(timer);
      let pods = frame.contentDocument.querySelector('.pods');
      if (frame.contentWindow.getComputedStyle(pods).whiteSpace !== 'nowrap') {
        reject(new Error(`${asset} did not load the pod styles`));
      } else {
        resolve(frame);
      }
    };
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head><link rel="stylesheet" href="/assets/${asset}"></head><body style="margin:0"><section class="pods clearfix" style="margin-left:20px;width:calc(100% - 20px)"><div class="pod-empty-message text-center text-muted">${RUSSIAN_EMPTY_MESSAGE}</div><div class="pod-empty-message text-center text-muted">${LONG_UNBROKEN_MESSAGE}</div></section></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('empty pod messages wrap without changing pod-column nowrap in every CSS asset', async function(assert) {
  for (let theme of ['light', 'dark']) {
    for (let direction of ['ltr', 'rtl']) {
      let asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;
      let frame = await layoutFrame(asset, direction);
      let doc = frame.contentDocument;
      let pods = doc.querySelector('.pods');

      assert.strictEqual(frame.contentWindow.getComputedStyle(pods).whiteSpace, 'nowrap', `${asset} retains pod-column layout`);
      for (let width of [1440, 375, 320]) {
        frame.style.width = `${width}px`;
        await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(resolve));

        for (let message of doc.querySelectorAll('.pod-empty-message')) {
          let style = frame.contentWindow.getComputedStyle(message);
          assert.strictEqual(style.whiteSpace, 'normal', `${asset} at ${width}px wraps empty text`);
          assert.strictEqual(style.overflowWrap, 'anywhere', `${asset} at ${width}px wraps long words`);
          assert.ok(message.scrollWidth <= message.clientWidth + 1, `${asset} at ${width}px contains its message`);
        }
        assert.ok(doc.documentElement.scrollWidth <= width + 1, `${asset} at ${width}px has no page overflow`);
      }
      frame.remove();
    }
  }
});
