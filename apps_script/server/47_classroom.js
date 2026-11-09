// ---------------------------------------------------------------- Google Classroom: import classes and rosters
// Uses the Google Classroom advanced service (appsscript.json "dependencies"), read-only, as the teacher.
// A linked class keeps its roster in config.json (cfg.rosters[cid] = { email: name }), so students on it
// are in the class the first time they open Maker Lab: no join code, and their Classroom name is used.

function classroomApi_() {
  if (typeof Classroom === 'undefined' || !Classroom.Courses) {
    throw new Error('The Google Classroom service is not turned on. Replace appsscript.json with the one in INSTALL.md, ' +
      'save, then run checkInstall once to allow access.');
  }
  return Classroom;
}

function classroomCoursesRaw_() {
  var api = classroomApi_(), out = [], token = null;
  do {
    var r = api.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100, pageToken: token || undefined });
    (r.courses || []).forEach(function (c) { out.push(c); });
    token = r.nextPageToken;
  } while (token);
  return out;
}

/** { students: { email: name }, missing: number of students whose email Classroom didn't share } */
function classroomRoster_(courseId) {
  var api = classroomApi_(), students = {}, missing = 0, token = null;
  do {
    var r = api.Courses.Students.list(courseId, { pageSize: 100, pageToken: token || undefined });
    (r.students || []).forEach(function (s) {
      var p = s.profile || {}, email = String(p.emailAddress || '').trim().toLowerCase();
      var name = String((p.name && (p.name.fullName || [p.name.givenName, p.name.familyName].join(' '))) || '').trim();
      if (email) students[email] = name.slice(0, 40) || email;
      else missing++;
    });
    token = r.nextPageToken;
  } while (token);
  return { students: students, missing: missing };
}

function rosterOf_(cfg, cid) { return (cfg.rosters || {})[cid] || {}; }

/** The import page: your active Classroom courses and which Maker Lab class each is linked to. */
function classroomCourses() {
  var cfg = teacher_(), linked = {};
  Object.keys(cfg.classes).forEach(function (cid) {
    var g = cfg.classes[cid].classroom;
    if (g) linked[g.id] = cid;
  });
  var courses = classroomCoursesRaw_().map(function (c) {
    return { id: c.id, name: c.name || 'Untitled class', section: c.section || '', link: c.alternateLink || '', linked: linked[c.id] || null };
  });
  return { courses: courses, classes: Object.keys(cfg.classes).map(function (cid) { return { id: cid, name: cfg.classes[cid].name }; }) };
}

/** choices: [{ course_id, target: 'new' | a class id }]. Makes or links each class, then copies its roster. */
function importClassroom(choices) {
  var cfg = teacher_(), byId = {}, results = [];
  classroomCoursesRaw_().forEach(function (c) { byId[c.id] = c; });
  (choices || []).forEach(function (ch) {
    var c = byId[ch && ch.course_id];
    if (!c) return;
    var cid = ch.target === 'new' ? null : String(ch.target || '');
    if (cid && !cfg.classes[cid]) return;
    Object.keys(cfg.classes).forEach(function (k) {   // a course links to one class at a time
      var g = cfg.classes[k].classroom;
      if (g && g.id === c.id && k !== cid) { delete cfg.classes[k].classroom; delete cfg.rosters[k]; }
    });
    if (!cid) {
      cid = String(nextId_(cfg));
      var name = (c.name + (c.section ? ' (' + c.section + ')' : '')).slice(0, 80);
      cfg.classes[cid] = { id: cid, name: name, code: joinCode_(cfg), created_at: now_() };
    }
    cfg.classes[cid].classroom = { id: c.id, name: c.name || '', section: c.section || '', link: c.alternateLink || '' };
    results.push(syncInto_(cfg, cid));
  });
  saveConfig_(cfg);
  return { classes: results };
}

function syncInto_(cfg, cid) {
  var cls = cfg.classes[cid], before = rosterOf_(cfg, cid), r = classroomRoster_(cls.classroom.id);
  cfg.rosters = cfg.rosters || {};
  cfg.rosters[cid] = r.students;
  cls.classroom.synced_at = now_();
  cls.classroom.missing = r.missing;
  var added = Object.keys(r.students).filter(function (e) { return !(e in before); }).length;
  var left = Object.keys(before).filter(function (e) { return !(e in r.students); }).length;
  return { id: cid, name: cls.name, students: Object.keys(r.students).length, added: added, left: left, missing: r.missing };
}

/** Copies the class's roster from Google Classroom again (new students in, students who left out). */
function syncClassroom(cid) {
  var cfg = teacher_(), cls = cfg.classes[cid];
  if (!cls) throw new Error('No such class.');
  if (!cls.classroom) throw new Error('This class is not linked to Google Classroom.');
  var out = syncInto_(cfg, cid);
  saveConfig_(cfg);
  return out;
}

/** Re-copies every linked class's roster. */
function syncAllClassroom() {
  var cfg = teacher_(), out = [];
  Object.keys(cfg.classes).forEach(function (cid) {
    if (!cfg.classes[cid].classroom) return;
    try { out.push(syncInto_(cfg, cid)); } catch (e) { out.push({ id: cid, name: cfg.classes[cid].name, error: e.message }); }
  });
  saveConfig_(cfg);
  return { classes: out };
}

function unlinkClassroom(cid) {
  var cfg = teacher_(), cls = cfg.classes[cid];
  if (!cls) throw new Error('No such class.');
  delete cls.classroom;
  if (cfg.rosters) delete cfg.rosters[cid];
  saveConfig_(cfg);
  return { ok: true };
}

/** The Classroom name for a student, if any linked class has them on its roster. */
function rosterName_(cfg, email) {
  var rosters = cfg.rosters || {};
  for (var cid in rosters) if (cfg.classes[cid] && rosters[cid][email]) return rosters[cid][email];
  return '';
}
