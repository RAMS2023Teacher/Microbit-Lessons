// Idle hints (client/lib/nudge.js): with short waits, walks join -> home -> Mission -> Build and prints what the hint points at.
// Run: IFRAME=1 node tests/apps_script_app/serve.js dist/apps-script   then   node tests/browser/nudge_hints.js <folder for screenshots>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const T = 'http://localhost:5055/exec', fr = () => p.frames().find(x => x.url().includes('127.0.0.1'));
  const fast = () => fr().evaluate(() => MLNudge.times({ first: 600, second: 1800, back: 300, away: 0 }));
  const bub = async () => fr().evaluate(() => { const x = document.getElementById('nudge-bubble'); return x ? x.className + ' | ' + x.textContent : null; });
  const log = (k, v) => console.log(k.padEnd(18), v);
  await p.goto(T + '?as=teacher@school.org'); await p.waitForTimeout(1000);
  log('teacher has nudge', await fr().evaluate(() => !!window.MLNudge));
  await fr().fill('#new-class', 'Period 3'); await fr().selectOption('#new-grade', 'g7'); await fr().click('#new-go'); await p.waitForTimeout(1500);
  const code = (await fr().textContent('.join-code b')).trim();
  await p.goto(`${T}?as=mia@students.school.org`); await p.waitForTimeout(800);
  await fast(); await p.waitForTimeout(900);
  log('join', await bub()); await p.screenshot({ path: out + '/1-join.png' });
  await fr().fill('#j-code', code); await p.waitForTimeout(100); log('after typing', await bub());
  await fr().fill('#j-name', 'Mia L.'); await fr().click('#j-go'); await p.waitForTimeout(1500);
  await fast(); await p.waitForTimeout(900); log('home', await bub()); await p.screenshot({ path: out + '/2-home.png' });
  await p.goto(`${T}?as=mia@students.school.org&p=${encodeURIComponent('/lessons/dodge-the-drop')}`); await p.waitForTimeout(1800);
  await fr().evaluate(() => { for (let i = 0; i < 20; i++) try { localStorage.setItem('ml-lesson-tour-' + i, '1'); } catch (e) {} });
  await fast(); await p.waitForTimeout(900); log('mission', await bub()); await p.screenshot({ path: out + '/3-mission.png' });
  await fr().click('#nudge-bubble'); await p.waitForTimeout(700); log('clicked bubble', await bub()); await p.screenshot({ path: out + '/3b-mission-jump.png' });
  await fr().fill('#talk', 'Games end when you lose'); await p.waitForTimeout(900); log('mission ready', await bub());
  await fr().click('#mission-go'); await p.waitForTimeout(900);
  await p.waitForTimeout(800); log('build 1', await bub()); await p.screenshot({ path: out + '/4-build.png' });
  await p.waitForTimeout(1500); log('build stage 2', await bub()); await p.screenshot({ path: out + '/5-build-strong.png' });
  log('help glows', await fr().evaluate(() => { const h = document.getElementById('help-ask'); return !!h && h.classList.contains('nudge-glow'); }));
  await fr().check('[data-test="0"]'); await p.waitForTimeout(900); log('all ticked', await bub()); await p.screenshot({ path: out + '/6-next.png' });
  await p.mouse.move(300, 300); await p.mouse.move(340, 320); log('after mouse move', (await bub()) ? 'still shown (fades later)' : 'gone');
  await p.keyboard.press('Shift'); log('after key', await bub());
  console.log('errors', errs);
  await b.close();
})();
