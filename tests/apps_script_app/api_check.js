// Runs the generated Apps Script app against fake Google services: a class, students joining, working
// through Dodge the Drop (Mission → Build → Quiz → Ship it), partners, XP and badges, and the teacher's pages.
// Called by tests/test_apps_script_app.py.
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { makeWorld } = require('./fake_google');
const dist = process.argv[2];
const w = makeWorld(dist);
const LID = 'dodge-the-drop';

/** A page's HTML plus its decoded page setup (ML.data), the way the browser's loader sees it. */
function pageView(who, p, world) {
  const html = (world || w).page(who, p).getContent();
  const m = /<div id="ml-code" hidden>([^<]*)<\/div>/.exec(html);
  if (!m) return html;
  const setup = Buffer.from(m[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return html + '\n' + setup;
}
function pageData(who, p) {
  const setup = pageView(who, p).split('\n').pop();
  return JSON.parse(setup.slice('window.ML='.length, setup.lastIndexOf(';'))).data;
}
const T = w.owner, S = 'sam@students.school.org', S2 = 'ava@students.school.org';
const api = (who, action, body, lid) => w.call(who, 'api', [`/api/lessons/${lid || LID}/${action}`, JSON.stringify(body || {})]);
const L = w.g.DATA.lessons[LID];

// setup and a class
assert.match(w.call(T, 'setup'), /Set up/);
const cls = w.call(T, 'createClass', ['Period 3']);
assert.strictEqual(w.call(T, 'assignLessons', [cls.id, [LID, 'no-such-lesson'], '2030-01-01', 'Bring a micro:bit']).added, 1);
assert.match(pageView(S), /"page":"join"/);
w.call(S, 'joinClass', [cls.code, 'Sam K.']);
w.call(S2, 'joinClass', [cls.code, 'Ava R.']);

// home: one clear next mission, badges, the assignment
let home = pageData(S, '/');
assert.strictEqual(home.next_up.lesson.id, LID);
assert.strictEqual(home.rows[0].lesson.id, LID);
assert.ok(home.badges.length >= 15 && home.badges.every((b) => !b.earned));
assert.strictEqual(home.total, 13);

// the lesson page: answers never reach the browser
const lp = pageView(S, '/lessons/' + LID);
const page = pageData(S, '/lessons/' + LID);
assert.strictEqual(page.stage, 'mission');
assert.ok(page.lesson.quiz.every((q) => !('answer' in q) && !('why' in q)));
assert.ok(!lp.includes(L.quiz[0].why.slice(0, 30)), 'quiz explanation leaked');
assert.strictEqual(page.key, null);
for (const id of w.g.DATA.order) assert.ok(!/"page":"error"/.test(pageView(S, '/lessons/' + id)), 'lesson page failed: ' + id);

// Mission
let r = api(S, 'mission', { talk: 'ok' });
assert.ok(r.body.ok && !r.body.stages.mission);                   // too short
r = api(S, 'mission', { talk: 'Tetris ends when the blocks reach the top.' });
assert.ok(r.body.stages.mission && r.body.rewards.xp_gained >= 10);

// Build: a step counts only when every test is ticked, the question answered and the blanks filled
r = api(S, 'step', { i: 1, tests: [0] });
assert.strictEqual(r.body.step_done, false);
r = api(S, 'step', { i: 1, tests: [0, 1], answer: '' });
assert.strictEqual(r.body.step_done, false);                       // the question isn't answered
r = api(S, 'step', { i: 1, answer: 'It counts forever. I was right.' });
assert.strictEqual(r.body.step_done, true);
assert.ok(r.body.rewards.items.some((x) => /Step done/.test(x.reason)));
const fieldsStep = L.build.findIndex((s) => s.fields.length);
r = api(S, 'step', { i: fieldsStep, tests: L.build[fieldsStep].test.map((_, k) => k), answer: 'left is negative', fields: ['-500', ''] });
assert.strictEqual(r.body.step_done, false);                       // a blank isn't filled
assert.strictEqual(api(S, 'step', { i: 99, tests: [] }).status, 400);
L.build.forEach((st, i) => api(S, 'step', { i, tests: st.test.map((_, k) => k), answer: st.ask ? 'my answer' : '', fields: st.fields.map(() => '7') }));
r = api(S, 'step', { i: 0, tests: [0] });
assert.ok(r.body.stages.build && r.body.stage === 'quiz');

// Quiz: graded on the server, pass at 75%
const right = L.quiz.map((q) => q.answer);
assert.strictEqual(api(S, 'quiz', { answers: [0] }).status, 400);
r = api(S, 'quiz', { answers: right.map((a) => (a + 1) % 4) });
assert.ok(!r.body.quiz.passed && !r.body.stages.quiz && r.body.quiz.results[0].why);
r = api(S, 'quiz', { answers: right });
assert.ok(r.body.quiz.passed && r.body.stages.quiz && r.body.stage === 'ship');
assert.ok(!r.body.rewards.items.some((x) => /first try/.test(x.reason)));   // second attempt

// Ship it: needs a MakeCode link, an extension and the reflections
r = api(S, 'ship', { share: 'https://example.com/x', ext: [], reflect: [], submit: true });
assert.strictEqual(r.body.ok, false);
assert.strictEqual(r.body.missing.length, 2 + L.ship.reflect.length);
r = api(S, 'ship', { share: 'https://makecode.microbit.org/_Abc123XyZ', ext: [0, 3], reflect: L.ship.reflect.map(() => 'A for loop counts; a while loop waits.'), submit: true });
assert.ok(r.body.shipped && r.body.percent === 100 && r.body.stage === 'done');
const names = r.body.rewards.badges.map((b) => b.id);
assert.ok(['finisher', 'shipper', 'game-maker'].every((b) => names.includes(b)), names.join());
assert.strictEqual(r.body.stars, 3);                               // perfect quiz (second try counts) + extension + shipped
const sam = w.g.loadStudent_(S);
assert.ok(sam.xp_keys['ext_3:' + LID] && sam.xp_keys['complete:' + LID]);

// partners: Ava picks Sam's classmate list; work is combined, then saves go to both
w.advance(120000);
assert.ok(api(S2, 'partner').body.classmates.some((m) => m.id === S));
r = api(S2, 'partner', { action: 'pair', partner_id: S });
assert.deepStrictEqual(r.body, { status: 'paired', name: 'Sam K.' });
const ava = w.g.loadStudent_(S2);
assert.ok(ava.progress[LID].shipped_at && w.g.percent_(ava.progress[LID], L) === 100);
assert.ok(ava.badges['finisher'] && ava.badges['teamwork']);
api(S2, 'ship', { reflect: ['Changed by Ava', 'still here'] });
assert.strictEqual(w.g.loadStudent_(S).progress[LID].reflect[0], 'Changed by Ava');
assert.strictEqual(api(S, 'partner', { action: 'leave' }).body.status, 'none');

// teacher: gradebook with the share link, student detail, class display, map, previews don't save
w.advance(120000);
const gb = w.call(T, 'gradebook', [cls.id]);
const cell = gb.grid[S + '|' + gb.cols[0].id];
assert.ok(cell.status === 'complete' && cell.share === 'https://makecode.microbit.org/_Abc123XyZ' && cell.quiz_best === L.quiz.length);
const det = w.call(T, 'studentDetail', [cls.id, S]).items.find((i) => i.id === LID);
assert.ok(det.p.talk && det.steps.length === L.build.length && det.reflect_q.length);
const scr = w.call(T, 'screenData', [cls.id]);
assert.strictEqual(scr.track.length, 4);
assert.ok(scr.students.some((s) => s.done === 4) && scr.question && scr.wins.length);
const tp = pageData(T, '/lessons/' + LID);
assert.ok(tp.key.quiz.length === L.quiz.length && tp.key.notes);
assert.ok(api(T, 'step', { i: 0, tests: [0] }).body.teacher);
assert.ok(api(T, 'quiz', { answers: right }).body.quiz.passed);
const map = pageData(S, '/map').map;
assert.strictEqual(map.nodes.length, 13);
assert.strictEqual(map.nodes.find((n) => n.id === LID).state, 'complete');
assert.ok(map.nodes.every((n) => !n.soon), 'a lesson is missing');
assert.match(w.call(T, 'classroomPackage', [cls.id, 'both', [LID]]).assignments[0].title, /Dodge the Drop/);
assert.throws(() => w.call(S, 'gradebook', [cls.id]), /Only the teacher/);

// every page renders for the teacher and a student
for (const p of ['/', '/lessons', '/map', '/help', '/teacher/standards', '/teacher/videos', `/teacher/classes/${cls.id}`,
  `/teacher/classes/${cls.id}/students/${encodeURIComponent(S)}`, `/teacher/classes/${cls.id}/google-classroom`, `/teacher/classes/${cls.id}/screen`, '/lessons/' + LID]) {
  assert.ok(!/"page":"error"/.test(pageView(T, p)), 'teacher page failed: ' + p);
}
for (const p of ['/', '/lessons', '/map', '/me', '/help', '/lessons/' + LID]) assert.ok(!/"page":"error"/.test(pageView(S, p)), 'student page failed: ' + p);

// the install check, and broken installs get a plain message
const report = w.call(T, 'checkInstall');
assert.ok(!/❌ (Files|Assets|Data)/.test(report), report);
function broken(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-broken-'));
  for (const f of fs.readdirSync(dist)) fs.copyFileSync(path.join(dist, f), path.join(dir, f));
  edit(dir);
  return makeWorld(dir).page(T, '/').getContent();
}
assert.match(broken((d) => fs.writeFileSync(path.join(d, 'Assets.gs'), fs.readFileSync(path.join(d, 'Assets.gs'), 'utf8').replace(/BUILD_STAMPS\["Assets"\] = "\w+";/, ''))),
  /Assets\.gs is missing or was cut short/);
assert.match(broken((d) => fs.writeFileSync(path.join(d, 'Data.gs'), fs.readFileSync(path.join(d, 'Data.gs'), 'utf8').replace(/BUILD_STAMPS\["Data"\] = "\w+"/, 'BUILD_STAMPS["Data"] = "old"'))),
  /Data\.gs is from a different version/);

// what reaches the browser survives Apps Script's comment stripping: only the two slash-free scripts
const served = w.page(S, '/lessons/' + LID).getContent();
const scripts = served.match(/<script\b[\s\S]*?<\/script>/g);
assert.strictEqual(scripts.length, 2);
assert.ok(scripts.every((x) => !/\/\/|\/\*/.test(x)), 'a page script contains // or /*');
console.log('apps script app passed');
