// 📨 Teacher review in the real sandbox: a student ships Dodge the Drop, the teacher sends it back from the review page
// (MakeCode embed + rubric), the student gets the pop-up and fixes it, the teacher approves, the student sees it.
// Run: IFRAME=1 node tests/apps_script_app/serve.js dist/apps-script  then  node tests/browser/review_flow.js [screenshot folder]
const assert = require('assert');
const { chromium } = require('playwright');
const shots = process.argv[2] || '';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const H = 'http://localhost:5055', T = H + '/exec', fr = () => p.frames().find((x) => x.url().includes('127.0.0.1'));
  const SAM = 'sam@students.school.org', LID = 'dodge-the-drop';
  const run = async (as, fn, args) => (await (await p.request.post(H + '/__run', { data: JSON.stringify({ fn, args, as }) })).json()).value;
  const open = async (as, path, wait) => { await p.goto(`${T}?as=${encodeURIComponent(as)}&p=${encodeURIComponent(path)}`); await p.waitForTimeout(wait || 1500); };
  const shot = async (name) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png` }); };
  const follow = async () => {                     // after a save, the page moves on by itself or shows Continue
    await p.waitForTimeout(1500);
    if (await fr().isVisible('#go-box')) { await Promise.all([p.waitForNavigation(), fr().click('#go-box a')]); await p.waitForTimeout(1500); }
  };
  let dialogs = 0;
  p.on('dialog', (d) => { dialogs++; d.accept(); });

  const cls = await run('teacher@school.org', 'createClass', ['Period 3', 'g7']);
  await run('teacher@school.org', 'assignLessons', [cls.id, [LID], '', '']);
  await run(SAM, 'joinClass', [cls.code, 'Sam K.']);
  const L = require('../apps_script_app/fake_google').makeWorld(require('path').resolve(__dirname, '../../dist/apps-script')).g.DATA.lessons[LID];
  const api = (action, body) => run(SAM, 'api', [`/api/lessons/${LID}/${action}`, JSON.stringify(body)]);
  await api('mission', { talk: 'Tetris ends when the blocks reach the top.' });
  for (let i = 0; i < L.build.length; i++) {
    const st = L.build[i];
    await api('step', { i, tests: st.test.map((_, k) => k), answer: st.ask ? 'my answer' : '', fields: st.fields.map(() => '7') });
  }
  await api('quiz', { answers: L.quiz.map((q) => q.answer) });

  // the student ships from the lesson page
  await open(SAM, '/lessons/' + LID, 2200);
  assert.ok(await fr().isVisible('#share'), 'on Ship it');
  await fr().fill('#share', 'https://makecode.microbit.org/_Abc123XyZ');
  await fr().click('[data-ext="0"]');
  for (const t of await fr().$$('[data-reflect]')) await t.fill('A for loop counts; a while loop waits.');
  assert.match(await fr().textContent('#ship-go'), /Ship it to my teacher/);
  await fr().click('#ship-go');
  await p.waitForTimeout(1500);
  assert.match(await fr().textContent('.review-note.submitted'), /Sent to your teacher/);
  assert.match(await fr().textContent('.stage[data-stage="ship"]'), /with teacher/);
  await shot('1-student-sent');

  // the teacher: queue, then the review page with the project and the rubric
  await p.request.get(H + '/__advance?ms=90000');
  await open('teacher@school.org', '/');
  assert.match(await fr().textContent('.review-banner'), /1 shipped project to review/);
  await open('teacher@school.org', '/teacher/review');
  assert.match(await fr().textContent('.review-list'), /Sam K\./);
  await shot('2-teacher-queue');
  await Promise.all([p.waitForNavigation(), fr().click('.review-row')]);
  await p.waitForTimeout(1800);
  await shot('3a-teacher-review-top');
  const src = await fr().getAttribute('#mc-embed', 'src');
  assert.strictEqual(src, 'https://makecode.microbit.org/#pub:_Abc123XyZ');
  assert.strictEqual(await fr().$$eval('.rubric-row', (x) => x.length), 3);
  assert.ok(await fr().$$eval('.rubric-standards details', (x) => x.length) >= 1);
  await fr().click('#rb-approve');
  assert.match(await fr().textContent('#rb-msg'), /Score each row/);
  assert.strictEqual(await fr().$$eval('.rubric-row.unscored', (x) => x.length), 3);
  await fr().click('.seg-btn[data-view="sim"]');
  assert.match(await fr().getAttribute('#mc-embed', 'src'), /---run\?id=_Abc123XyZ/);
  await fr().click('.seg-btn[data-view="code"]');
  await fr().click('#rb-return');
  assert.match(await fr().textContent('#rb-msg'), /write a little feedback/);
  await fr().click('.rubric-row[data-row="works"] .level-btn[data-score="2"]');
  assert.match(await fr().textContent('#rb-total'), /2 of 12 \(2 rows to score\)/);
  await fr().fill('#rb-feedback', 'The drop never speeds up. Add the speed-up from step 7.');
  await p.waitForTimeout(800);
  await shot('3-teacher-review');
  await fr().click('#rb-return');
  await follow();
  assert.match(await fr().textContent('main'), /All caught up/);

  // the student gets the pop-up with the feedback and goes to fix it
  await open(SAM, '/', 2000);
  assert.ok(await fr().isVisible('.review-pop-card.returned'), 'sent-back pop-up');
  assert.match(await fr().textContent('.review-pop-card'), /speeds up/);
  assert.match(await fr().textContent('.review-home'), /asked for changes/);
  await shot('4-student-sent-back-popup');
  await Promise.all([p.waitForNavigation(), fr().click('#rp-fix')]);
  await p.waitForTimeout(2200);
  assert.match(await fr().textContent('.review-note.returned'), /asked for changes[\s\S]*speeds up/);
  assert.match(await fr().textContent('#ship-go'), /Ship it again/);
  await shot('5-student-fix-it');
  await fr().click('#ship-go');                     // same link as before: asks first (accepted here)
  await p.waitForTimeout(1500);
  assert.strictEqual(dialogs, 1, 'warned about the old share link');
  assert.match(await fr().textContent('.review-note.submitted'), /Sent to your teacher/);
  await open(SAM, '/', 1500);
  assert.ok(!(await fr().isVisible('.review-pop')), 'the pop-up shows once');

  // the teacher approves
  await p.request.get(H + '/__advance?ms=90000');
  await open('teacher@school.org', `/teacher/review/${LID}/${encodeURIComponent(SAM)}`, 1800);
  assert.match(await fr().textContent('h1'), /try 2|Waiting/);
  for (const [row, s] of [['works', 4], ['concept', 3], ['own', 4]]) await fr().click(`.rubric-row[data-row="${row}"] .level-btn[data-score="${s}"]`);
  assert.match(await fr().textContent('#rb-total'), /^11 of 12$/);
  await fr().fill('#rb-feedback', 'Great fix! The speed-up feels right.');
  await fr().click('#rb-approve');
  await follow();

  // the student: approved pop-up, the lesson is complete and locked
  await open(SAM, '/', 2000);
  assert.ok(await fr().isVisible('.review-pop-card.approved'), 'approved pop-up');
  assert.match(await fr().textContent('.review-pop-card'), /11 of 12[\s\S]*Great fix/);
  await shot('6-student-approved-popup');
  await fr().click('#rp-close');
  assert.ok(!(await fr().isVisible('.review-pop')));
  await open(SAM, '/lessons/' + LID, 2200);
  await fr().click('.stage[data-stage="ship"]');
  assert.match(await fr().textContent('.review-note.approved'), /Approved/);
  assert.ok(!(await fr().$('#ship-go')) && (await fr().isDisabled('#share')), 'locked');
  await shot('7-student-approved-lesson');

  assert.deepStrictEqual(errs, [], 'page errors: ' + errs.join(' | '));
  console.log('review flow checks passed');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
