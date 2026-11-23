// Partner picking in the real sandbox (serve.js with IFRAME=1): the server is busy, so the save takes ~8 s and
// Chrome won't let the page reload itself (problem report, 23 Nov). The picker must still see their partner, and a
// Continue button must load the shared work. Run: IFRAME=1 node tests/apps_script_app/serve.js dist/apps-script  then  node tests/browser/partner_pick.js
const assert = require('assert');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const T = 'http://localhost:5055/exec', fr = () => p.frames().find((x) => x.url().includes('127.0.0.1'));
  p.on('dialog', (d) => d.accept());
  await p.goto(T + '?as=teacher@school.org'); await p.waitForTimeout(1000);
  await fr().fill('#new-class', 'Period 3'); await fr().selectOption('#new-grade', 'g7'); await fr().click('#new-go'); await p.waitForTimeout(1500);
  const code = (await fr().textContent('.join-code b')).trim();
  for (const n of ['Ben', 'Ava']) {
    await p.goto(`${T}?as=${n.toLowerCase()}@students.school.org`); await p.waitForTimeout(700);
    await fr().fill('#j-code', code); await fr().fill('#j-name', n + ' K.'); await fr().click('#j-go'); await p.waitForTimeout(1300);
  }
  await p.request.get('http://localhost:5055/__advance?ms=90000');     // the class list is refreshed once a minute
  await p.goto(`${T}?as=ava@students.school.org&p=${encodeURIComponent('/lessons/dodge-the-drop')}`); await p.waitForTimeout(1800);
  await fr().selectOption('#partner-box select', { label: 'Ben K.' });
  await p.request.get('http://localhost:5055/__busy?n=3');          // Google turns the next 3 requests away: the save is slow
  await fr().click('#partner-box .btn');
  await p.waitForTimeout(12000);
  const box = await fr().textContent('#partner-box');
  console.log('picker sees:', box.trim().slice(0, 60));
  assert.match(box, /You picked Ben K\. as your partner/);
  const blocked = errs.some((e) => /permission to navigate/.test(e));
  if (await fr().isVisible('#go-box')) {
    console.log('reload was blocked; Continue button shown:', (await fr().textContent('#go-box p')).trim());
    await Promise.all([p.waitForNavigation(), fr().click('#go-box a')]);
    await p.waitForTimeout(1800);
    assert.match(await fr().textContent('#partner-box'), /You picked Ben K\./, 'after Continue');
  } else console.log('reload went through by itself');
  assert.ok(!blocked, 'no page error: ' + errs.join(' | '));
  console.log('partner pick checks passed', errs);
  await b.close();
})();
