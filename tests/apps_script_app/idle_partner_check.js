// 💤 idle students on the class display, and partners: who picked whom, and either one can remove it.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const w = makeWorld(process.argv[2]);
const T = w.owner, A = 'ava@students.school.org', B = 'ben@students.school.org', LID = 'dodge-the-drop';
const api = (who, path, body) => w.call(who, 'api', [path, JSON.stringify(body || {})]);
w.call(T, 'setup');
const cls = w.call(T, 'createClass', ['Period 3', 'g7']);
[[A, 'Ava K.'], [B, 'Ben T.']].forEach(([e, n]) => w.call(e, 'joinClass', [cls.code, n]));
// idle
const rows = () => w.call(T, 'screenData', [cls.id]).students;
assert(!rows().some((r) => r.idle), 'nobody idle at first');
assert.strictEqual(api(A, '/api/idle', { on: true, secs: 180 }).body.ok, true);
let r = rows();
assert.strictEqual(r.find((x) => x.name.startsWith('Ava')).idle, 3, 'Ava idle 3 min');
assert(!r.find((x) => x.name.startsWith('Ben')).idle);
assert(!JSON.stringify(r).includes('@'), 'no emails on the display');
api(A, '/api/idle', { on: false });
assert(!rows().some((x) => x.idle), 'back again');
api(A, '/api/idle', { on: true, secs: 120 }); w.advance(6 * 60 * 1000);
assert(!rows().some((x) => x.idle), 'forgotten after 5 minutes');
assert.strictEqual(api(T, '/api/idle', { on: true }).body.ok, true);
// partner: who picked whom, and either can remove
const P = `/api/lessons/${LID}/partner`;
r = api(A, P, { action: 'pair', partner_id: B }).body;
assert.strictEqual(r.status, 'paired'); assert.strictEqual(r.by_me, true); assert.strictEqual(r.name, 'Ben T.');
r = api(B, P, {}).body;
assert.strictEqual(r.status, 'paired'); assert.strictEqual(r.by_me, false); assert.strictEqual(r.name, 'Ava K.');
api(A, `/api/lessons/${LID}/mission`, { talk: 'Games end when you lose' });
assert.strictEqual(api(B, P, {}).body.by_me, false, 'still marked after a mirrored save');
assert.strictEqual(api(A, P, {}).body.by_me, true);
r = api(B, P, { action: 'leave' }).body;                    // the one who was picked removes it
assert.strictEqual(r.status, 'none');
assert.strictEqual(api(A, P, {}).body.status, 'none', 'removed for both');
r = api(B, P, { action: 'pair', partner_id: A }).body;      // and can pick the other way round
assert.strictEqual(r.by_me, true); assert.strictEqual(api(A, P, {}).body.by_me, false);
console.log('idle + partner checks passed');

// the class display: a student who clicked straight to Build (never pressed "Mission accepted") is shown on their
// Build step, not stuck on Mission (problem report, 23 Nov)
{
  const C = 'cara@students.school.org';
  w.call(C, 'joinClass', [cls.code, 'Cara L.']);
  const L = w.g.DATA.lessons['dodge-the-drop'];
  w.call(T, 'screenSave', [cls.id, { lesson_id: 'dodge-the-drop' }]);
  for (let i = 0; i < 4; i++) api(C, `/api/lessons/dodge-the-drop/step`, { i, tests: L.build[i].test.map((_, k) => k), answer: 'my answer', fields: L.build[i].fields.map(() => '7') });
  w.advance(120000);
  const row = w.call(T, 'screenData', [cls.id]).students.find((s) => s.name.startsWith('Cara'));
  assert.strictEqual(row.done, 1, 'on Build');
  assert.strictEqual(row.step, 4, 'on step 5 (4 steps done)');
  console.log('class display race position checks passed');
}
