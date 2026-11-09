// ---------------------------------------------------------------- teacher
// Only the script owner can call these. They change config.json, never a student's file,
// so a teacher and a student saving at the same moment can't overwrite each other.

function teacher_() {
  var me = whoIs_();
  if (!me.teacher) { var e = new Error('Only the teacher can do that.'); e.status = 403; throw e; }
  return config_();
}

function joinCode_(cfg) {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', used = {};
  Object.keys(cfg.classes).forEach(function (k) { used[cfg.classes[k].code] = 1; });
  for (;;) {
    var code = '';
    for (var i = 0; i < 6; i++) code += abc.charAt(Math.floor(Math.random() * abc.length));
    if (!used[code]) return code;
  }
}

function dateOrEmpty_(s) {
  s = String(s || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function createClass(name) {
  var cfg = teacher_();
  name = String(name || '').trim().slice(0, 80);
  if (!name) throw new Error('Give the class a name.');
  var id = String(nextId_(cfg));
  cfg.classes[id] = { id: id, name: name, code: joinCode_(cfg), created_at: now_() };
  saveConfig_(cfg);
  return cfg.classes[id];
}

function deleteClass(cid, typedName) {
  var cfg = teacher_(), c = cfg.classes[cid];
  if (!c) throw new Error('No such class.');
  if (typedName !== c.name) throw new Error('Type the class name exactly to delete it.');
  delete cfg.classes[cid];
  if (cfg.rosters) delete cfg.rosters[cid];
  cfg.assignments = cfg.assignments.filter(function (a) { return a.class_id !== cid; });
  saveConfig_(cfg);
  return { ok: true };
}

function assignLessons(cid, lessonIds, due, note) {
  var cfg = teacher_();
  if (!cfg.classes[cid]) throw new Error('No such class.');
  var have = {};
  cfg.assignments.forEach(function (a) { if (a.class_id === cid) have[a.lesson_id] = 1; });
  var added = 0;
  (lessonIds || []).forEach(function (lid) {
    if (!DATA.lessons[lid] || have[lid]) return;
    cfg.assignments.push({ id: String(nextId_(cfg)), class_id: cid, lesson_id: lid, due: dateOrEmpty_(due),
                           note: String(note || '').slice(0, 500), branch: null, created_at: now_() });
    added++;
  });
  saveConfig_(cfg);
  return { added: added };
}

/** The Sprint trunk, then one branch or a choice of all three (choice branches only count once started). */
function assignSprint(cid, choice, due, note) {
  var cfg = teacher_();
  if (!cfg.classes[cid]) throw new Error('No such class.');
  if (choice !== 'choice' && !DATA.sprint.branches[choice]) throw new Error('Pick a branch.');
  if (!dateOrEmpty_(due)) throw new Error('Pick a due date for the Sprint.');
  var wanted = DATA.sprint.trunk.map(function (l) { return [l, null]; });
  if (choice === 'choice') Object.keys(DATA.sprint.branches).forEach(function (b) { DATA.sprint.branches[b].forEach(function (l) { wanted.push([l, b]); }); });
  else DATA.sprint.branches[choice].forEach(function (l) { wanted.push([l, null]); });
  var existing = {};
  cfg.assignments.forEach(function (a) { if (a.class_id === cid) existing[a.lesson_id] = a; });
  var added = 0;
  wanted.forEach(function (w) {
    if (!DATA.lessons[w[0]]) return;
    if (existing[w[0]]) { existing[w[0]].due = due; existing[w[0]].branch = w[1]; return; }
    cfg.assignments.push({ id: String(nextId_(cfg)), class_id: cid, lesson_id: w[0], due: due,
                           note: String(note || '').slice(0, 500), branch: w[1], created_at: now_() });
    added++;
  });
  saveConfig_(cfg);
  return { added: added };
}

function updateAssignment(aid, due, note, remove) {
  var cfg = teacher_();
  var a = cfg.assignments.filter(function (x) { return x.id === aid; })[0];
  if (!a) throw new Error('No such assignment.');
  if (remove) cfg.assignments = cfg.assignments.filter(function (x) { return x.id !== aid; });
  else { a.due = dateOrEmpty_(due); a.note = String(note || '').slice(0, 500); }
  saveConfig_(cfg);
  return { ok: true };
}

function removeStudent(cid, email) {
  var cfg = teacher_();
  cfg.removed[cid] = cfg.removed[cid] || [];
  if (cfg.removed[cid].indexOf(email) < 0) cfg.removed[cid].push(email);
  saveConfig_(cfg);
  return { ok: true };
}

function saveFeedback(email, lid, text) {
  var cfg = teacher_();
  cfg.feedback[email] = cfg.feedback[email] || {};
  cfg.feedback[email][lid] = String(text || '').trim().slice(0, 5000);
  saveConfig_(cfg);
  return { ok: true };
}

function giveBonus(email, amount, reason, badge) {
  var cfg = teacher_();
  amount = Math.max(0, Math.min(Math.floor(Number(amount) || 0), 200));
  reason = String(reason || '').trim().slice(0, 120) || 'Great work';
  if (amount) {
    cfg.bonuses[email] = cfg.bonuses[email] || [];
    cfg.bonuses[email].push({ key: 'bonus:' + now_(), amount: amount, reason: 'Bonus from your teacher: ' + reason, at: now_() });
  }
  if (badge) cfg.picks[email] = true;
  saveConfig_(cfg);
  return { ok: true, xp: amount };
}

/** Hide the Learn cards for a class when the teacher teaches that part live. */
function setSkipLearn(cid, skip) {
  var cfg = teacher_();
  if (!cfg.classes[cid]) throw new Error('No such class.');
  cfg.classes[cid].skip_learn = !!skip;
  saveConfig_(cfg);
  return { ok: true, skip_learn: !!skip };
}

function saveVideos(map) {
  var cfg = teacher_(), out = {};
  Object.keys(map || {}).forEach(function (lid) {
    var url = String(map[lid] || '').trim();
    if (DATA.lessons[lid] && /^https:\/\//.test(url)) out[lid] = url.slice(0, 500);
  });
  cfg.videos = out;
  saveConfig_(cfg);
  return { ok: true, count: Object.keys(out).length };
}

// ---------------------------------------------------------------- gradebook
/** Everyone in a class: students who joined with the code, plus the Google Classroom roster (even before they sign in). */
function classStudents_(cfg, sum, cid) {
  var removed = cfg.removed[cid] || [], roster = rosterOf_(cfg, cid), emails = {};
  Object.keys(sum.students).forEach(function (email) { if (sum.students[email].classes.indexOf(cid) >= 0) emails[email] = 1; });
  Object.keys(roster).forEach(function (email) { emails[email] = 1; });
  return Object.keys(emails).filter(function (email) { return removed.indexOf(email) < 0; }).map(function (email) {
    var s = sum.students[email];
    if (!s) return { email: email, name: roster[email] || email, xp: 0, level: 1, avatar: null, badges: [], lessons: {}, not_yet: true };
    return { email: email, name: roster[email] || s.name || email, xp: s.xp, level: levelInfo_(s.xp).level, avatar: s.avatar || null,
             badges: s.badges, lessons: s.lessons, rostered: email in roster };
  }).sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
}

function owesAssignment_(a, started) {
  return !a.branch || (DATA.sprint.branches[a.branch] || []).some(function (l) { return started[l]; });
}

function gradebookCell_(a, s) {
  var started = {};
  Object.keys(s.lessons).forEach(function (l) { started[l] = 1; });
  if (!owesAssignment_(a, started)) return { status: 'other-branch', pct: 0, late: false };
  var x = s.lessons[a.lesson_id];
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var status = !x ? 'not-started' : x.pct === 100 ? 'complete' : 'in-progress';
  return { status: status, pct: x ? x.pct : 0, quiz_best: x ? x.quiz_best : null, quiz_total: x ? x.quiz_total : 0,
           debug_solved: !!(x && x.debug_solved), challenge: !!(x && x.challenge), stars: x ? x.stars : 0,
           late: !!(a.due && a.due < today && status !== 'complete') };
}

function teacherHome() {
  var cfg = teacher_(), sum = summary_();
  return { classes: Object.keys(cfg.classes).map(function (cid) {
    var c = cfg.classes[cid];
    return { id: c.id, name: c.name, code: c.code, students: classStudents_(cfg, sum, cid).length, classroom: c.classroom || null,
             assignments: cfg.assignments.filter(function (a) { return a.class_id === cid; }).length };
  }) };
}

function gradebook(cid) {
  var cfg = teacher_(), c = cfg.classes[cid];
  if (!c) throw new Error('No such class.');
  var sum = summary_(), students = classStudents_(cfg, sum, cid);
  var cols = cfg.assignments.filter(function (a) { return a.class_id === cid && DATA.lessons[a.lesson_id]; }).map(function (a) {
    var L = DATA.lessons[a.lesson_id];
    return { id: a.id, lesson_id: L.id, number: L.number, title: L.title, due: a.due, note: a.note, branch: a.branch };
  });
  var grid = {};
  students.forEach(function (s) { cols.forEach(function (a) { grid[s.email + '|' + a.id] = gradebookCell_(a, s); }); });
  return { cls: c, cols: cols, students: students.map(function (s) {
             return { email: s.email, name: s.name, xp: s.xp, level: s.level, avatar: s.avatar, not_yet: !!s.not_yet };
           }), grid: grid,
           assigned: cols.map(function (a) { return a.lesson_id; }), url: ScriptApp.getService().getUrl() };
}

function studentDetail(cid, email) {
  var cfg = teacher_();
  if (!cfg.classes[cid]) throw new Error('No such class.');
  var rec = loadStudentFresh_(email);
  if (!rec && rosterOf_(cfg, cid)[email]) rec = newStudent_(email), rec.name = rosterOf_(cfg, cid)[email];
  if (!rec) throw new Error('No work saved for that student yet.');
  var assigned = {};
  cfg.assignments.forEach(function (a) { if (a.class_id === cid) assigned[a.lesson_id] = 1; });
  var items = lessonList_().filter(function (L) { return rec.progress[L.id] || assigned[L.id]; }).map(function (L) {
    var p = rec.progress[L.id] || null;
    return { id: L.id, number: L.number, title: L.title, assigned: !!assigned[L.id], pct: p ? percent_(p, L) : 0, p: p,
             feedback: ((cfg.feedback[email] || {})[L.id]) || '', stepped_count: L.stepped_count, has_debug: L.has_debug,
             learn_titles: (L.learn_checks || []).some(function (c) { return c; }) ? L.learn_titles : [] };
  });
  return { cls: cfg.classes[cid], student: { email: email, name: rec.name, xp: rec.xp || 0, level: levelInfo_(rec.xp || 0),
           avatar: avatarOf_(rec), badges: badgeList_(rec).filter(function (b) { return b.earned; }) }, items: items };
}

/** The teacher always reads a student's file from Drive, not a cached copy. */
function loadStudentFresh_(email) {
  var id = studentFileId_(email);
  if (!id) return null;
  try { return readJsonFile_(id); } catch (e) { return null; }
}

// ---------------------------------------------------------------- Google Classroom grades package
// Paste the result into the "Maker Lab to Google Classroom" sender (maker-lab-classroom.gs).
function classroomPackage(cid, how, lessonIds) {
  if (['complete', 'quiz', 'both'].indexOf(how) < 0) throw new Error('Pick how to score.');
  var gb = gradebook(cid), wanted = {};
  (lessonIds || []).forEach(function (l) { wanted[l] = 1; });
  var cols = gb.cols.filter(function (a) { return wanted[a.lesson_id]; });
  var students = gb.students.map(function (s, i) {
    var grades = {};
    cols.forEach(function (a) {
      var cell = gb.grid[s.email + '|' + a.id], score = null;
      if (cell && cell.status !== 'not-started' && cell.status !== 'other-branch') {
        var quiz = cell.quiz_total ? Math.round(100 * (cell.quiz_best || 0) / cell.quiz_total) : null;
        score = how === 'complete' ? cell.pct : how === 'quiz' ? quiz : (quiz === null ? null : Math.round((cell.pct + quiz) / 2));
      }
      if (score !== null) grades[a.lesson_id] = score;
    });
    return { ref: s.email, name: s.name, grades: grades };
  });
  return { source: 'microbit-maker-lab', version: 1, 'class': gb.cls.name, students: students,
           assignments: cols.map(function (a) { return { key: a.lesson_id, title: a.number + '. ' + a.title, due: a.due || '' }; }) };
}
