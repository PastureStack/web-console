import { module, test } from 'qunit';

module('Unit | Vendor | Scoped AI confirmation modal layout');

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function frameFor(width, theme, direction, rows, kind) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const timeout = setTimeout(() => reject(new Error('AI modal CSS fixture did not load')), 10000);
    frame.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:1200px;opacity:0;pointer-events:none;border:0`;
    frame.onload = () => { clearTimeout(timeout); resolve(frame); };
    const suffix = direction === 'rtl' ? '.rtl' : '';
    const audit = kind === 'audit';
    const content = audit ? `<h2>Audit details</h2><div style="max-height:400px;overflow:auto"><h3>Request</h3><div style="max-height:400px;overflow:auto"><pre class="line-numbers language-javascript constrained"><code class="language-javascript">${escape(rows[0][1])}</code></pre></div></div>` : `<h3>Review</h3><dl class="horizontal-form">${rows.map(([name,value])=>`<dt class="force-wrap">${escape(name)}</dt><dd class="force-wrap">${kind === 'resource' ? '<pre class="ai-resource-diff-value">'+escape(value)+'</pre>' : escape(value)}</dd>`).join('')}</dl>`;
    frame.srcdoc = `<!doctype html><html dir="${direction}"><head>
      <link rel="stylesheet" href="/assets/vendor${suffix}.css"><link rel="stylesheet" href="/assets/ui-${theme}${suffix}.css">
      </head><body class="theme-ui-${theme}" style="margin:0"><div class="lacsso modal-overlay modal-open">
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
