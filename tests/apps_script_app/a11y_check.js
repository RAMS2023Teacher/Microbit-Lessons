// Translation (pt-BR), problem reports and the teacher's student view, against fake Google.
// Called by tests/test_apps_script_app.py.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const w = makeWorld(process.argv[2]), T = w.owner, S = 'sam@students.school.org';
const pageData = (who, p) => {
  const h = w.page(who, p).getContent(), m = /<div id="ml-code" hidden>([^<]*)<\/div>/.exec(h);
  const setup = Buffer.from(m[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(setup.slice('window.ML='.length, setup.lastIndexOf(';')));
};
w.call(T, 'setup');
const cls = w.call(T, 'createClass', ['Period 3', 'g7']);
w.call(S, 'joinClass', [cls.code, 'Sam K.']);

// translation: kept placeholders, cached, saved in Drive, batched, budgeted
const items = ['Click the green <b>Open MakeCode</b> button.', 'Type <span translate="no">§0</span> and run it.', 'Step <span translate="no">§0</span> of <span translate="no">§1</span>'];
let r = w.call(S, 'translate', ['pt', items]);
const vals = Object.values(r.done);
assert.ok(r.left === 0 && vals.length === 3 && vals.every((v) => /PT·/.test(v)), JSON.stringify(r));
assert.ok(vals.some((v) => v.includes('<span translate="no">§0</span>')) && vals.some((v) => v.includes('<b>')));
assert.strictEqual(w.state.stats.translations, 1, 'one call to Google for the whole batch');
w.call(S, 'translate', ['pt', items]);
assert.strictEqual(w.state.stats.translations, 1, 'second time comes from the cache');
w.state.cache = {};
r = w.call(S, 'translate', ['pt', items]);
assert.ok(w.state.stats.translations === 1 && Object.keys(r.done).length === 3, 'after the cache is emptied, the saved Drive copy is used');
assert.ok(Object.keys(w.state.props).some((k) => /^file:translations-pt-/.test(k)));
assert.throws(() => w.call(S, 'translate', ['xx', items]), /isn't available/);
w.state.fail.translate = true;                                                   // Google refusing: BUSY, nothing saved wrong
assert.throws(() => w.call(S, 'translate', ['pt', ['A brand new sentence here.']]), /BUSY/);
w.state.fail.translate = false;
assert.ok(pageData(S, '/').data.level, 'pages still work');

// problem reports: students send, repeats dropped, capped, teacher lists and marks fixed; names never leave the page
const rep = (who, d) => w.call(who, 'reportBug', [d]);
assert.ok(rep(S, { kind: 'broken', text: 'Next did nothing', page: '/lessons/dodge-the-drop', ctx: { lesson: 'dodge-the-drop', stage: 'build', step: 3 }, errors: ['TypeError: x is null'] }).ok);
assert.throws(() => rep(S, { kind: 'broken', text: '' }), /Tell us/);
assert.ok(rep(S, { kind: 'auto', text: 'TypeError: y', page: '/' }).id);
assert.strictEqual(rep(S, { kind: 'auto', text: 'TypeError: y', page: '/' }).skipped, 'seen');
for (let i = 0; i < 12; i++) rep(S, { kind: 'other', text: 'report ' + i });
let list = w.call(T, 'bugList');
assert.strictEqual(list.bugs.length, 10, 'at most 10 a day from one student');
const first = list.bugs.find((b) => b.text === 'Next did nothing');
assert.ok(first.lesson_title === '6. Dodge the Drop' && first.step_title === 'Step 4: Wait for a button' && first.version.length > 5 && first.file === 'course/lessons/06-dodge-the-drop.yaml', JSON.stringify(first));
assert.ok(!('email' in first) && first.name === 'Sam K.');
list = w.call(T, 'bugUpdate', [first.id, 'fixed']);
assert.strictEqual(list.bugs.find((b) => b.id === first.id).status, 'fixed');
assert.strictEqual(w.call(T, 'bugUpdate', [first.id, 'deleted']).bugs.length, 9);
assert.throws(() => w.call(S, 'bugList'), /Only the teacher/);
assert.throws(() => w.call(S, 'bugUpdate', ['x', 'fixed']), /Only the teacher/);
assert.strictEqual(pageData(T, '/teacher/reports').page, 'reports');

// student view: the teacher sees the class as a student; nothing is saved; exit returns
const files = Object.keys(w.state.files).length;
let v = pageData(T, '/student-view/' + cls.id);
assert.ok(v.page === 'dashboard' && v.teacher === false && v.preview.cls === 'Period 3' && v.data.next_up.lesson.id === 'name-badge', JSON.stringify(v.preview));
v = pageData(T, '/lessons/dodge-the-drop');
assert.ok(v.page === 'lesson' && v.data.key === null && v.teacher === false);
assert.ok(pageData(T, '/arcade').page === 'arcade' && pageData(T, '/me').page === 'profile');
assert.ok(w.call(T, 'api', ['/api/lessons/dodge-the-drop/mission', JSON.stringify({ talk: 'trying it as a student' })]).body.teacher);
const made = Object.values(w.state.files).slice(files).map((f) => f.name);
assert.ok(made.every((n) => /^(summary|config)\.json$/.test(n)), 'student view saved no student work: ' + made);
assert.ok(!Object.keys(w.state.props).some((k) => k === 'student:' + T), 'no student record for the teacher');
assert.strictEqual(pageData(S, '/').teacher, false, 'real students are unaffected');
v = pageData(T, '/exit-student-view');
assert.ok(v.page === 'teacher-home' && v.teacher === true && !v.preview);
console.log('a11y checks passed');
