// ---------------------------------------------------------------- student API
// The lesson page calls api(path, body) through google.script.run (client/shim.js):
//   /api/lessons/<id>/mission  {talk}                         finish the Mission stage
//   /api/lessons/<id>/step     {i, tests, answer, fields}     tick off a Build step
//   /api/lessons/<id>/quiz     {answers}                      graded here, so answers never reach the browser
//   /api/lessons/<id>/ship     {share, ext, reflect, submit}  save Ship it (submit: true turns it in)
//   /api/lessons/<id>/partner  {action: pair|leave, partner_id}
//   /api/lessons/<id>/feedback {kind: step|quiz|rating, ...}   (60_feedback.js)
//   /api/avatar                {body, color, ...}
//   /api/shop/buy              {item: 'part:eyes:star' | 'power:turbo'}      (35_arcade.js)
//   /api/arcade/start, /api/arcade/finish {run_id, score}                    Robot Rush

function text_(v, max) {
  if (v == null) return '';
  if (typeof v !== 'string') throw badRequest_('Bad request');
  return v.slice(0, max || MAX_TEXT);
}

function newProgress_() {
  return { steps: {}, started_at: now_(), updated_at: now_() };
}

/** Every student request: who they are, their record, the teacher's settings. */
function student_() {
  var me = whoIs_();
  if (!me.email) throw new Error('Sign in with your school Google account.');
  var rec = loadStudent_(me.email);
  if (!rec) throw new Error('Join your class first: open Maker Lab and enter your class code.');
  return { me: me, rec: rec, cfg: config_() };
}

function finish_(ctx, L, p, extra) {
  var pct = percent_(p, L);
  if (pct === 100 && !p.completed_at) p.completed_at = now_();
  p.updated_at = now_();
  var mate = mirrorToPartner_(ctx, L, p);       // working together: the partner gets the same work
  var rewards = syncRewards_(ctx.rec, ctx.cfg);
  saveStudent_(ctx.rec);
  var out = { ok: true, percent: pct, stages: stagesDone_(L, p), stage: currentStage_(L, p), rewards: rewards,
              lesson_xp: lessonXp_(ctx.rec, L.id), stars: lessonStars_(L, p), level: levelInfo_(ctx.rec.xp || 0) };
  if (mate) out.partner = mate;
  out.arcade = arcadeState_(ctx.rec, ctx.cfg);
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

/** One entry point for the lesson page. Returns {status, body} like an HTTP response. */
function api(path, bodyJson) {
  try {
    var body = bodyJson ? JSON.parse(bodyJson) : {};
    if (path === '/api/run') return runCall_(body);
    if (path === '/api/help') return { status: 200, body: helpApi_(body) };
    if (path === '/api/avatar') return apiAvatar_(body);
    if (/^\/api\/(shop\/buy|arcade\/start|arcade\/finish)$/.test(path)) return { status: 200, body: shopApi_(path, body) };
    var m = /^\/api\/lessons\/([\w-]+)\/(mission|step|quiz|ship|partner|feedback)$/.exec(path);
    if (!m) return { status: 404, body: { error: 'Not found' } };
    var L = DATA.lessons[m[1]];
    if (!L) return { status: 404, body: { error: 'No such lesson' } };
    if (whoIs_().teacher && m[2] === 'feedback') return { status: 200, body: { ok: true, teacher: true } };
    if (whoIs_().teacher && m[2] !== 'quiz') return { status: 200, body: { ok: true, teacher: true } };   // previews don't save
    if (whoIs_().teacher) return { status: 200, body: { ok: true, quiz: gradeQuiz_(L, (body.answers || []).slice(0, L.quiz.length)) } };
    var ctx = student_();
    var p = ctx.rec.progress[L.id] || (ctx.rec.progress[L.id] = newProgress_());
    return { status: 200, body: API_[m[2]](ctx, L, p, body) };
  } catch (e) {
    if (e && e.status) return { status: e.status, body: { ok: false, error: e.message } };
    return { status: 400, body: { ok: false, error: (e && e.message) || 'Something went wrong.' } };
  }
}

// ---------------------------------------------------------------- every page action goes through api('/api/run')
// The browser calls only api(); this picks the function. (A browser holding an older copy of the page can't
// call a function google.script.run doesn't know about, so the pages never call the others directly.)
// Each function checks for itself who may use it (teacher_() or the signed-in student).
var RUN_ = {
  joinClass: function (a) { return joinClass(a[0], a[1]); },
  createClass: function (a) { return createClass(a[0], a[1]); },
  setClassGrade: function (a) { return setClassGrade(a[0], a[1]); },
  deleteClass: function (a) { return deleteClass(a[0], a[1]); },
  assignLessons: function (a) { return assignLessons(a[0], a[1], a[2], a[3]); },
  updateAssignment: function (a) { return updateAssignment(a[0], a[1], a[2], a[3]); },
  removeStudent: function (a) { return removeStudent(a[0], a[1]); },
  saveFeedback: function (a) { return saveFeedback(a[0], a[1], a[2]); },
  giveBonus: function (a) { return giveBonus(a[0], a[1], a[2], a[3]); },
  saveVideos: function (a) { return saveVideos(a[0]); },
  teacherHome: function () { return teacherHome(); },
  gradebook: function (a) { return gradebook(a[0]); },
  studentDetail: function (a) { return studentDetail(a[0], a[1]); },
  classroomPackage: function (a) { return classroomPackage(a[0], a[1], a[2]); },
  screenData: function (a) { return screenData(a[0]); },
  screenSave: function (a) { return screenSave(a[0], a[1]); },
  setTabIcon: function (a) { return setTabIcon(a[0], a[1]); },
  classroomCourses: function () { return classroomCourses(); },
  importClassroom: function (a) { return importClassroom(a[0]); },
  syncClassroom: function (a) { return syncClassroom(a[0]); },
  syncAllClassroom: function () { return syncAllClassroom(); },
  unlinkClassroom: function (a) { return unlinkClassroom(a[0]); },
  arcadeClass: function (a) { return arcadeClass(a[0], a[1], a[2]); },
  helpList: function (a) { return helpList(a[0]); },
  feedbackReport: function (a) { return feedbackReport(a[0]); },
  helpResolve: function (a) { return helpResolve(a[0], a[1]); },
};
function runCall_(d) {
  var fn = RUN_[d && d.fn];
  if (!fn) return { status: 404, body: { ok: false, error: 'Maker Lab doesn\'t know "' + (d && d.fn) + '". Reload the page; if it keeps happening, the files may be from different versions.' } };
  return { status: 200, body: { ok: true, value: fn((d.args || []).slice(0, 6)) } };
}

function badRequest_(msg) { var e = new Error(msg); e.status = 400; return e; }

var API_ = {
  mission: function (ctx, L, p, d) {
    p.talk = text_(d.talk, 2000);
    p.mission_done = p.talk.trim().length >= 3;
    return finish_(ctx, L, p);
  },

  step: function (ctx, L, p, d) {
    var i = d.i, S = L.build[i];
    if (typeof i !== 'number' || !S) throw badRequest_('No such step');
    p.steps = p.steps || {};
    var row = p.steps[i] || {};
    if (d.tests !== undefined) row.tests = (d.tests || []).filter(function (t, k, all) {
      return typeof t === 'number' && t >= 0 && t < (S.test || []).length && all.indexOf(t) === k;
    });
    if (d.answer !== undefined) row.answer = text_(d.answer, 2000);
    if (d.fields !== undefined) row.fields = (d.fields || []).slice(0, (S.fields || []).length).map(function (f) { return text_(String(f == null ? '' : f), 200); });
    row.done = stepComplete_(S, row);
    p.steps[i] = row;
    p.step_at = Math.max(p.step_at || 0, row.done ? Math.min(i + 1, L.build.length - 1) : i);
    return finish_(ctx, L, p, { step: i, step_done: row.done });
  },

  quiz: function (ctx, L, p, d) {
    var answers = d.answers;
    if (!Array.isArray(answers) || answers.length !== L.quiz.length) throw badRequest_('Answer every question first.');
    var g = gradeQuiz_(L, answers);
    p.quiz_answers = answers;
    if (!p.quiz_first) p.quiz_first = answers.slice();       // first try: the feedback report shows which questions trip students up
    p.quiz_score = g.score;
    p.quiz_total = g.total;
    p.quiz_best = Math.max(p.quiz_best || 0, g.score);
    p.quiz_attempts = (p.quiz_attempts || 0) + 1;
    return finish_(ctx, L, p, { quiz: g });
  },

  feedback: function (ctx, L, p, d) { return lessonFeedback_(ctx, L, d); },

  ship: function (ctx, L, p, d) {
    if (d.share !== undefined) p.share = text_(d.share, 300).trim();
    if (d.ext !== undefined) {
      p.ext = {};
      (d.ext || []).forEach(function (k) { if (typeof k === 'number' && ((L.ship || {}).extensions || [])[k]) p.ext[k] = true; });
    }
    if (d.reflect !== undefined) p.reflect = (d.reflect || []).slice(0, ((L.ship || {}).reflect || []).length).map(function (r) { return text_(String(r || ''), 2000); });
    var missing = shipMissing_(L, p);
    if (d.submit) {
      if (missing.length) return finish_(ctx, L, p, { ok: false, missing: missing });
      if (!p.shipped_at) p.shipped_at = now_();
    } else if (missing.length && p.shipped_at) {
      delete p.shipped_at;           // they changed something it needs: turn it in again
    }
    return finish_(ctx, L, p, { missing: missing, shipped: !!p.shipped_at });
  },

  partner: function (ctx, L, p, d) {
    if (d.action === 'pair') {
      var email = String(d.partner_id || '').toLowerCase();
      if (p.partner) throw badRequest_('You already have a partner for this lesson.');
      if (!classmates_(ctx).some(function (m) { return m.id === email; })) throw badRequest_('You can only partner with someone in your class.');
      var mate = partnerRecord_(ctx.cfg, email), theirs = mate.progress[L.id];
      if (theirs && theirs.partner && theirs.partner !== ctx.rec.email) throw badRequest_('That classmate already has a partner for this lesson.');
      mergeProgress_(p, theirs);
      p.partner = email;
      finish_(ctx, L, p);                          // saves both files and gives XP to both
    } else if (d.action === 'leave' && p.partner) {
      var other = loadStudent_(p.partner);
      if (other && other.progress[L.id] && other.progress[L.id].partner === ctx.rec.email) {
        delete other.progress[L.id].partner;
        saveStudent_(other);
      }
      delete p.partner;
      saveStudent_(ctx.rec);
    }
    return partnerState_(ctx, L, p);
  },
};

// ---------------------------------------------------------------- partners (two classmates, one Chromebook)
// The signed-in student picks a classmate. There's no accept step: the partner is sitting right there.
// Both students' progress for the lesson is combined, then every save is copied to the partner's file.
function classmates_(ctx) {
  var sum = summary_(), seen = {}, out = [];
  studentClassIds_(ctx.rec, ctx.cfg).forEach(function (cid) {
    classStudents_(ctx.cfg, sum, cid).forEach(function (s) {
      if (s.email === ctx.rec.email || seen[s.email]) return;
      seen[s.email] = 1;
      out.push({ id: s.email, name: s.name });
    });
  });
  return out.sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
}

function partnerName_(cfg, email) {
  var rec = loadStudent_(email);
  return (rec && rec.name) || rosterName_(cfg, email) || email;
}

function partnerRecord_(cfg, email) {
  var rec = loadStudent_(email);
  if (!rec) { rec = newStudent_(email); rec.name = rosterName_(cfg, email) || email.split('@')[0]; }
  return rec;
}

/** Combine two students' work on one lesson into a: whatever either of them finished counts. */
function mergeProgress_(a, b) {
  if (!b) return a;
  a.mission_done = !!(a.mission_done || b.mission_done);
  if (!a.talk && b.talk) a.talk = b.talk;
  a.steps = a.steps || {};
  Object.keys(b.steps || {}).forEach(function (k) {
    var mine = a.steps[k], theirs = b.steps[k];
    if (!mine || (!mine.done && theirs.done)) a.steps[k] = JSON.parse(JSON.stringify(theirs));
  });
  a.step_at = Math.max(a.step_at || 0, b.step_at || 0);
  if ((b.quiz_best || 0) > (a.quiz_best || 0)) {
    a.quiz_best = b.quiz_best; a.quiz_total = b.quiz_total; a.quiz_answers = b.quiz_answers; a.quiz_score = b.quiz_score;
  }
  a.quiz_attempts = Math.max(a.quiz_attempts || 0, b.quiz_attempts || 0);
  if (!a.quiz_first && b.quiz_first) a.quiz_first = b.quiz_first;
  a.ext = a.ext || {};
  Object.keys(b.ext || {}).forEach(function (k) { if (b.ext[k]) a.ext[k] = true; });
  if (!a.share && b.share) a.share = b.share;
  if (!(a.reflect || []).join('') && (b.reflect || []).join('')) a.reflect = b.reflect;
  ['shipped_at', 'completed_at', 'started_at'].forEach(function (f) {
    if (b[f] && (!a[f] || b[f] < a[f])) a[f] = b[f];
  });
  return a;
}

/** After any save: copy this lesson's work to the partner's file. Returns the partner's name, or null. */
function mirrorToPartner_(ctx, L, p) {
  if (!p.partner) return null;
  var mate = partnerRecord_(ctx.cfg, p.partner), theirs = mate.progress[L.id];
  if (theirs && theirs.partner && theirs.partner !== ctx.rec.email) { delete p.partner; return null; }   // they paired with someone else
  var copy = JSON.parse(JSON.stringify(p));
  copy.partner = ctx.rec.email;
  if (theirs && theirs.quiz_first) copy.quiz_first = theirs.quiz_first;      // each keeps their own first try (feedback report)
  mate.progress[L.id] = copy;
  syncRewards_(mate, ctx.cfg);
  saveStudent_(mate);
  return mate.name;
}

function partnerState_(ctx, L, p) {
  if (p.partner) return { status: 'paired', name: partnerName_(ctx.cfg, p.partner) };
  return { status: 'none', classmates: classmates_(ctx) };
}

function apiAvatar_(d) {
  var me = whoIs_();
  if (me.teacher) return { status: 200, body: { ok: true, avatar: cleanAvatar_({ xp: 0 }, d, true).avatar, rewards: {} } };
  var ctx = student_();
  var r = cleanAvatar_(ctx.rec, d, false);
  if (r.error) return { status: 400, body: { ok: false, error: r.error } };
  ctx.rec.avatar = r.avatar;
  var rewards = syncRewards_(ctx.rec, ctx.cfg);
  saveStudent_(ctx.rec);
  return { status: 200, body: { ok: true, avatar: r.avatar, rewards: rewards } };
}

// ---------------------------------------------------------------- joining a class
function joinClass(code, name) {
  var me = whoIs_();
  if (!me.email) throw new Error('Sign in with your school Google account.');
  if (me.teacher) throw new Error('You are the teacher. Students join with the class code.');
  code = String(code || '').trim().toUpperCase();
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  var cfg = config_();
  var cls = Object.keys(cfg.classes).map(function (k) { return cfg.classes[k]; }).filter(function (c) { return c.code === code; })[0];
  if (!cls) throw new Error('That class code was not found. Check it with your teacher.');
  var rec = loadStudent_(me.email) || newStudent_(me.email);
  if (name) rec.name = name;
  if (!rec.name) throw new Error('Type your first name and last initial.');
  if (rec.classes.indexOf(cls.id) < 0) rec.classes.push(cls.id);
  saveStudent_(rec);
  return { ok: true, class_name: cls.name };
}

// ---------------------------------------------------------------- setup
/** Run once from the editor (Run > setup). Makes the data folder, the settings file and the tab icon. */
function setup() {
  dataFolder_();
  studentFolder_();
  if (!readNamed_('config', null)) saveConfig_(emptyConfig_());
  logoUrl_();
  return 'Set up: the "' + DATA_FOLDER + '" folder in your Drive is ready.';
}
