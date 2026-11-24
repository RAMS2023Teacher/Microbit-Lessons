// The robot shop on My robot: the Costume and Face tabs, buying a jersey with XP to spend, and wearing it.
// Run: IFRAME=1 node tests/apps_script_app/serve.js dist/apps-script  then  node tests/browser/costume_shop.js [screenshot.png]
const assert = require('assert');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  const H = 'http://localhost:5055', T = H + '/exec', fr = () => p.frames().find((x) => x.url().includes('127.0.0.1'));
  const SAM = 'sam@students.school.org';
  const run = async (as, fn, args) => (await (await p.request.post(H + '/__run', { data: JSON.stringify({ fn, args, as }) })).json());
  const cls = (await run('teacher@school.org', 'createClass', ['Period 3', 'g7'])).value;
  await run(SAM, 'joinClass', [cls.code, 'Sam K.']);
  for (let i = 0; i < 3; i++) await run('teacher@school.org', 'giveBonus', [SAM, 200, 'Great work ' + i, false]);
  await p.goto(`${T}?as=${SAM}&p=${encodeURIComponent('/me')}`); await p.waitForTimeout(2000);
  const tabs = await fr().$$eval('.part-tab', (x) => x.map((t) => t.textContent));
  assert.ok(tabs.includes('Costume') && tabs.includes('Face') && tabs.includes('Hats & gear'), tabs.join());
  await fr().click('.part-tab[data-part="outfit"]');
  assert.ok((await fr().$$('#part-options .part-opt')).length >= 13);
  assert.match(await fr().textContent('#part-options'), /#23 hoops jersey[\s\S]*250 XP/);
  await fr().click('#part-options .part-opt[title^="#23 hoops jersey"]');
  await p.waitForTimeout(1500);
  assert.match(await fr().textContent('#avatar-status'), /Bought #23 hoops jersey/);
  await fr().click('.part-tab[data-part="face"]');
  await fr().click('#part-options .part-opt[title^="Rosy cheeks"]');
  await fr().click('#avatar-save'); await p.waitForTimeout(1500);
  assert.match(await fr().textContent('#avatar-status'), /Saved/);
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  await p.goto(`${T}?as=${SAM}&p=${encodeURIComponent('/me')}`); await p.waitForTimeout(1800);
  assert.match(await fr().innerHTML('#avatar-preview'), />23</, 'still wearing the jersey after a reload');
  assert.deepStrictEqual(errs, []);
  console.log('costume shop checks passed');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
