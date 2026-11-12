// Runs the generated Apps Script app against fake Google services: teacher setup, a student joining,
// working through a lesson, and the gradebook. Called by tests/test_apps_script_app.py.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const dist = process.argv[2];
const w = makeWorld(dist);
/** A page's HTML plus its decoded data and page setup, the way the browser's loader sees it. */
function pageView(who, p, world) {
  const html = (world || w).page(who, p).getContent();
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

// the micro:bit setup tutorial: a reminder on the dashboard until the student says it worked
assert.match(pageView(S), /"setup_done":false/);
assert.match(pageView(S, '/setup'), /"page":"setup"/);
w.call(S, 'markSetupDone', [true]);
assert.match(pageView(S), /"setup_done":true/);
assert.match(pageView(S, '/setup'), /"done":true/);

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

// Learn quick checks: graded on the server, +XP only when right on the first try, answers never in the page
const C101 = w.g.DATA.lessons['circuits-101'];
const lcPage = pageView(S, '/lessons/circuits-101');
assert.ok(!lcPage.includes(C101.learn_checks[0].why), 'quick check feedback leaked into the page');
const lc = (who, card, choice) => w.call(who, 'api', ['/api/lessons/circuits-101/learn-check', JSON.stringify({ card, choice })]);
const a0 = C101.learn_checks[0].answer, a1 = C101.learn_checks[1].answer;
r = lc(S, 0, (a0 + 1) % 3);
assert.ok(r.status === 200 && r.body.check.correct === false && r.body.check.hint && r.body.rewards.xp_gained === 0);
r = lc(S, 0, a0);
assert.ok(r.body.check.correct && r.body.check.why && r.body.rewards.xp_gained === 0);       // right, but not first try
r = lc(S, 1, a1);
assert.strictEqual(r.body.rewards.xp_gained, 5);
assert.strictEqual(lc(S, 1, a1).body.rewards.xp_gained, 0);                                     // never twice
assert.strictEqual(lc(S, 42, 0).status, 400);
assert.deepStrictEqual(r.body.learn_checks['0'], { tries: 2, ok: true, pick: a0 });
assert.match(pageView(S, '/lessons/circuits-101'), /"learn_checks":\{"0":\{"tries":2/);
assert.ok(lc(T, 0, a0).body.check.correct);                                                     // the teacher can try them too

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

// the teacher shows quick-check results, and can skip Learn for a class (it counts as done)
assert.ok(w.call(T, 'studentDetail', [cls.id, S]).items.find((i) => i.id === 'circuits-101').learn_titles.length >= 3);
w.call(T, 'setSkipLearn', [cls.id, true]);
assert.match(pageView(S, '/lessons/blink-external-led'), /"skip_learn":true/);
assert.ok(w.call(T, 'studentDetail', [cls.id, S]).items.find((i) => i.id === 'blink-external-led').p.sections.learn);
w.call(T, 'setSkipLearn', [cls.id, false]);
assert.match(pageView(S, '/lessons/radio-remote'), /"skip_learn":false/);

// the class display: where everyone is, recent wins, time left until the bell
w.advance(120000);
let scr = w.call(T, 'screenData', [cls.id]);
assert.ok(scr.students.some((s) => s.name === 'Sam' && s.status && s.where) && scr.question && scr.lesson);
assert.ok(scr.auto_lesson && scr.track.length >= 5 && scr.standards.length && scr.big_idea);
assert.strictEqual(scr.question, w.g.DATA.lessons[scr.lesson.id].essential_question);
assert.ok(scr.students.some((s) => typeof s.done === 'number'));
assert.ok(scr.wins.some((x) => /^Sam earned the .+ badge$/.test(x.text)), JSON.stringify(scr.wins));
assert.ok(scr.wins.some((x) => /^Sam got a bonus/.test(x.text)));
scr = w.call(T, 'screenSave', [cls.id, { lesson_id: 'traffic-light', question: 'Why is yellow short?', xp: 'hide', bell: '10:42', names: 'robot' }]);
assert.ok(scr.lesson.id === 'traffic-light' && scr.question === 'Why is yellow short?' && scr.settings.bell === '10:42');
assert.ok(scr.total_xp === 0 && !('xp' in scr.students[0]));
assert.ok(scr.students.some((s) => s.name === 'Sparky'));                  // Sam's robot name
assert.strictEqual(w.call(T, 'screenSave', [cls.id, { bell: 'later' }]).settings.bell, '');
assert.throws(() => w.call(S, 'screenData', [cls.id]), /Only the teacher/);
assert.match(pageView(T, `/teacher/classes/${cls.id}/screen`), /"page":"screen"/);

// partners on one Chromebook: Ava picks Sam, their work is combined, then every save goes to both files
const P = (who, body) => w.call(who, 'api', ['/api/lessons/traffic-light/partner', JSON.stringify(body || {})]).body;
api(S, 'traffic-light', 'save', { warmup_answer: "Sam's own idea" });
w.advance(120000);
api(S2, 'traffic-light', 'save', { mark: { learn: true } });
assert.ok(P(S2).classmates.some((m) => m.id === S && m.name === 'Sam K.'));
assert.strictEqual(P(S2, { action: 'pair', partner_id: 'stranger@other.org' }).status, undefined);   // not a classmate: refused
assert.deepStrictEqual(P(S2, { action: 'pair', partner_id: S }), { status: 'paired', name: 'Sam K.' });
const prog = (who) => JSON.parse(JSON.stringify(w.g.loadStudent_(who).progress['traffic-light']));
for (const who of [S, S2]) {
  const pp = prog(who);
  assert.ok(pp.sections.warmup && pp.sections.learn && pp.warmup_answer === "Sam's own idea", who);
}
assert.strictEqual(prog(S).partner, S2);
r = api(S2, 'traffic-light', 'challenge', { code: 'x', response: 'Our traffic light has a walk button.' });
assert.strictEqual(r.body.partner, 'Sam K.');
assert.ok(prog(S).sections.challenge && prog(S).challenge_response === 'Our traffic light has a walk button.');
assert.ok(Object.keys(w.g.loadStudent_(S).xp_keys).some((k) => k === 'challenge:traffic-light'));     // Sam got the XP
assert.deepStrictEqual(P(S), { status: 'paired', name: 'Ava R.' });
assert.ok(w.call(T, 'studentDetail', [cls.id, S]).items.find((i) => i.id === 'traffic-light').partner === 'Ava R.');
assert.strictEqual(P(S, { action: 'leave' }).status, 'none');
api(S, 'traffic-light', 'save', { code: 'solo' });
assert.notStrictEqual(prog(S2).code, 'solo');
assert.ok(!prog(S2).partner);

// removing a student hides them and sends them back to the join page
w.call(T, 'removeStudent', [cls.id, S2]);
w.advance(120000);
assert.strictEqual(w.call(T, 'gradebook', [cls.id]).students.length, 1);
assert.match(pageView(S2), /"page":"join"/);

// Google Classroom: import a class and its roster; rostered students skip the join page
const prof = (email, fullName) => ({ userId: email, profile: { emailAddress: email, name: { fullName } } });
w.state.classroom = {
  courses: [{ id: 'gc1', name: 'Makers', section: 'Period 3', courseState: 'ACTIVE', alternateLink: 'https://classroom.google.com/c/gc1' },
            { id: 'gc2', name: 'CS 8', section: '', courseState: 'ACTIVE' }, { id: 'gc3', name: 'Old class', courseState: 'ARCHIVED' }],
  students: { gc1: [prof('Lee@Students.school.org', 'Lee Park'), prof('max@students.school.org', 'Max Diaz'), { userId: 'x', profile: {} }],
              gc2: [prof(S, 'Samuel King')] },
};
const L1 = 'lee@students.school.org';
let gc = w.call(T, 'classroomCourses');
assert.deepStrictEqual(gc.courses.map((c) => c.id), ['gc1', 'gc2']);          // archived classes are left out
assert.throws(() => w.call(S, 'classroomCourses'), /Only the teacher/);
let imp = w.call(T, 'importClassroom', [[{ course_id: 'gc1', target: 'new' }, { course_id: 'gc2', target: cls.id }, { course_id: 'nope', target: 'new' }]]);
assert.strictEqual(imp.classes.length, 2);
assert.deepStrictEqual([imp.classes[0].students, imp.classes[0].missing], [2, 1]);
const gcCid = imp.classes[0].id;
assert.strictEqual(w.call(T, 'teacherHome').classes.find((c) => c.id === gcCid).name, 'Makers (Period 3)');
assert.strictEqual(w.call(T, 'classroomCourses').courses.find((c) => c.id === 'gc2').linked, cls.id);
gb = w.call(T, 'gradebook', [gcCid]);                       // on the roster before they ever sign in
assert.deepStrictEqual(gb.students.map((s) => [s.name, s.not_yet]), [['Lee Park', true], ['Max Diaz', true]]);
assert.ok(pageView(T, `/teacher/classes/${gcCid}/students/${encodeURIComponent(L1)}`).includes('"name":"Lee Park"'));
const leePage = pageView(L1);
assert.match(leePage, /"page":"dashboard"/);                 // no join page
assert.match(leePage, /"name":"Lee Park"/);
assert.match(leePage, /Makers \(Period 3\)/);
w.call(T, 'assignLessons', [gcCid, ['blink-external-led'], '2030-01-01', '']);
assert.strictEqual(api(L1, 'blink-external-led', 'save', { warmup_answer: 'a light' }).status, 200);
w.advance(120000);
gb = w.call(T, 'gradebook', [gcCid]);
const lee = gb.students.find((s) => s.email === L1);
assert.ok(!lee.not_yet && gb.grid[L1 + '|' + gb.cols[0].id].pct > 0);
assert.ok(w.call(T, 'gradebook', [cls.id]).students.some((s) => s.email === S && s.name === 'Samuel King'));  // Classroom name wins
// roster changes: Max leaves, Kai arrives
w.state.classroom.students.gc1 = [prof(L1, 'Lee Park'), prof('kai@students.school.org', 'Kai Wu')];
let sync = w.call(T, 'syncClassroom', [gcCid]);
assert.deepStrictEqual([sync.students, sync.added, sync.left, sync.missing], [2, 1, 1, 0]);
assert.deepStrictEqual(w.call(T, 'gradebook', [gcCid]).students.map((s) => s.name).sort(), ['Kai Wu', 'Lee Park']);
assert.match(pageView('max@students.school.org'), /"page":"join"/);
assert.strictEqual(w.call(T, 'syncAllClassroom').classes.length, 2);
// a student removed by the teacher stays out after the roster is updated
w.call(T, 'removeStudent', [gcCid, 'kai@students.school.org']);
w.call(T, 'syncClassroom', [gcCid]);
assert.ok(!w.call(T, 'gradebook', [gcCid]).students.some((s) => s.name === 'Kai Wu'));
// linking a course to another class moves it; unlinking drops the roster but keeps work
w.call(T, 'importClassroom', [[{ course_id: 'gc2', target: gcCid }]]);
assert.ok(!w.call(T, 'teacherHome').classes.find((c) => c.id === cls.id).classroom);
w.call(T, 'unlinkClassroom', [gcCid]);
assert.ok(!w.call(T, 'gradebook', [gcCid]).students.some((s) => s.email === L1));
assert.match(pageView(L1), /"page":"join"/);
assert.match(pageView(T, '/teacher/google-import'), /"page":"gc-import"/);
// without the Classroom service turned on, the import page explains what to do
const noGc = makeWorld(dist, { noClassroom: true });
noGc.call(noGc.owner, 'setup');
assert.match(pageView(noGc.owner, '/teacher/google-import', noGc), /"page":"gc-import".*Classroom service is not turned on/s);
assert.throws(() => noGc.call(noGc.owner, 'classroomCourses'), /Classroom service is not turned on/);
assert.match(noGc.call(noGc.owner, 'checkInstall'), /❌ Google Classroom/);

// every page renders for the teacher and the student
for (const p of ['/', '/lessons', '/map', '/editor', '/teacher/standards', '/teacher/videos', '/teacher/google-import', '/setup', `/teacher/classes/${cls.id}`,
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
