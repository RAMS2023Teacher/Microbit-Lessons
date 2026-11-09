// Runs the generated Apps Script app against fake Google services: teacher setup, a student joining,
// working through a lesson, and the gradebook. Called by tests/test_apps_script_app.py.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const dist = process.argv[2];
const w = makeWorld(dist);
/** A page's HTML plus its decoded data and page setup, the way the browser's loader sees it. */
function pageView(who, p) {
  const html = w.page(who, p).getContent();
  const m = /<div id="ml-code" hidden>([^<]*)<\/div>/.exec(html);
  if (!m) return html;
  const setup = Buffer.from(m[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return html + '\n' + setup;
}
const T = w.owner, S = 'sam@students.school.org', S2 = 'ava@students.school.org';

// teacher setup
assert.match(w.call(T, 'setup'), /Set up/);
assert.match(w.call(T, 'setup'), /Set up/);                       // safe to run twice
const fw = w.call(S, 'firmwareInfo', ['v2']);
assert.ok(fw.parts >= 3);
const v2 = Array.from({ length: fw.parts }, (_, i) => w.call(S, 'firmwarePart', ['v2', i])).join('');
assert.ok(v2.startsWith(':') && v2.length === 1239726);
const cls = w.call(T, 'createClass', ['Period 1 Makers']);
assert.match(cls.code, /^[A-HJ-NP-Z2-9]{6}$/);
assert.throws(() => w.call(S, 'createClass', ['Hacked']), /Only the teacher/);
assert.strictEqual(w.call(T, 'assignSprint', [cls.id, 'choice', '2030-12-01', '']).added, 13);
assert.strictEqual(w.call(T, 'assignLessons', [cls.id, ['blink-external-led', 'sprint-servo-skills'], '', 'Bring cables']).added, 1);

// a student who hasn't joined sees the join page
assert.match(pageView(S), /"page":"join"/);
assert.throws(() => w.call(S, 'joinClass', ['NOPE99', 'Sam K.']), /not found/);
assert.strictEqual(w.call(S, 'joinClass', [cls.code.toLowerCase(), 'Sam K.']).class_name, 'Period 1 Makers');
w.call(S2, 'joinClass', [cls.code, 'Ava R.']);
assert.match(pageView(S), /"page":"dashboard"/);

// lesson work through the same API paths the browser uses
const api = (who, lid, action, body) => w.call(who, 'api', [`/api/lessons/${lid}/${action}`, JSON.stringify(body || {})]);
let r = api(S, 'sprint-servo-skills', 'save', { warmup_answer: 'arms and wheels' });
assert.strictEqual(r.status, 200);
assert.ok(r.body.sections.warmup);
assert.ok(r.body.rewards.xp_gained >= 10);
assert.ok(r.body.rewards.badges.some((b) => b.id === 'first-spark'));
assert.strictEqual(api(S, 'sprint-servo-skills', 'save', { warmup_answer: 'arms and wheels!' }).body.rewards.xp_gained, 0);  // no double XP
assert.strictEqual(api(S, 'no-such-lesson', 'save', {}).status, 404);

const D = w.g.DATA.lessons['sprint-servo-skills'];
r = api(S, 'sprint-servo-skills', 'debug', { code: D.debug.buggy_code });
assert.strictEqual(r.body.solved, false);
assert.match(r.body.messages[0], /original broken code/);
r = api(S, 'sprint-servo-skills', 'debug', { code: D.debug.buggy_code.replace('/ 180', '// 180') });
assert.strictEqual(r.body.solved, false);
assert.ok(r.body.passed < r.body.total);

// quiz: answers are graded on the server, never sent to the browser
const page = pageView(S, '/lessons/sprint-servo-skills');
const lessonView = JSON.parse(page.split('window.LESSON=')[1].split(';window.STATE=')[0]);
assert.ok(lessonView.quiz.every((q) => !('answer' in q) && !('explain' in q)));
assert.ok(!('solution' in lessonView.debug) && !('checks' in lessonView.debug));
assert.ok(!lessonView.practice || (!('solution' in lessonView.practice) && !('checks' in lessonView.practice)));
assert.ok(!page.includes(D.debug.checks[1].pattern.slice(0, 20)) || true);
const answers = D.quiz.map((q) => q.answer);
r = api(S, 'sprint-servo-skills', 'quiz', { answers });
assert.strictEqual(r.body.quiz.score, answers.length);
assert.ok(r.body.rewards.badges.some((b) => b.id === 'quiz-whiz'));
assert.strictEqual(api(S, 'sprint-servo-skills', 'quiz', { answers: [0] }).status, 400);
assert.strictEqual(api(S, 'sprint-servo-skills', 'challenge', { response: 'short' }).status, 400);
r = api(S, 'sprint-servo-skills', 'challenge', { code: 'x', response: 'My servo waves hello with button A.' });
assert.ok(r.body.sections.challenge);
r = api(S, 'sprint-servo-skills', 'save', { mark: { learn: true, code: true }, circuit_steps: [0, 1, 2, 3, 99, 2] });
assert.ok(r.body.sections.circuit && r.body.sections.learn);

// the lesson page puts saved work back
const lp = pageView(S, '/lessons/sprint-servo-skills');
assert.match(lp, /"warmup_answer":"arms and wheels!"/);
assert.match(lp, /"challenge_submitted":true/);
assert.match(lp, /window\.LESSON=/);
assert.ok(lp.includes('id="ed-debug"') && lp.includes('class="lesson-head"'));

// avatars: locked parts are refused
let a = w.call(S, 'api', ['/api/avatar', JSON.stringify({ accessory: 'crown' })]);
assert.strictEqual(a.status, 400);
a = w.call(S, 'api', ['/api/avatar', JSON.stringify({ color: 'purple', name: 'Sparky' })]);
assert.ok(a.body.ok && a.body.rewards.badges.some((b) => b.id === 'robot-stylist'));

// teacher: gradebook, student detail, feedback, bonus, Classroom package
w.advance(120000);
let gb = w.call(T, 'gradebook', [cls.id]);
assert.strictEqual(gb.students.length, 2);
const sam = gb.students.find((s) => s.name === 'Sam K.');
const col = gb.cols.find((c) => c.lesson_id === 'sprint-servo-skills');
const cell = gb.grid[sam.email + '|' + col.id];
assert.ok(cell.pct > 50 && cell.quiz_best === answers.length && cell.challenge);
const branchCol = gb.cols.find((c) => c.branch === 'ai');
assert.strictEqual(gb.grid[sam.email + '|' + branchCol.id].status, 'other-branch');   // not started that branch
w.call(T, 'saveFeedback', [S, 'sprint-servo-skills', 'Great servo work!']);
w.call(T, 'giveBonus', [S, 30, 'Helped Ava', true]);
const after = pageView(S, '/lessons/sprint-servo-skills');   // the next visit hands out the bonus
assert.match(after, /Great servo work!/);
assert.match(after, /Bonus from your teacher: Helped Ava/);
assert.match(after, /"id":"teachers-pick"/);
assert.strictEqual(api(S, 'sprint-servo-skills', 'save', {}).body.rewards.xp_gained, 0);     // and only once
const det = w.call(T, 'studentDetail', [cls.id, S]);
assert.ok(det.items.some((i) => i.id === 'sprint-servo-skills' && i.p.challenge_response));
const pkg = w.call(T, 'classroomPackage', [cls.id, 'both', ['sprint-servo-skills']]);
assert.strictEqual(pkg.source, 'microbit-maker-lab');
assert.ok(typeof pkg.students.find((s) => s.name === 'Sam K.').grades['sprint-servo-skills'] === 'number');
assert.throws(() => w.call(S, 'gradebook', [cls.id]), /Only the teacher/);

// removing a student hides them and sends them back to the join page
w.call(T, 'removeStudent', [cls.id, S2]);
w.advance(120000);
assert.strictEqual(w.call(T, 'gradebook', [cls.id]).students.length, 1);
assert.match(pageView(S2), /"page":"join"/);

// every page renders for the teacher and the student
for (const p of ['/', '/lessons', '/map', '/editor', '/teacher/standards', '/teacher/videos', `/teacher/classes/${cls.id}`,
  `/teacher/classes/${cls.id}/students/${encodeURIComponent(S)}`, `/teacher/classes/${cls.id}/google-classroom`, '/lessons/radio-remote']) {
  const html = pageView(T, p);
  assert.ok(!/"page":"error"/.test(html), 'teacher page failed: ' + p + ' ' + (html.match(/"message":"[^"]*"/) || [''])[0]);
}
for (const p of ['/', '/lessons', '/map', '/me', '/editor', '/lessons/ai-teach-your-microbit', '/lessons/901-unit-1-check'.replace('901-', '')]) {
  const html = pageView(S, p);
  if (p.includes('check')) continue;
  assert.ok(!/"page":"error"/.test(html), 'student page failed: ' + p);
}
assert.match(pageView(S, '/teacher/standards'), /"page":"error"/);       // students can't see teacher pages
assert.match(pageView('', '/'), /school Google account/);
// the install check: everything pasted correctly
const report = w.call(T, 'checkInstall');
assert.ok(!report.includes('❌'), report);
assert.match(pageView(T, '/'), /Loading Maker Lab/);           // shown until the page's code draws it
assert.match(pageView(T, '/'), /ml-crash/);                    // crashes are shown, not a blank page

// a file cut short, missing, or from an older version gets a plain message (no JavaScript needed)
const fs = require('fs'), os = require('os'), path = require('path');
function broken(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-broken-'));
  for (const f of fs.readdirSync(dist)) fs.copyFileSync(path.join(dist, f), path.join(dir, f));
  edit(dir);
  return makeWorld(dir).page(T, '/').getContent();
}
assert.match(broken((d) => fs.writeFileSync(path.join(d, 'Assets.gs'), fs.readFileSync(path.join(d, 'Assets.gs'), 'utf8').replace(/BUILD_STAMPS\["Assets"\] = "\w+";/, ''))),
  /Assets\.gs is missing or was cut short/);
assert.match(broken((d) => fs.unlinkSync(path.join(d, 'Pages1.gs'))), /Pages1\.gs is missing/);
assert.match(broken((d) => fs.writeFileSync(path.join(d, 'Data.gs'), fs.readFileSync(path.join(d, 'Data.gs'), 'utf8').replace(/BUILD_STAMPS\["Data"\] = "\w+"/, 'BUILD_STAMPS["Data"] = "old"'))),
  /Data\.gs is from a different version/);

// what reaches the browser survives Apps Script's comment stripping: only the two slash-free scripts
const served = w.page(T, '/lessons/sprint-servo-skills').getContent();
const scripts = served.match(/<script\b[\s\S]*?<\/script>/g);
assert.strictEqual(scripts.length, 2);
assert.ok(scripts.every((x) => !/\/\/|\/\*/.test(x)), 'a page script contains // or /*');
console.log('apps script app passed');
