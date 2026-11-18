// Browser check (docs/RELIABILITY.md test 4): when Google turns requests away ("too many simultaneous invocations"),
// the page shows "Busy… saving your work", shows no error, and the click is saved once the server answers again.
// Run: IFRAME=1 node tests/apps_script_app/serve.js dist/apps-script 5110 &  then  node tests/browser/busy_retry.js
const assert = require('assert');
const { chromium } = require('playwright');
(async () => {
  const PORT = process.env.PORT || 5110, T = `http://localhost:${PORT}/exec`, b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const fr = () => p.frames().find((x) => x.url().includes('127.0.0.1'));
  await p.goto(T + '?as=teacher@school.org'); await p.waitForTimeout(1000);
  await fr().fill('#new-class', 'Period 3'); await fr().selectOption('#new-grade', 'g7'); await fr().click('#new-go'); await p.waitForTimeout(1500);
  const code = (await fr().textContent('.join-code b')).trim();
  await p.goto(`${T}?as=sam@students.school.org`); await p.waitForTimeout(800);
  await fr().fill('#j-code', code); await fr().fill('#j-name', 'Sam K.'); await fr().click('#j-go'); await p.waitForTimeout(1500);
  await p.goto(`${T}?as=sam@students.school.org&p=${encodeURIComponent('/lessons/dodge-the-drop')}`); await p.waitForTimeout(1800);
  await fr().evaluate(() => { for (let i = 0; i < 20; i++) try { localStorage.setItem('ml-lesson-tour-' + i, '1'); } catch (e) {} });
  await fr().fill('#talk', 'Tetris ends when the blocks reach the top'); await p.waitForTimeout(1500);
  await fr().click('#mission-go'); await p.waitForTimeout(1500);
  // the next 3 server calls are turned away, then the student ticks a Test it box
  await fr().click('.stage[data-stage="build"]'); await p.waitForTimeout(800);
  await new Promise((r) => require('http').get(`http://localhost:${PORT}/__busy?n=3`, (res) => { res.resume(); res.on('end', r); }));
  await fr().click('[data-test="0"]');
  await p.waitForTimeout(2500);
  const note = await fr().$eval('#busy-note', (n) => !n.hidden).catch(() => false);
  console.log('busy note shown:', note);
  await p.waitForTimeout(12000);                                    // the retries wait 1.2 s, 2.2 s, 3.9 s (+ spread)
  const saved = await fr().textContent('#step-saved');
  const hidden = await fr().$eval('#busy-note', (n) => n.hidden).catch(() => true);
  console.log('after:', JSON.stringify(saved), 'note hidden:', hidden);
  await p.goto(`${T}?as=sam@students.school.org&p=${encodeURIComponent('/lessons/dodge-the-drop')}`); await p.waitForTimeout(1800);
  const ticked = await fr().evaluate(() => ML.data.state.steps && ML.data.state.steps[0] && ML.data.state.steps[0].tests);
  console.log('saved on the server:', JSON.stringify(ticked));
  assert.ok(note, 'the busy note appeared');
  assert.ok(/Saved/.test(saved) && hidden, 'saved, and the note went away');
  assert.deepStrictEqual(ticked, [0]);
  assert.deepStrictEqual(errs, []);
  console.log('busy retry check passed');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
