import { module, test } from 'qunit';

module('Unit | Vendor | AI pending review content layout');

const copies = [
  {locale: 'en-us', review: 'Review pending plan', language: 'English', cli: 'Download CLI'},
  {locale: 'zh-tw', review: '檢閱待核准計畫', language: '繁體中文', cli: '下載命令列工具'},
  {locale: 'fa-ir', review: 'بررسی طرح در انتظار تأیید', language: 'فارسی', cli: 'بارگیری ابزار خط فرمان'},
  {locale: 'de-de', review: 'Vorgesehenen und noch nicht genehmigten Plan überprüfen', language: 'Deutsch', cli: 'Befehlszeilenprogramm herunterladen'},
];
const escaped = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function layoutFrame(asset, direction) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const timer = setTimeout(() => reject(new Error(`Timed out loading ${asset}`)), 10000);
    frame.style.cssText = 'position:absolute;top:0;left:0;width:1440px;height:1000px;opacity:0;pointer-events:none;border:0';
    frame.onload = () => { clearTimeout(timer); resolve(frame); };
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head>
      <link rel="stylesheet" href="/assets/vendor.css"><link rel="stylesheet" href="/assets/${asset}">
      </head><body class="theme-ui-${asset.startsWith('ui-dark') ? 'dark' : 'light'}" dir="${direction}" style="margin:0"><div id="application">
        <main class="clearfix">
          <div class="alert alert-danger force-wrap" role="alert" data-testid="ai-resource-authorization-denied"></div>
          <div class="alert alert-info ai-upgrade-pending" role="status" data-testid="ai-upgrade-pending">
            <span class="ai-upgrade-pending-target force-wrap"></span>
            <button type="button" class="btn btn-sm btn-primary" data-testid="ai-upgrade-review"></button>
          </div>
          <section style="min-height:180px"><h1>Owned fixture route content</h1></section>
        </main>
        <footer><a href="#" class="btn btn-sm btn-link">About</a><a href="#" class="btn btn-sm btn-link">Help</a>
          <div class="pull-right"><div class="dropdown footer-dropdown compose-download inline-block">
            <button type="button" class="dropdown-toggle btn btn-sm btn-link" data-footer-cli></button>
          </div></div>
          <div class="pull-right"><div class="dropdown footer-dropdown language-dropdown inline-block">
            <button type="button" class="dropdown-toggle btn btn-sm btn-link lang-select" data-footer-language></button>
          </div></div>
        </footer>
      </div></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('pending and authorization notices stay in content flow and leave footer controls actionable in narrow RTL layouts', async function(assert) {
  for (const theme of ['light', 'dark']) for (const direction of ['ltr', 'rtl']) {
    const asset = `ui-${theme}${direction === 'rtl' ? '.rtl' : ''}.css`;
    const frame = await layoutFrame(asset, direction), page = frame.contentDocument;
    const notice = page.querySelector('[data-testid="ai-upgrade-pending"]');
    assert.strictEqual(frame.contentWindow.getComputedStyle(notice).display, 'flex', `${asset}: current component stylesheet loaded`);
    for (const width of [1440, 390, 280]) {
      frame.style.width = `${width}px`;
      await new Promise(resolve => frame.contentWindow.requestAnimationFrame(resolve));
      for (const copy of copies) for (const longPath of [false, true]) {
        page.documentElement.lang = copy.locale;
        page.querySelector('.ai-upgrade-pending-target').innerHTML = escaped(longPath ? ('Default / owned-' + 'verylongunbrokenname'.repeat(40)).slice(0, 768) : 'Default / owned-fixture');
        page.querySelector('[data-testid="ai-resource-authorization-denied"]').textContent = `${copy.review}: previous background operation was denied; keep the original receipt.`;
        page.querySelector('[data-testid="ai-upgrade-review"]').textContent = copy.review;
        page.querySelector('[data-footer-language]').textContent = copy.language;
        page.querySelector('[data-footer-cli]').textContent = copy.cli;
        const label = `${asset}/${width}/${copy.locale}/${longPath ? 'long' : 'short'}`;
        const bounds = notice.getBoundingClientRect(), review = page.querySelector('[data-testid="ai-upgrade-review"]').getBoundingClientRect();
        assert.ok(bounds.left >= -1 && bounds.right <= width + 1 && notice.scrollWidth <= notice.clientWidth + 1, `${label}: reminder fits without horizontal overflow`);
        assert.ok(review.left >= bounds.left && review.right <= bounds.right + 1, `${label}: translated review button stays inside reminder`);
        assert.ok(review.top >= bounds.top && review.bottom <= bounds.bottom + 1, `${label}: wrapped review button stays inside reminder vertically`);
        assert.ok(bounds.bottom <= page.querySelector('footer').getBoundingClientRect().top + 1, `${label}: reminder clears footer`);
        for (const selector of ['[data-footer-language]', '[data-footer-cli]']) {
          const control = page.querySelector(selector); control.scrollIntoView({block: 'center'});
          const box = control.getBoundingClientRect(), hit = page.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          assert.ok(box.left >= -1 && box.right <= width + 1 && hit && control.contains(hit), `${label}: ${selector} receives normal pointer input`);
        }
      }
    }
    frame.remove();
  }
});
