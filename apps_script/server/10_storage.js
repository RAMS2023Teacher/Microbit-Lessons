// ---------------------------------------------------------------- who is here
function whoIs_() {
  var email = '';
  try { email = (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { email = ''; }
  var owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  return { email: email, teacher: !!email && email === owner };
}

function now_() { return new Date().toISOString(); }

// ---------------------------------------------------------------- Drive folders
function folder_(key, name, parentFn) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(key);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ }
  }
  var f = parentFn ? parentFn().createFolder(name) : DriveApp.createFolder(name);
  props.setProperty(key, f.getId());
  return f;
}
function dataFolder_() { return folder_('folder:data', DATA_FOLDER, null); }
function studentFolder_() { return folder_('folder:students', 'students', dataFolder_); }

function readJsonFile_(id) {
  return JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
}

/** A JSON file in the data folder, found by a script property, made on first write. */
function readNamed_(key, fallback) {
  var id = PropertiesService.getScriptProperties().getProperty('file:' + key);
  if (!id) return fallback;
  try { return readJsonFile_(id); } catch (e) { return fallback; }
}
function writeNamed_(key, value) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('file:' + key);
  var text = JSON.stringify(value);
  if (id) {
    try { DriveApp.getFileById(id).setContent(text); return; } catch (e) { /* deleted: make a new one */ }
  }
  var f = dataFolder_().createFile(key + '.json', text, 'application/json');
  props.setProperty('file:' + key, f.getId());
}

// ---------------------------------------------------------------- teacher settings
// Only the teacher writes this file: classes, assignments, videos, feedback and bonus XP.
function emptyConfig_() {
  return { v: 1, classes: {}, assignments: [], videos: {}, feedback: {}, bonuses: {}, picks: {}, removed: {}, rosters: {}, next_id: 1 };
}
function config_() {
  var c = CacheService.getScriptCache().get('config');
  if (c) { var cached = JSON.parse(c); cached.rosters = cached.rosters || {}; return cached; }
  var cfg = readNamed_('config', null) || emptyConfig_();
  cfg.rosters = cfg.rosters || {};              // added with the Google Classroom import
  cacheConfig_(cfg);
  return cfg;
}
function cacheConfig_(cfg) {
  var text = JSON.stringify(cfg);
  if (text.length < 90000) CacheService.getScriptCache().put('config', text, 600);
  else CacheService.getScriptCache().remove('config');
}
function saveConfig_(cfg) {
  writeNamed_('config', cfg);
  cacheConfig_(cfg);
}
function nextId_(cfg) { var id = cfg.next_id || 1; cfg.next_id = id + 1; return id; }

/** Classes a student belongs to: joined with a code or on a Google Classroom roster, and not removed by the teacher. */
function studentClassIds_(rec, cfg) {
  var ids = (rec.classes || []).slice();
  Object.keys(cfg.rosters || {}).forEach(function (cid) { if (cfg.rosters[cid][rec.email] && ids.indexOf(cid) < 0) ids.push(cid); });
  return ids.filter(function (cid) {
    return cfg.classes[cid] && (cfg.removed[cid] || []).indexOf(rec.email) < 0;
  });
}

// ---------------------------------------------------------------- student files
function newStudent_(email) {
  return { v: 1, email: email, name: '', classes: [], xp: 0, avatar: null, badges: {}, xp_keys: {},
           xp_log: [], progress: {}, created_at: now_(), updated_at: now_() };
}
function studentFileId_(email) {
  return PropertiesService.getScriptProperties().getProperty('student:' + email);
}
function loadStudent_(email) {
  var cached = CacheService.getScriptCache().get('s:' + email);
  if (cached) return JSON.parse(cached);
  var id = studentFileId_(email);
  if (!id) return null;
  try { return readJsonFile_(id); } catch (e) { return null; }
}
function saveStudent_(rec) {
  rec.updated_at = now_();
  var text = JSON.stringify(rec);
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('student:' + rec.email);
  var saved = false;
  if (id) {
    try { DriveApp.getFileById(id).setContent(text); saved = true; } catch (e) { /* deleted: make a new one */ }
  }
  if (!saved) {
    var name = 'student-' + rec.email.replace(/[^a-z0-9._-]/g, '_') + '.json';
    props.setProperty('student:' + rec.email, studentFolder_().createFile(name, text, 'application/json').getId());
  }
  if (text.length < 90000) CacheService.getScriptCache().put('s:' + rec.email, text, 600);
  else CacheService.getScriptCache().remove('s:' + rec.email);
}

// ---------------------------------------------------------------- gradebook summary
// One small record per student, rebuilt from files that changed since the last look.
function summary_() {
  var s = readNamed_('summary', null) || { built_ms: 0, students: {} };
  if (Date.now() - (s.built_ms || 0) < SUMMARY_MAX_AGE_MS) return s;
  var since = (s.built_ms || 0) - 120000;       // overlap a little, Drive times are rounded
  var started = Date.now();
  var props = PropertiesService.getScriptProperties().getProperties();
  var byId = {};
  Object.keys(props).forEach(function (k) { if (k.indexOf('student:') === 0) byId[props[k]] = k.slice(8); });
  // Walk the folder instead of using a Drive search query (real Drive rejected the query: "Invalid argument: q").
  var it = studentFolder_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var email = byId[f.getId()];
    if (!email || f.getLastUpdated().getTime() <= since) continue;
    try { s.students[email] = studentSummary_(JSON.parse(f.getBlob().getDataAsString())); } catch (e) { /* skip a bad file */ }
  }
  s.built_ms = started;
  writeNamed_('summary', s);
  return s;
}

function studentSummary_(rec) {
  var lessons = {};
  Object.keys(rec.progress || {}).forEach(function (lid) {
    var L = DATA.lessons[lid];
    if (!L) return;
    var p = rec.progress[lid];
    lessons[lid] = { pct: percent_(p, L), quiz_best: p.quiz_best == null ? null : p.quiz_best, quiz_total: p.quiz_total || 0,
                     debug_solved: !!p.debug_solved, challenge: !!p.challenge_submitted_at, stars: lessonStars_(L, p),
                     completed_at: p.completed_at || null, updated_at: p.updated_at || null, partner: p.partner || null };
  });
  return { name: rec.name, classes: rec.classes || [], xp: rec.xp || 0, avatar: rec.avatar || null,
           badges: Object.keys(rec.badges || {}), lessons: lessons, updated_at: rec.updated_at, wins: recentWins_(rec) };
}

/** A student's last few wins for the class display: badges, finished lessons, perfect quizzes, teacher bonuses. */
function winKind_(e) {
  var key = e.key || '', r = e.reason || '';
  if (key.indexOf('badge:') === 0 || (!key && r.indexOf('Badge: ') === 0)) return 'badge';
  if (key.indexOf('complete:') === 0 || (!key && r.indexOf(DATA.section_labels.complete + ' · ') === 0)) return 'complete';
  if (key.indexOf('quiz_perfect:') === 0 || (!key && r.indexOf(DATA.section_labels.quiz_perfect + ' · ') === 0)) return 'quiz_perfect';
  if (key.indexOf('bonus:') === 0 || (!key && r.indexOf('Bonus from your teacher') === 0)) return 'bonus';
  return null;
}
function recentWins_(rec) {
  return (rec.xp_log || []).filter(winKind_).slice(0, 5).map(function (e) {
    return { kind: winKind_(e), reason: e.reason, at: e.at };
  });
}
