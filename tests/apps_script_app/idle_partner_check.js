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
