// ---------------------------------------------------------------- lesson progress
// A lesson has four stages: Mission, Build (one step per screen), Quiz, Ship it.
// Progress for one lesson (rec.progress[lessonId]):
//   mission_done, talk                      the mission's partner question
//   steps: { "0": {tests: [0, 1], answer, fields: [...], done} }, step_at
//   quiz_answers, quiz_score, quiz_best, quiz_total, quiz_attempts
//   ext: { "0": true }, reflect: [...], share, shipped_at
//   partner, started_at, updated_at, completed_at

var STAGES_ = [['mission', 'Mission', '🎯'], ['build', 'Build', '🛠️'], ['quiz', 'Quiz', '🧠'], ['ship', 'Ship it', '🚀']];
var SHARE_RE_ = /^https:\/\/(makecode\.microbit\.org|makecode\.com)\/[\w\-#?=&%.\/]+$/i;

function stepDone_(L, p, i) { return !!(p && p.steps && p.steps[i] && p.steps[i].done); }
function stepsDone_(L, p) { var n = 0; for (var i = 0; i < L.build.length; i++) if (stepDone_(L, p, i)) n++; return n; }
function quizPassed_(L, p) { return !!(p && p.quiz_total && p.quiz_best / p.quiz_total >= DATA.quiz_pass); }
function quizPerfect_(p) { return !!(p && p.quiz_total && p.quiz_best === p.quiz_total); }

/** Which stages are finished: {mission, build, quiz, ship}. */
function stagesDone_(L, p) {
  return { mission: !!(p && p.mission_done), build: stepsDone_(L, p) === L.build.length, quiz: quizPassed_(L, p), ship: !!(p && p.shipped_at) };
}

/** The first stage that isn't finished, or 'done'. */
function currentStage_(L, p) {
  var d = stagesDone_(L, p);
  for (var i = 0; i < STAGES_.length; i++) if (!d[STAGES_[i][0]]) return STAGES_[i][0];
  return 'done';
}

/** Percent done: the mission, every build step, the quiz and shipping each count as one part. */
function percent_(p, L) {
  if (!p) return 0;
  var d = stagesDone_(L, p), total = L.build.length + 3;
  return Math.round(100 * ((d.mission ? 1 : 0) + stepsDone_(L, p) + (d.quiz ? 1 : 0) + (d.ship ? 1 : 0)) / total);
}

/** 0-3 stars: perfect quiz · at least one extension · shipped. */
function lessonStars_(L, p) {
  if (!p) return 0;
  var ext = Object.keys(p.ext || {}).some(function (k) { return p.ext[k]; });
  return (quizPerfect_(p) ? 1 : 0) + (ext ? 1 : 0) + (p.shipped_at ? 1 : 0);
}

/** A step counts when every Test it box is ticked, its question is answered and its blanks are filled. */
function stepComplete_(S, row) {
  var ticked = row.tests || [];
  for (var t = 0; t < (S.test || []).length; t++) if (ticked.indexOf(t) < 0) return false;
  if (S.ask && String(row.answer || '').trim().length < 2) return false;
  for (var f = 0; f < (S.fields || []).length; f++) if (!String((row.fields || [])[f] || '').trim()) return false;
  return true;
}

/** What's still missing before a project can be shipped (empty when it's ready). */
function shipMissing_(L, p) {
  var out = [], ship = L.ship || {};
  if (!SHARE_RE_.test(String(p.share || ''))) out.push('Paste your MakeCode share link (it starts with https://makecode.microbit.org/).');
  if ((ship.extensions || []).length && !Object.keys(p.ext || {}).some(function (k) { return p.ext[k]; })) out.push('Check at least one extension you added.');
  (ship.reflect || []).forEach(function (q, i) {
    if (String((p.reflect || [])[i] || '').trim().length < 3) out.push('Answer: ' + q);
  });
  return out;
}

function gradeQuiz_(L, answers) {
  var results = L.quiz.map(function (q, i) {
    return { correct: answers[i] === q.answer, answer: q.answer, why: q.why };
  });
  var score = results.filter(function (r) { return r.correct; }).length;
  return { score: score, total: L.quiz.length, results: results, passed: score / L.quiz.length >= DATA.quiz_pass };
}
