// Reliability checks (docs/RELIABILITY.md): Drive failing must never create new storage or save a blank record
// over a real one; one student click reads only that student; backups and the owner's data card work; only the
// owner can use them. Called by tests/test_apps_script_app.py.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const dist = process.argv[2];
const w = makeWorld(dist), T = w.owner, LID = 'dodge-the-drop';
const S = 'sam@students.school.org', S2 = 'ava@students.school.org';
const api = (who, action, body) => w.call(who, 'api', [`/api/lessons/${LID}/${action}`, JSON.stringify(body || {})]);
const html = (who, p) => {                              // the page plus its decoded setup (where the message is)
  const h = w.page(who, p).getContent(), m = /<div id="ml-code" hidden>([^<]*)<\/div>/.exec(h);
  return m ? h + '\n' + Buffer.from(m[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : h;
};
const snapshot = () => JSON.stringify({ props: w.state.props, files: Object.keys(w.state.files).length, folders: Object.keys(w.state.folders).length });
const contentOf = (email) => w.state.files[w.state.props['student:' + email]].content;
const evict = () => { w.state.cache = {}; };            // the cache can be emptied by Google at any time

// a working class
w.call(T, 'setup');
const cls = w.call(T, 'createClass', ['Period 3', 'g7']);
w.call(S, 'joinClass', [cls.code, 'Sam K.']);
w.call(S2, 'joinClass', [cls.code, 'Ava R.']);
api(S, 'mission', { talk: 'Tetris ends when blocks reach the top' });
api(S, 'step', { i: 0, tests: [0] });
const samBefore = contentOf(S);
assert.ok(JSON.parse(samBefore).progress[LID].mission_done);

// 1. Storage errors never create storage, and every action says BUSY instead
evict();
const before = snapshot();
w.state.fail.open = true;
for (const p of ['/', '/lessons', '/lessons/' + LID, '/me', '/arcade']) assert.match(html(S, p), /very busy|Busy/, 'student page ' + p);
assert.match(html(T, '/'), /very busy|Busy/);
let r = api(S, 'step', { i: 1, tests: [0, 1] });
assert.ok(r.status === 503 && /^BUSY/.test(r.body.error), JSON.stringify(r));
assert.throws(() => w.call(S, 'joinClass', [cls.code, 'Sam K.']), /BUSY/);
assert.throws(() => w.call('new@students.school.org', 'joinClass', [cls.code, 'New Kid']), /BUSY/);
assert.throws(() => w.call(T, 'createClass', ['Period 9', 'g7']), /BUSY/);
assert.ok(!w.call(T, 'api', ['/api/run', JSON.stringify({ fn: 'createClass', args: ['Period 9', 'g7'] })]).body.ok);
assert.strictEqual(snapshot(), before, 'nothing was created and no storage id changed');
w.state.fail.open = false;
evict();
assert.ok(JSON.parse(contentOf(S)).progress[LID].mission_done, 'Sam is still there');
assert.strictEqual(w.call(T, 'teacherHome').classes.length, 1, 'the class is still there');
assert.match(html(S, '/lessons/' + LID), /"page":"lesson"|ml-code/);

// 2. A failed read never saves a blank record over the real one (reads fail, writes would work)
evict();
w.state.fail.read = true;
r = api(S, 'step', { i: 1, tests: [0, 1] });
assert.strictEqual(r.status, 503);
assert.throws(() => w.call(S, 'joinClass', [cls.code, 'Sam K.']), /BUSY/);                          // join must not start over
assert.throws(() => w.call(S2, 'api', ['/api/lessons/' + LID + '/partner', JSON.stringify({ action: 'pair', partner_id: S })]).body.ok || (() => { throw new Error('BUSY'); })());
assert.throws(() => w.call(T, 'createClass', ['Period 9', 'g7']), /BUSY/);                         // settings unreadable: no blank settings saved
w.state.fail.read = false;
evict();
assert.strictEqual(contentOf(S), samBefore, "Sam's file is unchanged");
assert.strictEqual(w.call(T, 'teacherHome').classes.length, 1);

// 3. A failed write never makes a second file or moves the pointer
evict();
const ptr = w.state.props['student:' + S], files = Object.keys(w.state.files).length;
w.state.fail.write = true;
assert.strictEqual(api(S, 'step', { i: 1, tests: [0, 1] }).status, 503);
w.state.fail.write = false;
assert.ok(w.state.props['student:' + S] === ptr && Object.keys(w.state.files).length === files);

// 4. One student click reads only that student (300 other students in the class)
for (let i = 0; i < 300; i++) w.call(`filler${i}@students.school.org`, 'joinClass', [cls.code, 'Filler ' + i]);
evict();
w.state.stats = { reads: 0, writes: 0, lists: 0, creates: 0, locks: 0 };
api(S, 'step', { i: 1, tests: [0, 1] });
assert.ok(w.state.stats.reads <= 3 && w.state.stats.lists === 0 && w.state.stats.creates === 0 && w.state.stats.locks === 0, JSON.stringify(w.state.stats));
w.state.stats = { reads: 0, writes: 0, lists: 0, creates: 0, locks: 0 };
api(S, 'step', { i: 1, tests: [0, 1] });                                                            // cached now: no reads
assert.ok(w.state.stats.reads === 0, JSON.stringify(w.state.stats));

// 5. The class-wide summary is shared: many students opening the Arcade rebuild it at most once
w.advance(120000);
w.state.stats = { reads: 0, writes: 0, lists: 0, creates: 0, locks: 0 };
for (let i = 0; i < 20; i++) html(`filler${i}@students.school.org`, '/arcade');
assert.ok(w.state.stats.lists <= 1, 'summary rebuilt ' + w.state.stats.lists + ' times');

// 6. Backups: built a little at a time by teacher pages, finished by "Back up now", one file per day
let info = w.call(T, 'backupNow', []);
assert.ok(info.today && info.today.done && info.backups.length === 1 && info.backups[0].students === 302, JSON.stringify(info.today));
const backup = Object.values(w.state.files).find((f) => /^Maker Lab Backup /.test(f.name));
const saved = JSON.parse(backup.content);
assert.ok(saved.complete && saved.students[S].progress[LID].mission_done && saved.config.classes[cls.id]);
api(S, 'step', { i: 2, tests: [0] });
info = w.call(T, 'backupNow', []);
assert.ok(JSON.parse(Object.values(w.state.files).find((f) => /^Maker Lab Backup /.test(f.name)).content).students[S].progress[LID].steps[2], 'Back up now takes a fresh copy');
assert.strictEqual(Object.values(w.state.files).filter((f) => /^Maker Lab Backup /.test(f.name)).length, 1, 'still one backup today');
for (let d = 1; d <= 9; d++) { w.advance(864e5); w.call(T, 'backupNow', []); }
assert.strictEqual(w.call(T, 'dataInfo').backups.length, 8, 'keeps the last 8');
w.state.fail.open = true;                                                                           // a failing backup never breaks a page
w.advance(864e5);
assert.match(html(T, '/'), /very busy|Busy/);
w.state.fail.open = false;

// 7. The owner's data card: the folder, counts, history; another "Maker Lab data" folder is pointed out
info = w.call(T, 'dataInfo');
assert.ok(info.folder.url && info.students === 302 && info.classes === 1 && info.history.length >= 2 && info.others.length === 0, JSON.stringify(info));
w.g.DriveApp.createFolder('Maker Lab data');
assert.strictEqual(w.call(T, 'dataInfo').others.length, 1);

// 8. Owner only
for (const fn of ['dataInfo', 'backupNow']) {
  assert.throws(() => w.call(S, fn, [false]), /Only the teacher/);
  assert.ok(!w.call(S, 'api', ['/api/run', JSON.stringify({ fn, args: [] })]).body.ok);
}

// 9. First run: two first visitors can't make two data folders (the lock re-checks the id)
const w2 = makeWorld(dist);
w2.call(w2.owner, 'setup');
w2.call(w2.owner, 'setup');
assert.strictEqual(Object.values(w2.state.folders).filter((f) => f.name === 'Maker Lab data').length, 1);
console.log('reliability checks passed');
