// ---------------------------------------------------------------- 📨 teacher review of shipped projects
// Shipping a lesson sends the student's MakeCode share link to the teacher. The lesson only counts as complete (100%,
// completion XP, play time, the finish line on the class display, the next lesson on the skill tree) once the teacher
// approves it. The teacher reviews with the project open in MakeCode beside a rubric of 1-4 rows tied to the lesson's
// standards (like Pixel Trail), writes feedback, and approves or sends it back. The student gets a pop-up either way;
// "sent back" takes them to the lesson to fix it and ship again.
//
// On the lesson's progress (rec.progress[lid].review):
//   { status: 'submitted' | 'approved' | 'returned' | 'draft', round, submitted_at,
//     scores: {works: 3, ...}, total, max, feedback, graded_at, seen, history: [{status, feedback, total, max, at}] }
// Work shipped before reviews existed has shipped_at but no review: it stays approved (nothing is taken back).
//
// The teacher's decision is written to the student's file and also left in a small mailbox (script property
// "grade:<email>"), because a student's own save in the same second could write their older copy over it. Every
// student request delivers the mailbox into their record (applyGrades_) and empties it once the file has it.

var REVIEW_LEVELS_ = 4;

/** The rubric for a lesson: its own `rubric` from the lesson file, or three rows built from the lesson. */
function rubric_(L) {
  if (L.rubric && L.rubric.length) return L.rubric;
  var idea = String(L.python || '').trim();
  var hasExt = ((L.ship || {}).extensions || []).length > 0;
  return [
    { id: 'works', label: 'It works', levels: ["Doesn't run, or is empty", 'Runs, but parts are missing or buggy', 'Does what the mission asks', 'Works smoothly, no bugs found'] },
    { id: 'concept', label: 'Uses ' + (idea || 'the big idea'), levels: ['Not used', 'Copied without changes', 'Used correctly', 'Used in a way of their own'] },
    { id: 'own', label: 'Made it their own', levels: hasExt ? ['No changes', 'Small changes', 'An extension added and working', 'Went past the extensions'] : ['No changes', 'Small changes', 'Clear personal choices', 'Went past the lesson'] },
  ];
}

/** 'submitted' | 'approved' | 'returned' | 'draft' | null. Old work shipped before reviews existed counts as approved. */
function reviewStatus_(p) {
  if (!p) return null;
  if (p.review && p.review.status) return p.review.status;
  return p.shipped_at ? 'approved' : null;
}

/** MakeCode project id from a share link (…/_AbCd1234, …/#pub:_AbCd1234, …/S12345-12345-12345-12345), or ''. */
function makecodeId_(url) {
  var m = /makecode\.(?:microbit\.org|com)\/(?:.*?[\/:=])?(_[A-Za-z0-9]{6,}|S?\d{5}(?:-\d{5}){3})(?![\w-])/.exec(String(url || ''));
  return m ? m[1] : '';
}

// ---------------------------------------------------------------- the mailbox of decisions not yet in a student's file
function gradesKey_(email) { return 'grade:' + email; }
function pendingGrades_(email) {
  var raw = PropertiesService.getScriptProperties().getProperty(gradesKey_(email));
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}
function setPendingGrades_(email, map) {
  var props = PropertiesService.getScriptProperties();
  if (Object.keys(map).length) props.setProperty(gradesKey_(email), JSON.stringify(map));
  else props.deleteProperty(gradesKey_(email));
}

/** Put any decisions from the mailbox into this student's record. Returns true if the record changed (save it). */
function applyGrades_(rec) {
  if (!rec || !rec.email) return false;
  var box = pendingGrades_(rec.email), changed = false, left = {};
  Object.keys(box).forEach(function (lid) {
    var g = box[lid], p = rec.progress[lid];
    if (!p) return;                                                                   // no such lesson in their file: drop it
    var r = p.review || {};
    if (r.graded_at === g.graded_at) return;                                          // already in the file: done with it
    if ((r.round || 0) > (g.round || 0)) return;                                      // they have shipped again since
    p.review = g;
    if (g.status === 'approved' && !p.completed_at) p.completed_at = g.graded_at;
    changed = true;
    left[lid] = g;                                                                    // keep it until a later read finds it saved
  });
  if (Object.keys(box).length !== Object.keys(left).length) setPendingGrades_(rec.email, left);
  return changed;
}

/** Results the student hasn't seen yet, for the pop-up on every page. */
function reviewNews_(rec) {
  var out = [];
  Object.keys((rec && rec.progress) || {}).forEach(function (lid) {
    var L = DATA.lessons[lid], r = rec.progress[lid].review;
    if (!L || !r || r.seen || (r.status !== 'approved' && r.status !== 'returned')) return;
    out.push(reviewForStudent_(L, r));
  });
  return out;
}
function reviewForStudent_(L, r) {
  var rows = rubric_(L).map(function (row) { var s = (r.scores || {})[row.id]; return { label: row.label, score: s || 0, level: s ? row.levels[s - 1] : '' }; });
  return { lesson_id: L.id, title: L.number + '. ' + L.title, icon: L.icon, status: r.status, feedback: r.feedback || '', total: r.total || 0,
           max: r.max || 0, rows: rows, graded_at: r.graded_at, round: r.round || 1, xp: r.xp || 0, badges: r.badges || [] };
}

/** Student API: /api/review {action: 'seen', lesson} marks a result as read (the pop-up won't show it again). */
function reviewApi_(d) {
  if (whoIs_().teacher) return { ok: true, teacher: true };
  var ctx = student_(), p = ctx.rec.progress[String(d.lesson || '')];
  if (d.action === 'seen' && p && p.review && !p.review.seen) {
    p.review.seen = now_();
    var box = pendingGrades_(ctx.rec.email);
    if (box[d.lesson]) { box[d.lesson].seen = p.review.seen; setPendingGrades_(ctx.rec.email, box); }
    saveStudent_(ctx.rec);
  }
  return { ok: true };
}

// ---------------------------------------------------------------- teacher
/** Everything waiting for review, oldest first, from every class (or one class). */
function reviewQueue(cid) { return reviewQueue_(teacher_(), cid, true); }
function reviewQueue_(cfg, cid, fresh) {
  var sum = summary_(fresh), out = [], seen = {};
  Object.keys(cfg.classes).forEach(function (c) {
    if (cid && c !== cid) return;
    classStudents_(cfg, sum, c).forEach(function (s) {
      Object.keys(s.lessons || {}).forEach(function (lid) {
        var x = s.lessons[lid], L = DATA.lessons[lid];
        var key = lid + '|' + [s.email, x.partner || ''].sort().join('|');           // a pair shipped one project: list it once
        if (!L || x.review !== 'submitted' || seen[key]) return;
        seen[key] = 1;
        out.push({ email: s.email, name: s.name, avatar: s.avatar || null, class_id: c, class_name: cfg.classes[c].name, lesson_id: lid,
                   number: L.number, title: L.title, icon: L.icon, submitted_at: x.submitted_at || '', round: x.round || 1,
                   partner: x.partner ? (sum.students[x.partner] || {}).name || x.partner.split('@')[0] : null });
      });
    });
  });
  out.sort(function (a, b) { return String(a.submitted_at).localeCompare(String(b.submitted_at)); });
  return { queue: out };
}

function reviewCount_() {
  try { return reviewQueue_(config_(), '', false).queue.length; } catch (e) { return 0; }    // the cached summary: cheap
}

/** One project to review: the share link, what they wrote, the rubric and the lesson's standards. */
function reviewWork(email, lid) {
  var cfg = teacher_(), L = DATA.lessons[lid];
  if (!L) throw new Error('No such lesson.');
  var rec = loadStudentFresh_(email);
  if (!rec || !rec.progress[lid]) throw new Error('No work saved for that lesson yet.');
  applyGrades_(rec);
  var p = rec.progress[lid], r = p.review || {}, ship = L.ship || {}, q = reviewQueue().queue;
  var rest = q.filter(function (x) { return !(x.email === email && x.lesson_id === lid); });
  return {
    student: { email: email, name: rec.name, avatar: avatarOf_(rec) },
    classes: studentClassIds_(rec, cfg).map(function (c) { return { id: c, name: cfg.classes[c].name }; }),
    lesson: { id: L.id, number: L.number, title: L.title, icon: L.icon, mission: L.mission.goal || '', editor: DATA.courses[L.course].editor },
    share: p.share || '', project: makecodeId_(p.share), status: reviewStatus_(p), review: r, round: r.round || (p.shipped_at ? 1 : 0),
    submitted_at: r.submitted_at || p.shipped_at || '', history: r.history || [],
    partner: p.partner ? partnerName_(cfg, p.partner) : null,
    checks: { steps_done: stepsDone_(L, p), steps_total: L.build.length, quiz_best: p.quiz_best == null ? null : p.quiz_best, quiz_total: L.quiz.length,
              quiz_first: p.quiz_first ? gradeQuiz_(L, p.quiz_first).score : null },
    extensions: (ship.extensions || []).map(function (e, i) { return { title: e.title, level: e.level, done: !!(p.ext || {})[i] }; }),
    reflect: (ship.reflect || []).map(function (qq, i) { return { q: qq, a: (p.reflect || [])[i] || '' }; }),
    rubric: rubric_(L), standards: L.standards_full || [],
    next: rest.length ? { email: rest[0].email, lesson_id: rest[0].lesson_id, left: rest.length } : null,
  };
}

/** The teacher's decision. d = {status: 'approved' | 'returned', scores: {rowId: 1-4}, feedback}. */
function gradeWork(email, lid, d) {
  teacher_();
  var L = DATA.lessons[lid];
  if (!L) throw new Error('No such lesson.');
  d = d || {};
  var status = d.status === 'approved' ? 'approved' : d.status === 'returned' ? 'returned' : '';
  if (!status) throw new Error('Approve it or send it back.');
  var rubric = rubric_(L), scores = {}, total = 0;
  rubric.forEach(function (row) {
    var s = Math.round(Number((d.scores || {})[row.id]) || 0);
    if (s >= 1 && s <= REVIEW_LEVELS_) { scores[row.id] = s; total += s; }
  });
  if (status === 'approved' && Object.keys(scores).length < rubric.length) throw new Error('Score each row of the rubric first.');
  var feedback = String(d.feedback || '').trim().slice(0, 1500);
  if (status === 'returned' && feedback.length < 3) throw new Error('Tell them what to fix: write a little feedback first.');
  var rec = loadStudentFresh_(email);
  if (!rec || !rec.progress[lid]) throw new Error('No work saved for that lesson yet.');
  applyGrades_(rec);
  var who = [rec], p = rec.progress[lid];
  if (p.partner) {                                                    // a pair shipped one project: the same decision for both
    var mate = loadStudentFresh_(p.partner);
    if (mate && mate.progress[lid] && mate.progress[lid].partner === email) { applyGrades_(mate); who.push(mate); }
  }
  var at = now_();
  who.forEach(function (r) {
    var q = r.progress[lid], old = q.review || {};
    var g = { status: status, round: old.round || 1, submitted_at: old.submitted_at || q.shipped_at || '', scores: scores, total: total,
              max: rubric.length * REVIEW_LEVELS_, feedback: feedback, graded_at: at, seen: '',
              history: (old.history || []).concat([{ status: status, feedback: feedback, total: total, max: rubric.length * REVIEW_LEVELS_, at: at }]).slice(-10) };
    q.review = g;
    if (status === 'approved' && !q.completed_at) q.completed_at = at;
    var won = syncRewards_(r, config_());                             // approval finishes the lesson: XP, badges, play time
    if (won.xp_gained) g.xp = won.xp_gained;                          // shown in the student's pop-up
    if (won.badges.length) g.badges = won.badges.map(function (b) { return { name: b.name, icon: b.icon }; });
    saveStudent_(r);
    var box = pendingGrades_(r.email);
    box[lid] = g;
    setPendingGrades_(r.email, box);
  });
  return { ok: true, status: status, total: total, max: rubric.length * REVIEW_LEVELS_, students: who.map(function (r) { return r.name; }) };
}

/** "📨 Review (3)" in the teacher's top bar; just "📨 Review" when nothing is waiting or the count can't be had. */
function reviewNavLabel_() {
  var n = reviewCount_();
  return n ? '📨 Review (' + n + ')' : '📨 Review';
}
