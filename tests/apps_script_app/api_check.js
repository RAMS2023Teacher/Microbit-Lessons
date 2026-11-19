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
const cls = w.call(T, 'createClass', ['Period 3', 'g7']);
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
for (const id of w.g.DATA.courses.g7.order) assert.ok(!/"page":"error"/.test(pageView(S, '/lessons/' + id)), 'lesson page failed: ' + id);
assert.match(pageView(S, '/lessons/hello-microbit'), /another grade/);                          // a 6th grade lesson
for (const id of w.g.DATA.order) assert.ok(!/"page":"error"/.test(pageView(T, '/lessons/' + id)), 'teacher lesson page failed: ' + id);

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

// finishing the lesson banks 5 minutes of Robot Rush; the arcade itself stays closed until the teacher opens it
assert.ok(r.body.arcade && !r.body.arcade.open && r.body.arcade.bank === 300 && !r.body.arcade.can_play, JSON.stringify(r.body.arcade));
const xpBefore = w.g.loadStudent_(S).xp, lvBefore = w.g.levelInfo_(xpBefore).level;
const shop = (body) => w.call(S, 'api', ['/api/shop/buy', JSON.stringify(body)]).body;
let b = shop({ item: 'power:magnet' });
assert.ok(b.ok && b.powerups.magnet === 1 && b.spendable === xpBefore - 80, JSON.stringify(b));
b = shop({ item: 'part:eyes:star' });
assert.ok(b.ok && b.catalog.eyes.find((o) => o.id === 'star').unlocked);
assert.ok(w.call(S, 'api', ['/api/avatar', JSON.stringify({ eyes: 'star' })]).body.ok);
assert.ok(!w.call(S, 'api', ['/api/avatar', JSON.stringify({ eyes: 'shades' })]).body.ok);      // not bought
assert.ok(!shop({ item: 'part:eyes:round' }).ok);                                                // free parts aren't for sale
const samNow = w.g.loadStudent_(S);
assert.ok(samNow.xp >= xpBefore && samNow.spent === 230 && w.g.levelInfo_(samNow.xp).level >= lvBefore);   // spending never lowers XP or level
b = shop({ item: 'power:time' });
assert.ok(b.ok && b.race_seconds === 50, JSON.stringify(b));
b = shop({ item: 'power:time' });
assert.ok(!b.ok && /more XP/.test(b.error), JSON.stringify(b));                                    // level 2 costs more than Sam has left
const arcade = (action, body, who) => w.call(who || S, 'api', ['/api/arcade/' + action, JSON.stringify(body || {})]).body;
assert.ok(arcade('start').closed);                                                                 // closed until the teacher opens it
// another class's arcade doesn't count
const other = w.call(T, 'createClass', ['Period 5', 'g7']);
w.call(T, 'arcadeClass', [other.id, 'open', 45]);
assert.ok(arcade('start').closed);
w.call(T, 'arcadeClass', [other.id, 'close']);
// the teacher opens it for Sam's class: each race uses its length from the bank
assert.ok(w.call(T, 'arcadeClass', [cls.id, 'open', 50]).seconds_left > 2900);
let run = arcade('start');
assert.ok(run.ok && run.seconds === 50 && run.powerups.magnet === 1 && run.bank === 250, JSON.stringify(run));
assert.ok(!arcade('finish', { run_id: run.run_id, score: 500 }).ok);                               // too fast
run = arcade('start');
w.advance(51000);
assert.ok(!arcade('finish', { run_id: run.run_id, score: 999999 }).ok);                            // impossible score
run = arcade('start');
w.advance(51000);
let fin = arcade('finish', { run_id: run.run_id, score: 2400 });
assert.ok(fin.ok && fin.new_best && fin.best === 2400 && fin.board.today[0].me && fin.board.today[0].score === 2400, JSON.stringify(fin));
assert.ok(!arcade('finish', { run_id: run.run_id, score: 2400 }).ok);                              // a race counts once
assert.strictEqual(fin.state.bank, 150);
assert.ok(arcade('start').ok && arcade('start').ok && arcade('start').ok);              // 150 s = three 50 s races
assert.ok(/play time/.test(arcade('start').error));                                                // the bank is empty
assert.ok(!arcade('start', {}, S2).ok);                                                            // Ava hasn't earned any time
assert.strictEqual(w.call(T, 'arcadeClass', [cls.id, 'gift']).gifted, 2);                          // the teacher gives everyone 5 minutes
assert.ok(arcade('start', {}, S2).ok);
const scrA = w.call(T, 'screenData', [cls.id]).arcade;
assert.ok(scrA.open && scrA.board.today.length === 1, JSON.stringify(scrA));
w.call(T, 'arcadeClass', [cls.id, 'close']);
assert.ok(arcade('start').closed);
assert.ok(/"page":"arcade"/.test(pageView(S, '/arcade')));
assert.ok(!/"page":"error"/.test(pageView(T, '/arcade')));
assert.ok(w.call(T, 'api', ['/api/arcade/start', '{}']).body.practice);

// partners: Ava picks Sam's classmate list; work is combined, then saves go to both
w.advance(120000);
assert.ok(api(S2, 'partner').body.classmates.some((m) => m.id === S));
r = api(S2, 'partner', { action: 'pair', partner_id: S });
assert.deepStrictEqual(r.body, { status: 'paired', name: 'Sam K.', by_me: true });
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
assert.ok(scr.goal && scr.goal.auto && scr.goal.target === 120 && scr.goal.today > 0, JSON.stringify(scr.goal));   // 2 students x 60
assert.strictEqual(w.call(T, 'screenSave', [cls.id, { goal: '500' }]).goal.target, 500);
assert.strictEqual(w.call(T, 'screenSave', [cls.id, { goal: '0' }]).goal, null);
assert.strictEqual(w.call(T, 'screenSave', [cls.id, { goal: '', xp: 'each' }]).goal.target, 120);
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

// a 6th grade class: its students see only the 6th grade course (MakeCode Blocks)
const six = w.call(T, 'createClass', ['Period 1', 'g6']);
const S6 = 'mia@students.school.org';
w.call(S6, 'joinClass', [six.code, 'Mia L.']);
const home6 = pageData(S6, '/');
assert.ok(home6.total === 10 && home6.next_up.lesson.id === 'hello-microbit' && /6th grade/.test(home6.course_name), JSON.stringify(home6.next_up));
assert.ok(!home6.badges.some((b) => b.id === 'robot-builder') && home6.badges.some((b) => b.id === 'ai-trainer'));
assert.strictEqual(pageData(S6, '/map').map.nodes.length, 10);
assert.ok(pageData(S6, '/lessons').course.every((c) => c.course === 'g6'));
const hello = pageData(S6, '/lessons/hello-microbit');
assert.ok(hello.lesson.editor === 'blocks' && hello.lesson.build.some((st) => st.blocks) && hello.lesson.idea_label === 'Coding idea');
assert.match(pageView(S6, '/lessons/dodge-the-drop'), /another grade/);
assert.ok(api(S6, 'mission', { talk: 'Buttons make things happen when you press them.' }, 'hello-microbit').body.stages.mission);
assert.strictEqual(w.call(T, 'teacherHome').classes.find((c) => c.id === six.id).grade, 'g6');
assert.strictEqual(pageData(T, '/lessons').courses.length, 2);
assert.strictEqual(pageData(T, '/map/g6').map.nodes.length, 10);
assert.ok(pageData(T, `/teacher/classes/${six.id}`).course.every((c) => c.course === 'g6'));
assert.ok(pageData(T, `/teacher/classes/${six.id}/screen`).units[0].lessons.every((l) => w.g.DATA.lessons[l.id].course === 'g6'));
w.call(T, 'setClassGrade', [six.id, 'g7']);                                                      // switching keeps work, changes the course
assert.strictEqual(pageData(S6, '/').total, 13);
w.call(T, 'setClassGrade', [six.id, 'g6']);

// ✋ help: a student asks, the display lists it (no emails), the teacher marks it helped
const help = (who, body) => w.call(who, 'api', ['/api/help', JSON.stringify(body)]).body;
assert.ok(help(S, { action: 'ask', lesson: LID, stage: 'build', step: 3, note: 'my drop never falls' }).help);
let hl = w.call(T, 'helpList', [cls.id]);
assert.ok(hl.length === 1 && hl[0].name === 'Sam' && /Dodge the Drop · Step 4/.test(hl[0].where) && hl[0].note === 'my drop never falls', JSON.stringify(hl));
assert.ok(!JSON.stringify(hl).includes('@'));
assert.strictEqual(w.call(T, 'helpList', [other.id]).length, 0);                                  // only this class
assert.ok(w.call(T, 'screenData', [cls.id]).help.length === 1);
assert.ok(pageData(S, '/lessons/' + LID).help);
assert.strictEqual(w.call(T, 'helpResolve', [cls.id, hl[0].who]).length, 0);
assert.strictEqual(help(S, { action: 'status' }).help, null);
help(S, { action: 'ask', lesson: LID, stage: 'quiz' });
assert.strictEqual(help(S, { action: 'cancel' }).help, null);
assert.throws(() => w.call(S, 'helpList', [cls.id]), /Only the teacher/);

// 🤔 feedback: flags, a rating (+XP), first-try quiz misses and help counts in the teacher's report, without names
assert.ok(api(S, 'feedback', { kind: 'step', i: 3, reason: 'unclear', note: 'where does the line go' }).body.ok);
assert.ok(api(S2, 'feedback', { kind: 'step', i: 3, reason: 'broken' }).body.ok);
assert.ok(api(S, 'feedback', { kind: 'quiz', i: 1, reason: 'hard' }).body.ok);
assert.strictEqual(api(S, 'feedback', { kind: 'step', i: 99, reason: 'unclear' }).status, 400);
assert.strictEqual(api(S, 'feedback', { kind: 'step', i: 1, reason: 'nope' }).status, 400);
const rate = api(S, 'feedback', { kind: 'rating', rating: 4, hardest: 'the game over part', change: 'more time' }).body;
assert.ok(rate.ok && rate.rewards.items.some((x) => /rating/.test(x.reason)), JSON.stringify(rate));
assert.ok(pageData(S, '/lessons/' + LID).my_fb.flags.includes('step:3') && pageData(S, '/lessons/' + LID).my_fb.rating === 4);
const rep = w.call(T, 'feedbackReport', ['g7']);
const fl = rep.lessons.find((l) => l.id === LID);
assert.ok(fl.file === 'course/lessons/06-dodge-the-drop.yaml' && fl.avg === 4 && fl.rated === 1, JSON.stringify(fl.ratings));
assert.ok(fl.steps[3].flags === 2 && fl.steps[3].reasons.unclear === 1 && fl.steps[3].notes[0] === 'where does the line go');
assert.ok(fl.steps[3].help >= 1, 'help requests are counted per step');
assert.ok(fl.quiz[0].answered >= 1 && fl.quiz[0].missed >= 1, JSON.stringify(fl.quiz[0]));         // Sam's first try was all wrong
assert.ok(fl.hardest.includes('the game over part') && fl.change.includes('more time'));
assert.ok(!JSON.stringify(rep).includes('@') && !JSON.stringify(rep).includes('Sam K'));
assert.ok(/"page":"feedback"/.test(pageView(T, '/teacher/feedback')) && w.call(T, 'feedbackReport', ['g6']).lessons.length === 10);
assert.throws(() => w.call(S, 'feedbackReport', ['g7']), /Only the teacher/);

// creating or importing a class has to say which grade
assert.throws(() => w.call(T, 'createClass', ['No grade']), /6th or 7th/);
w.state.classroom.courses = [{ id: 'gc1', name: '6th Grade CS', section: 'Period 2' }];
w.state.classroom.students = { gc1: [{ userId: 'u1', profile: { emailAddress: 'zed@students.school.org', name: { fullName: 'Zed Q' } } }] };
const imp = w.call(T, 'importClassroom', [[{ course_id: 'gc1', target: 'new', grade: 'g6' }]]);
assert.strictEqual(w.call(T, 'teacherHome').classes.find((c) => c.id === imp.classes[0].id).grade, 'g6');
assert.ok(pageData(T, '/teacher/google-import').grades.length === 2);
// every page action goes through api('/api/run'); unknown names get a plain message
const viaApi = w.call(T, 'api', ['/api/run', JSON.stringify({ fn: 'setClassGrade', args: [six.id, 'g7'] })]);
assert.ok(viaApi.body.ok && viaApi.body.value.grade === 'g7');
w.call(T, 'setClassGrade', [six.id, 'g6']);
assert.match(w.call(T, 'api', ['/api/run', JSON.stringify({ fn: 'nope', args: [] })]).body.error, /Reload the page/);
assert.ok(!w.call(S, 'api', ['/api/run', JSON.stringify({ fn: 'setClassGrade', args: [six.id, 'g7'] })]).body.ok);   // students can't

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
