// Screenshots of every wiring picture in every view (breakout, clips, circuit diagram): node tests/browser/wiring_pictures.js <folder>   (serve.js running with IFRAME=1)
const { chromium } = require('playwright');
const { makeWorld } = require('../apps_script_app/fake_google');
const D = makeWorld(require('path').join(__dirname, '../../dist/apps-script')).g.DATA;
(async () => {
  const out = process.argv[2], b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 1500 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const T = 'http://localhost:5055/exec', fr = () => p.frames().find(x => x.url().includes('127.0.0.1'));
  let n = 0;
  for (const L of Object.values(D.lessons).filter(l => l.course === 'g7').sort((a, b) => a.number - b.number)) {
    const steps = L.build.map((s, i) => (s.breadboard ? i : -1)).filter(i => i >= 0);
    if (!steps.length) continue;
    await p.goto(`${T}?as=teacher@school.org&p=${encodeURIComponent('/lessons/' + L.id)}`); await p.waitForTimeout(1500);
    await fr().evaluate(() => { for (let i = 0; i < 20; i++) try { localStorage.setItem('ml-lesson-tour-' + i, '1'); } catch (e) {} });
    await fr().click('.stage[data-stage="build"]'); await p.waitForTimeout(400);
    for (const i of steps) {
      await fr().click(`.step-dots button[data-step="${i}"]`); await p.waitForTimeout(1300);
      const fig = await fr().$('.wire-pic');
      if (!fig) { console.log('MISSING', L.id, i); continue; }
      const base = `${out}/${String(L.number).padStart(2, '0')}-${i + 1}`;
      await (await fr().$('.wire-pic')).screenshot({ path: base + '-a.png' });
      n++;
      if (await fr().isVisible('#kit-pick [data-kit="diagram"]')) { await fr().click('#kit-pick [data-kit="diagram"]'); await p.waitForTimeout(500); await (await fr().$('.wire-pic')).screenshot({ path: base + '-c.png' }); n++;
        await fr().click((await fr().isVisible('#kit-pick [data-kit="breakout"]')) ? '#kit-pick [data-kit="breakout"]' : '#kit-pick [data-kit="clips"]'); await p.waitForTimeout(300); }
      if (await fr().isVisible('#kit-pick [data-kit="clips"]') && await fr().isVisible('#kit-pick [data-kit="breakout"]')) { await fr().click('#kit-pick [data-kit="clips"]'); await p.waitForTimeout(900); await (await fr().$('.wire-pic')).screenshot({ path: base + '-b.png' }); await fr().click('#kit-pick [data-kit="breakout"]'); await p.waitForTimeout(300); n++; }
    }
  }
  console.log('pictures', n, 'errors', errs);
  await b.close();
})();
