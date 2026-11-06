import { module, test } from 'qunit';

module('Unit | Vendor | Scoped AI confirmation modal layout');

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function frameFor(width, theme, direction, rows, kind, { height = 1200, longPage = false } = {}) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const timeout = setTimeout(() => reject(new Error('AI modal CSS fixture did not load')), 10000);
    frame.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;opacity:0;pointer-events:none;border:0`;
    frame.onload = () => { clearTimeout(timeout); resolve(frame); };
    const suffix = direction === 'rtl' ? '.rtl' : '';
    const audit = kind === 'audit';
    const content = audit ? `<h2>Audit details</h2><div style="max-height:400px;overflow:auto"><h3>Request</h3><div style="max-height:400px;overflow:auto"><pre class="line-numbers language-javascript constrained"><code class="language-javascript">${escape(rows[0][1])}</code></pre></div></div>` : `<h3>Review</h3><dl class="horizontal-form">${rows.map(([name,value])=>`<dt class="force-wrap">${escape(name)}</dt><dd class="force-wrap">${kind === 'resource' ? '<pre class="ai-resource-diff-value">'+escape(value)+'</pre>' : escape(value)}</dd>`).join('')}</dl>`;
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head>
      <link rel="stylesheet" href="/assets/vendor${suffix}.css"><link rel="stylesheet" href="/assets/ui-${theme}${suffix}.css">
      </head><body class="theme-ui-${theme}" style="margin:0;${longPage ? 'min-height:3200px;' : ''}"><div class="lacsso modal-overlay modal-open">
      <div role="dialog" class="lacsso modal-container ${audit ? 'large-modal audit-log-detail-modal' : 'medium-modal ai-resource-review-modal'}">${content}
      <div class="footer-actions"><button>Close</button></div></div></div></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

test('upgrade and Resource Change confirmations retain complete long values within narrow RTL and desktop theme viewports', async function(assert) {
  const current = 'busybox@sha256:' + 'a'.repeat(64), requested = 'busybox@sha256:' + 'b'.repeat(64);
  const target = 'Environment/' + 'long-stack-'.repeat(12) + '/same-name';
  for (const [width, theme, direction] of [[390,'dark','rtl'],[390,'light','ltr'],[1440,'dark','rtl'],[1440,'light','ltr']]) {
    for (const kind of ['upgrade','resource']) {
      const rows = kind === 'upgrade' ? [['Target',target],['Current image',current],['Requested image',requested],
        ['Start first','true'],['Batch size','3'],['Interval','2500 ms']] : [['Target',target],['Health check',requested+'\nTCP 5432\n2000 ms']];
      const frame = await frameFor(width, theme, direction, rows, kind);
      try {
        await frame.contentDocument.fonts.ready;
        await new Promise(resolve => frame.contentWindow.requestAnimationFrame(resolve));
        const modal = frame.contentDocument.querySelector('[role="dialog"]'), bounds = modal.getBoundingClientRect();
        const label = `${width}/${theme}/${direction}/${kind}`;
        assert.ok(bounds.width <= Math.min(750,width-40)+1 && bounds.left >= -1 && bounds.right <= width+1, `${label}: modal fits viewport`);
        assert.ok(modal.scrollWidth <= modal.clientWidth+1, `${label}: no modal horizontal overflow`);
        for (const [index,value] of rows.entries()) {
          const cell=modal.querySelectorAll('dd')[index], valueElement=cell.querySelector('pre') || cell;
          assert.strictEqual(valueElement.textContent,value[1],`${label}: complete value retained`);
          assert.ok(cell.scrollWidth<=cell.clientWidth+1&&valueElement.scrollWidth<=valueElement.clientWidth+1,`${label}: wrapped row has no horizontal overflow`);
        }
      } finally { frame.remove(); }
    }
  }
});


test('audit details retain complete scrollable code within narrow RTL and desktop viewports', async function(assert) {
  const payload = '{"safeFixture":"' + 'SAFE_LONG_AUDIT_VALUE_'.repeat(80) + '"}';
  for (const [width, theme, direction] of [[390,'dark','rtl'],[1440,'light','ltr']]) {
    const frame = await frameFor(width, theme, direction, [['Request',payload]], 'audit');
    try {
      await frame.contentDocument.fonts.ready;
      await new Promise(resolve => frame.contentWindow.requestAnimationFrame(resolve));
      const modal = frame.contentDocument.querySelector('[role="dialog"]'), bounds = modal.getBoundingClientRect();
      assert.ok(bounds.width <= Math.min(990,width-40)+1 && bounds.left >= -1 && bounds.right <= width+1, `${width}: audit modal fits viewport`);
      assert.ok(modal.scrollWidth <= modal.clientWidth+1, `${width}: code cannot widen outer modal`);
      const code = modal.querySelector('code'), scroller = code.parentElement;
      assert.strictEqual(code.textContent,payload,`${width}: complete original payload retained`);
      assert.ok(scroller.scrollWidth>scroller.clientWidth,`${width}: long code remains horizontally scrollable`);
      assert.strictEqual(frame.contentWindow.getComputedStyle(scroller).overflowX,'auto',`${width}: native code scrolling preserved`);
    } finally { frame.remove(); }
  }
});


test('resource review stays inside the viewport on a scrolled page and retains reachable long content in both directions', async function(assert) {
  const longValue = 'SAFE_REVIEW_VALUE_'.repeat(60);
  for (const [width, height, theme, direction, kind, length] of [
    [1440,1000,'light','ltr','upgrade',6], [1440,1000,'dark','rtl','resource',20],
    [390,640,'dark','ltr','resource',20], [390,640,'light','rtl','upgrade',20]
  ]) {
    const rows = Array.from({length}, (_, index) => [`Field ${index}`, length > 6 ? longValue : `Value ${index}`]);
    const frame = await frameFor(width, theme, direction, rows, kind, { height, longPage: true });
    try {
      await frame.contentDocument.fonts.ready;
      frame.contentWindow.scrollTo(0,248);
      await new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
      const modal=frame.contentDocument.querySelector('[role="dialog"]'), title=modal.querySelector('h3');
      const bounds=modal.getBoundingClientRect(), label=`${width}/${height}/${theme}/${direction}/${kind}`;
      const measurement={label,innerWidth:frame.contentWindow.innerWidth,clientWidth:frame.contentDocument.documentElement.clientWidth,
        scrollbar:frame.contentWindow.innerWidth-frame.contentDocument.documentElement.clientWidth,
        left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom,width:bounds.width,height:bounds.height};
      console.info('AI_REVIEW_VIEWPORT_MEASUREMENT '+JSON.stringify(measurement));
      assert.strictEqual(frame.contentWindow.scrollY,248,`${label}: page remains scrolled`);
      assert.strictEqual(frame.contentWindow.getComputedStyle(modal).position,'fixed',`${label}: viewport anchored`);
      assert.ok(bounds.top>=19&&bounds.bottom<=height-19,`${label}: complete outer box inside viewport`);
      assert.ok(bounds.left>=19&&bounds.right<=width-19,`${label}: logical inline centering fits viewport ${JSON.stringify(measurement)}`);
      assert.ok(title.getBoundingClientRect().top>=bounds.top,`${label}: heading initially visible`);
      assert.ok(modal.scrollWidth<=modal.clientWidth+1,`${label}: no horizontal clipping`);
      assert.strictEqual(modal.querySelector('dd').textContent,rows[0][1],`${label}: full original review value retained`);
      if(length>6) assert.ok(modal.scrollHeight>modal.clientHeight,`${label}: long review scrolls internally`);
      modal.scrollTop=modal.scrollHeight;
      await new Promise(resolve=>frame.contentWindow.requestAnimationFrame(resolve));
      const footer=modal.querySelector('.footer-actions').getBoundingClientRect();
      assert.ok(footer.top>=bounds.top&&footer.bottom<=bounds.bottom+1,`${label}: footer reachable inside modal`);
      assert.strictEqual(frame.contentWindow.scrollY,248,`${label}: inner scroll does not reposition page`);
    } finally { frame.remove(); }
  }
});
