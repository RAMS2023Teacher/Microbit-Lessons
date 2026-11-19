// The arcade's second game (Circuit Driver): unlocks at a level, has its own scores and leaderboard, and big scores
// win robot parts. Robot Rush keeps its old scores.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const w = makeWorld(process.argv[2]);
const T = w.owner, A = 'ava@students.school.org', B = 'ben@students.school.org';
const api = (who, path, body) => w.call(who, 'api', [path, JSON.stringify(body || {})]).body;
const page = (who, p) => { const html = w.page(who, p).getContent(), m = /<div id="ml-code" hidden>([^<]*)<\/div>/.exec(html);
  const setup = Buffer.from(m[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(setup.slice('window.ML='.length, setup.lastIndexOf(';'))).data; };
w.call(T, 'setup');
const cls = w.call(T, 'createClass', ['Period 3', 'g7']);
[[A, 'Ava K.'], [B, 'Ben T.']].forEach(([e, n]) => w.call(e, 'joinClass', [cls.code, n]));
w.call(T, 'arcadeClass', [cls.id, 'open', 60]);
w.call(T, 'arcadeClass', [cls.id, 'gift']); w.call(T, 'arcadeClass', [cls.id, 'gift']);
const D = w.g.DATA, secs = D.arcade.race_seconds;
assert.strictEqual(D.games.map((g) => g.id).join(), 'rush,circuit');
let d = page(A, '/arcade');
assert.strictEqual(d.games[0].unlocked, true);
assert.strictEqual(d.games[1].unlocked, false, 'Circuit Driver is locked at level 1');
let r = api(A, '/api/arcade/start', { game: 'circuit' });
assert.strictEqual(r.ok, false); assert.match(r.error, /level 3/);
assert.ok(api(A, '/api/arcade/start', { game: 'nope' }).error, 'unknown game refused');
const race = (who, game, score) => { const s = api(who, '/api/arcade/start', { game }); assert.strictEqual(s.ok, true, s.error); assert.strictEqual(s.game, game);
  w.advance(secs * 1000); return api(who, '/api/arcade/finish', { run_id: s.run_id, score }); };
// Robot Rush still works and still fills the old fields
r = race(A, 'rush', 1900);
assert.strictEqual(r.ok, true); assert.strictEqual(r.best, 1900); assert.strictEqual(r.unlocked.join(), 'Gold medal');
// level up (the teacher's bonus XP), then Circuit Driver opens
for (let i = 0; i < 12 && page(A, '/arcade').level.level < 3; i++) w.call(T, 'giveBonus', [A, 200, 'testing']);
d = page(A, '/arcade');
assert.strictEqual(d.games[1].unlocked, true, 'unlocked at level 3: level ' + d.level.level);
r = race(A, 'circuit', 900);
assert.strictEqual(r.ok, true); assert.strictEqual(r.best, 900); assert.strictEqual(r.game, 'circuit');
assert.strictEqual(r.unlocked.join(), 'Racing helmet');
assert.strictEqual(r.board.all[0].score, 900);
r = race(A, 'circuit', 850);
assert.strictEqual(r.unlocked.length, 0, 'nothing new for a lower score'); assert.strictEqual(r.best, 900);
r = race(A, 'circuit', secs * 300 + 1);
assert.strictEqual(r.ok, false, 'an impossible score is refused');
d = page(A, '/arcade');
assert.strictEqual(d.games[0].best, 1900); assert.strictEqual(d.games[1].best, 900);
assert.strictEqual(d.boards.rush.all[0].score, 1900); assert.strictEqual(d.boards.circuit.all[0].score, 900);
// won parts can be worn; ones not won can't
const me = page(A, '/me');
const opt = (part, id) => me.catalog[part].find((o) => o.id === id);
assert.strictEqual(opt('accessory', 'helmet').unlocked, true);
assert.strictEqual(opt('accessory', 'medal').unlocked, true);
assert.strictEqual(opt('antenna', 'flag').unlocked, false); assert.match(opt('antenna', 'flag').how, /Score 2000 in Circuit Driver/);
assert.strictEqual(opt('antenna', 'led').unlocked, true, 'level 3 part');
assert.strictEqual(api(A, '/api/avatar', Object.assign({}, me.avatar, { accessory: 'helmet' })).ok, true);
assert.ok(api(A, '/api/avatar', Object.assign({}, me.avatar, { antenna: 'flag' })).error);
assert.ok(api(B, '/api/avatar', Object.assign({}, me.avatar, { accessory: 'helmet' })).error, 'Ben has not won it');
// the new power-up is for sale, and new parts can be bought
assert.ok(d.shop.find((u) => u.id === 'grip'));
assert.strictEqual(opt('color', 'ice').cost, 120);
console.log('arcade games checks passed');
