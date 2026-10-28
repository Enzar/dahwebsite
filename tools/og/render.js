const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  for (const k of process.argv.slice(2)) { await p.goto('file://' + __dirname + '/og-' + k + '.html'); await p.waitForTimeout(300); await p.screenshot({ path: __dirname + '/og-' + k + '.png' }); }
  await b.close();
})();
