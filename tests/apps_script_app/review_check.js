// 📨 Teacher review (apps_script/server/62_review.js): shipping sends the project to the teacher; the lesson is only
// complete once they approve it; "sent back" shows the student the feedback and a new round starts when they ship again.
// Called by tests/test_apps_script_app.py.
const assert = require('assert');
const { makeWorld } = require('./fake_google');
const dist = process.argv[2];
const w = makeWorld(dist);
const LID = 'dodge-the-drop', L = w.g.DATA.lessons[LID];
const T = w.owner, S = 'sam@students.school.org', S2 = 'ava@students.school.org', S3 = 'eli@students.school.org';
const api = (who, action, body) => w.call(who, 'api', [`/api/lessons/${LID}/${action}`, JSON.stringify(body || {})]).body;
const pageData = (who, p) => {
  const html = w.page(who, p).getContent();
  const m = /<div id="ml-code" hidden>([^<]*)<\/div>/.exec(html);
  const setup = Buffer.from(m[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(setup.slice('window.ML='.length, setup.lastIndexOf(';')));
};
const SHARE = 'https://makecode.microbit.org/_Abc123XyZ';
const shipBody = (share) => ({ share: share || SHARE, ext: [0], reflect: L.ship.reflect.map(() => 'A for loop counts; a while loop waits.'), submit: true });
function upToShip(who) {
  api(who, 'mission', { talk: 'Tetris ends when the blocks reach the top.' });
  L.build.forEach((st, i) => api(who, 'step', { i, tests: st.test.map((_, k) => k), answer: st.ask ? 'my answer' : '', fields: st.fields.map(() => '7') }));
  assert.ok(api(who, 'quiz', { answers: L.quiz.map((q) => q.answer) }).quiz.passed);
}
const ALL4 = { works: 4, concept: 3, own: 4 };

w.call(T, 'setup');
const cls = w.call(T, 'createClass', ['Period 3', 'g7']);
w.call(T, 'assignLessons', [cls.id, [LID], '2020-01-01', '']);                    // already past due
[[S, 'Sam K.'], [S2, 'Ava R.'], [S3, 'Eli P.']].forEach(([e, n]) => w.call(e, 'joinClass', [cls.code, n]));

// the default rubric: three rows of 1-4, the second about the lesson's big idea
const rb = w.g.rubric_(L);
assert.strictEqual(rb.map((r) => r.id).join(), 'works,concept,own');
assert.ok(rb.every((r) => r.levels.length === 4) && rb[1].label.includes(L.python), rb[1].label);
assert.ok(w.g.rubric_({ rubric: [{ id: 'x', label: 'X', levels: ['a', 'b', 'c', 'd'] }] }).length === 1);   // a lesson's own rubric

// share links: only a MakeCode *share* link counts
assert.strictEqual(w.g.makecodeId_('https://makecode.microbit.org/_7tRcYzDTxbhm'), '_7tRcYzDTxbhm');
assert.strictEqual(w.g.makecodeId_('https://makecode.microbit.org/#pub:_7tRcYzDTxbhm'), '_7tRcYzDTxbhm');
assert.strictEqual(w.g.makecodeId_('https://makecode.microbit.org/S12345-12345-12345-12345'), 'S12345-12345-12345-12345');
assert.strictEqual(w.g.makecodeId_('https://makecode.microbit.org/#editor'), '');
upToShip(S);
let r = api(S, 'ship', shipBody('https://makecode.microbit.org/#editor'));
assert.ok(r.ok === false && r.missing.some((m) => /share link/.test(m)), JSON.stringify(r.missing));

// ship: it goes to the teacher, and the lesson isn't complete yet
r = api(S, 'ship', shipBody());
assert.ok(r.shipped && r.review.status === 'submitted' && r.review.round === 1 && r.percent < 100 && !r.stages.ship, JSON.stringify(r));
let sam = w.g.loadStudent_(S);
assert.ok(!sam.progress[LID].completed_at && !sam.xp_keys['complete:' + LID] && !(sam.arcade || {}).bank);
let home = pageData(S, '/').data;
assert.ok(home.reviews.some((x) => x.lesson_id === LID && x.status === 'submitted'));
assert.ok(!home.rows[0].overdue, 'shipped before review: not overdue');
assert.ok(!home.next_up || home.next_up.lesson.id !== LID, 'next up skips work waiting for review');
// shipping again before the teacher looks keeps it round 1
assert.strictEqual(api(S, 'ship', shipBody()).review.round, 1);

// the queue: oldest first; a pair's project shows once
upToShip(S2);
assert.strictEqual(api(S3, 'partner', { action: 'pair', partner_id: S2 }).status, 'paired');
w.advance(1000);
assert.ok(api(S2, 'ship', shipBody('https://makecode.microbit.org/_Pair1234')).shipped);
w.advance(61000);
let q = w.call(T, 'reviewQueue', ['']).queue;
assert.strictEqual(q.length, 2, JSON.stringify(q));
assert.strictEqual(q[0].email, S);
assert.ok(q[1].partner && [S2, S3].includes(q[1].email));
assert.strictEqual(w.call(T, 'reviewQueue', ['nope']).queue.length, 0);
let tp = pageData(T, '/');
assert.ok(tp.nav.some((n) => n[1] === '📨 Review (2)'), JSON.stringify(tp.nav));
assert.strictEqual(tp.data.classes[0].waiting, 2);
const gb = w.call(T, 'gradebook', [cls.id]);
const cell = gb.grid[S + '|' + gb.cols[0].id];
assert.ok(cell.review === 'submitted' && !cell.late && cell.status !== 'complete', JSON.stringify(cell));

// the review page: the MakeCode project id, the checks, the rubric and the standards, and what's next
let work = w.call(T, 'reviewWork', [S, LID]);
assert.ok(work.project === '_Abc123XyZ' && work.status === 'submitted' && work.round === 1);
assert.ok(work.checks.steps_done === L.build.length && work.checks.quiz_best === L.quiz.length);
assert.ok(work.rubric.length === 3 && work.standards.length && work.standards[0].code && work.standards[0].text);
assert.ok(work.extensions[0].done && work.reflect.every((x) => x.a));
assert.ok(work.next && work.next.left === 1 && work.next.email !== S);
const rp = pageData(T, '/teacher/review/' + LID + '/' + encodeURIComponent(S));
assert.ok(rp.page === 'review' && rp.data.project === '_Abc123XyZ', rp.page);
assert.strictEqual(pageData(T, '/teacher/review').page, 'review-queue');

// grading needs a decision; approving needs every row; sending back needs feedback
assert.throws(() => w.call(T, 'gradeWork', [S, LID, { status: 'maybe' }]), /Approve it or send it back/);
assert.throws(() => w.call(T, 'gradeWork', [S, LID, { status: 'approved', scores: { works: 4 } }]), /Score each row/);
assert.throws(() => w.call(T, 'gradeWork', [S, LID, { status: 'returned', scores: {}, feedback: ' ' }]), /feedback/);
assert.throws(() => w.call(S, 'gradeWork', [S, LID, { status: 'approved', scores: ALL4 }]));                  // students can't

// sent back: the student sees it once in a pop-up, the lesson stays open for fixing
r = w.call(T, 'gradeWork', [S, LID, { status: 'returned', scores: { works: 2 }, feedback: 'The drop never speeds up. Add the speed-up from step 7.' }]);
assert.ok(r.ok && r.status === 'returned' && r.total === 2 && r.max === 12);
let sp = pageData(S, '/');
let news = sp.data.review_news;
assert.ok(news.length === 1 && news[0].status === 'returned' && /speeds up/.test(news[0].feedback) && news[0].rows[0].level, JSON.stringify(news));
assert.ok(sp.data.reviews.some((x) => x.status === 'returned'));
assert.ok(pageData(S, '/lessons/' + LID).data.review.status === 'returned');
assert.ok(w.call(S, 'api', ['/api/review', JSON.stringify({ action: 'seen', lesson: LID })]).body.ok);
assert.strictEqual(pageData(S, '/').data.review_news.length, 0);                                        // shown once
assert.ok(!w.g.loadStudent_(S).progress[LID].completed_at);
// shipping again after a send-back is round 2, and it's back in the queue
r = api(S, 'ship', shipBody('https://makecode.microbit.org/_Fixed12345'));
assert.ok(r.review.status === 'submitted' && r.review.round === 2 && r.review.history.length === 1, JSON.stringify(r.review));
w.advance(61000);
q = w.call(T, 'reviewQueue', ['']).queue;
assert.ok(q.some((x) => x.email === S && x.round === 2));

// approved: complete, with completion XP, badges and play time; the pop-up says so; the work is locked
const stale = JSON.parse(JSON.stringify(w.g.loadStudent_(S)));                // the student's own copy, before the grade
r = w.call(T, 'gradeWork', [S, LID, { status: 'approved', scores: ALL4, feedback: 'Great fix!' }]);
assert.ok(r.ok && r.total === 11);
sam = w.g.loadStudent_(S);
assert.ok(sam.progress[LID].completed_at && sam.xp_keys['complete:' + LID] && sam.badges.finisher && sam.arcade.bank === 300, JSON.stringify(sam.arcade));
assert.strictEqual(w.g.percent_(sam.progress[LID], L), 100);
// a student save in the same moment writes their older copy over it: the mailbox puts the grade back
w.g.saveStudent_(stale);
assert.strictEqual(w.g.loadStudent_(S).progress[LID].review.status, 'submitted');
sp = pageData(S, '/');
news = sp.data.review_news;
assert.ok(news.length === 1 && news[0].status === 'approved' && news[0].total === 11 && news[0].xp > 0 && news[0].badges.length, JSON.stringify(news));
sam = w.g.loadStudent_(S);
assert.ok(sam.progress[LID].review.status === 'approved' && sam.progress[LID].completed_at && sam.xp_keys['complete:' + LID]);
assert.ok(w.g.pendingGrades_(S)[LID], 'kept until a later read finds it saved');
pageData(S, '/');
assert.strictEqual(Object.keys(w.g.pendingGrades_(S)).length, 0, 'mailbox emptied once the file has it');
r = api(S, 'ship', { reflect: ['changed after approval'], submit: true });
assert.ok(r.locked && r.percent === 100 && r.stage === 'done');
assert.notStrictEqual(w.g.loadStudent_(S).progress[LID].reflect[0], 'changed after approval');
w.call(S, 'api', ['/api/review', JSON.stringify({ action: 'seen', lesson: LID })]);
assert.strictEqual(pageData(S, '/').data.review_news.length, 0);
assert.ok(pageData(S, '/map'));

// a pair: one review goes to both partners
const pair = w.call(T, 'reviewQueue', ['']).queue.find((x) => x.partner);
r = w.call(T, 'gradeWork', [pair.email, LID, { status: 'approved', scores: { works: 3, concept: 3, own: 3 }, feedback: 'Nice teamwork' }]);
assert.strictEqual(r.students.length, 2);
[S2, S3].forEach((e) => {
  const rec = w.g.loadStudent_(e);
  assert.ok(rec.progress[LID].review.status === 'approved' && rec.progress[LID].completed_at && rec.xp_keys['complete:' + LID], e);
});
w.advance(61000);
assert.strictEqual(w.call(T, 'reviewQueue', ['']).queue.length, 0);
assert.ok(pageData(T, '/').nav.some((n) => n[1] === '📨 Review'));

// work shipped before reviews existed stays complete (nothing is taken back)
const old = w.g.loadStudent_(S3);
delete old.progress[LID].review;
w.g.saveStudent_(old);
assert.strictEqual(w.g.reviewStatus_(old.progress[LID]), 'approved');
assert.strictEqual(w.g.percent_(old.progress[LID], L), 100);
assert.strictEqual(pageData(S3, '/lessons/' + LID).data.review.status, 'approved');

// a teacher previewing a lesson can't ship or review anything by accident
assert.ok(w.call(T, 'api', ['/api/review', JSON.stringify({ action: 'seen', lesson: LID })]).body.teacher);

console.log('review checks passed');
