// ---------------------------------------------------------------- lesson feedback and the report for improving lessons
// Students flag a build step or quiz question as confusing, and rate the lesson at the end. Kept in the student's
// record (rec.lesson_fb), not in lesson progress, so a partner's save never overwrites it. Help requests (37_help.js)
// count up per step too. The teacher's Feedback page adds it all up, with first-try quiz misses, without names.

var FB_REASONS_ = { unclear: 'The instructions were unclear', broken: "The code didn't work", hard: 'Too hard', easy: 'Too easy or boring', other: 'Something else' };

function fbOf_(rec, lid) {
  rec.lesson_fb = rec.lesson_fb || {};
  return rec.lesson_fb[lid] || (rec.lesson_fb[lid] = { flags: {}, help: {} });
}

/** /api/lessons/<id>/feedback  {kind: 'step' | 'quiz', i, reason, note}  or  {kind: 'rating', rating 1-5, hardest, change} */
function lessonFeedback_(ctx, L, d) {
  var fb = fbOf_(ctx.rec, L.id), i = Math.floor(Number(d.i));
  if (d.kind === 'step' || d.kind === 'quiz') {
    var list = d.kind === 'step' ? L.build : L.quiz;
    if (!(i >= 0 && i < list.length)) throw badRequest_('No such ' + d.kind + '.');
    if (!FB_REASONS_[d.reason]) throw badRequest_('Pick a reason.');
    fb.flags[d.kind + ':' + i] = { reason: d.reason, note: text_(d.note, 200).trim(), at: now_() };
    saveStudent_(ctx.rec);
    return { ok: true, flagged: d.kind + ':' + i };
  }
  if (d.kind === 'rating') {
    var r = Math.round(Number(d.rating));
    if (!(r >= 1 && r <= 5)) throw badRequest_('Pick how much you liked it.');
    fb.rating = r;
    fb.hardest = text_(d.hardest, 400).trim();
    fb.change = text_(d.change, 400).trim();
    fb.rated_at = now_();
    var rewards = syncRewards_(ctx.rec, ctx.cfg);
    saveStudent_(ctx.rec);
    return { ok: true, rating: r, rewards: rewards, level: levelInfo_(ctx.rec.xp || 0) };
  }
  throw badRequest_('Unknown feedback.');
}

/** What the lesson page needs to show what this student already said. */
function myFeedback_(rec, lid) {
  var fb = (rec && rec.lesson_fb && rec.lesson_fb[lid]) || {};
  return { flags: Object.keys(fb.flags || {}), rating: fb.rating || 0, hardest: fb.hardest || '', change: fb.change || '' };
}

/** Small copy for the summary file: the report reads every student from there. */
function fbSummary_(rec) {
  var out = {};
  Object.keys(rec.lesson_fb || {}).forEach(function (lid) {
    var f = rec.lesson_fb[lid];
    out[lid] = { flags: f.flags || {}, help: f.help || {}, rating: f.rating || 0, hardest: f.hardest || '', change: f.change || '' };
  });
  Object.keys(rec.progress || {}).forEach(function (lid) {
    var p = rec.progress[lid], first = p.quiz_first || p.quiz_answers;
    if (first) (out[lid] = out[lid] || { flags: {}, help: {} }).quiz = first;
  });
  return out;
}

/** Teacher: everything students said about each lesson in a course. No names. */
function feedbackReport(grade) {
  var cfg = teacher_(), sum = summary_(true), cid = DATA.courses[grade] ? grade : DATA.default_course;
  var lessons = lessonList_(cid).map(function (L) {
    var x = { id: L.id, number: L.number, title: L.title, file: L.file, ratings: [0, 0, 0, 0, 0], hardest: [], change: [],
              started: 0, finished: 0, steps: L.build.map(function (st, i) { return { n: i + 1, title: st.title, flags: 0, reasons: {}, notes: [], help: 0 }; }),
              quiz: L.quiz.map(function (q, i) { return { n: i + 1, question: q.question.replace(/<[^>]+>/g, ''), answered: 0, missed: 0, flags: 0, reasons: {}, notes: [] }; }) };
    Object.keys(sum.students).forEach(function (email) {
      var s = sum.students[email], f = (s.fb || {})[L.id], prog = (s.lessons || {})[L.id];
      if (prog) { x.started++; if (prog.pct === 100) x.finished++; }
      if (!f) return;
      if (f.rating) x.ratings[f.rating - 1]++;
      if (f.hardest) x.hardest.push(f.hardest);
      if (f.change) x.change.push(f.change);
      Object.keys(f.flags || {}).forEach(function (k) {
        var parts = k.split(':'), item = (parts[0] === 'step' ? x.steps : x.quiz)[+parts[1]], fl = f.flags[k];
        if (!item) return;
        item.flags++;
        item.reasons[fl.reason] = (item.reasons[fl.reason] || 0) + 1;
        if (fl.note) item.notes.push(fl.note);
      });
      Object.keys(f.help || {}).forEach(function (k) { if (x.steps[+k]) x.steps[+k].help += f.help[k]; });
      (f.quiz || []).forEach(function (a, qi) {
        if (!L.quiz[qi]) return;
        x.quiz[qi].answered++;
        if (a !== L.quiz[qi].answer) x.quiz[qi].missed++;
      });
    });
    var n = x.ratings.reduce(function (t, c) { return t + c; }, 0);
    x.rated = n;
    x.avg = n ? Math.round(10 * x.ratings.reduce(function (t, c, i) { return t + c * (i + 1); }, 0) / n) / 10 : null;
    return x;
  });
  return { grade: cid, grade_name: DATA.courses[cid].name, grades: DATA.course_ids.map(function (g) { return { id: g, name: DATA.courses[g].short }; }),
           students: Object.keys(sum.students).length, reasons: FB_REASONS_, lessons: lessons,
           generated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') };
}
