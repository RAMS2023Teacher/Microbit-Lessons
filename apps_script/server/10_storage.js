// ---------------------------------------------------------------- who is here
function whoIs_() {
  var email = '';
  try { email = (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { email = ''; }
  var owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  return { email: email, teacher: !!email && email === owner };
}

function now_() { return new Date().toISOString(); }

// ---------------------------------------------------------------- reliability (docs/RELIABILITY.md)
// An error from Google means "try again", never "it's missing". Storage (folders, files) is only ever created when
// no id has EVER been saved for it, inside a lock, and a failed read is never replaced by a blank record.
var BUSY_MSG_ = 'BUSY: Maker Lab is very busy right now. Your work is safe. Trying again...';
function busy_() { var e = new Error(BUSY_MSG_); e.status = 503; return e; }

/** Run a Google call, trying again a few times. If it keeps failing, throw BUSY (the browser will retry). */
function retry_(fn) {
  for (var i = 0; i < 4; i++) {
    try { return fn(); } catch (e) {
      if (i === 3) { console.warn('Google call failed: ' + ((e && e.message) || e)); throw busy_(); }
      Utilities.sleep(250 * (i + 1));
    }
  }
}

/** Take turns for read-change-write of shared things. Keep it short: nothing slow inside. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { throw busy_(); }
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Every storage id ever set, so the right folder or file can always be found again. */
function rememberStorage_(key, id) {
  var props = PropertiesService.getScriptProperties(), list = [];
  try { list = JSON.parse(props.getProperty('storage:history') || '[]'); } catch (e) { list = []; }
  list.push({ key: key, id: id, at: now_() });
  props.setProperty('storage:history', JSON.stringify(list.slice(-40)));
}

// ---------------------------------------------------------------- Drive folders
function folder_(key, name, parentFn) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(key);
  if (id) return retry_(function () { return DriveApp.getFolderById(id); });   // can't open it now: BUSY, never a new one
  var parent = parentFn ? parentFn() : null;                                     // outside the lock (it may need its own)
  return withLock_(function () {
    var again = props.getProperty(key);                                          // another first visitor may have made it
    if (again) return retry_(function () { return DriveApp.getFolderById(again); });
    var f = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
    props.setProperty(key, f.getId());
    rememberStorage_(key, f.getId());
    return f;
  });
}
function dataFolder_() { return folder_('folder:data', DATA_FOLDER, null); }
function studentFolder_() { return folder_('folder:students', 'students', dataFolder_); }
function backupFolder_() { return folder_('folder:backups', 'backups', dataFolder_); }

/** A saved JSON file. Throws BUSY if Drive fails; throws (never returns {}) if the file is damaged. */
function readJsonFile_(id) {
  var text = retry_(function () { return DriveApp.getFileById(id).getBlob().getDataAsString(); });
  try { return JSON.parse(text); } catch (e) { throw new Error('A Maker Lab data file is damaged (' + id + '). Nothing was changed. Ask Claude to look at it.'); }
}

/** A JSON file in the data folder, found by a script property. `fallback` only when it has never been made. */
function readNamed_(key, fallback) {
  var id = PropertiesService.getScriptProperties().getProperty('file:' + key);
  if (!id) return fallback;
  return readJsonFile_(id);
}
function writeNamed_(key, value) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('file:' + key), text = JSON.stringify(value);
  if (id) { retry_(function () { DriveApp.getFileById(id).setContent(text); }); return; }
  var folder = dataFolder_();
  withLock_(function () {
    var again = props.getProperty('file:' + key);
    if (again) { retry_(function () { DriveApp.getFileById(again).setContent(text); }); return; }
    var f = folder.createFile(key + '.json', text, 'application/json');
    props.setProperty('file:' + key, f.getId());
    rememberStorage_('file:' + key, f.getId());
  });
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
/** A student's record. null ONLY when they have never had one (not joined). A read error throws BUSY. */
function loadStudent_(email) {
  var cached = CacheService.getScriptCache().get('s:' + email);
  if (cached) return JSON.parse(cached);
  var id = studentFileId_(email);
  if (!id) return null;
  return readJsonFile_(id);
}
function saveStudent_(rec) {
  rec.updated_at = now_();
  var text = JSON.stringify(rec);
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('student:' + rec.email);
  if (id) retry_(function () { DriveApp.getFileById(id).setContent(text); });       // fails: BUSY, never a second file
  else {
    var folder = studentFolder_();
    withLock_(function () {                                                         // first save of a new student
      var again = props.getProperty('student:' + rec.email);
      if (again) { retry_(function () { DriveApp.getFileById(again).setContent(text); }); return; }
      var name = 'student-' + rec.email.replace(/[^a-z0-9._-]/g, '_') + '.json';
      props.setProperty('student:' + rec.email, folder.createFile(name, text, 'application/json').getId());
    });
  }
  if (text.length < 90000) CacheService.getScriptCache().put('s:' + rec.email, text, 600);
  else CacheService.getScriptCache().remove('s:' + rec.email);
}

// ---------------------------------------------------------------- gradebook summary
// One small record per student, rebuilt from files that changed since the last look.
// The whole class opens the same views at once, so the summary is shared through the cache for a few seconds,
// and only one request at a time rebuilds it (the others use the copy they have).
function summary_(fresh) {
  var cache = CacheService.getScriptCache(), hit = !fresh && cache.get('summary');
  if (hit) return JSON.parse(hit);
  var s = readNamed_('summary', null) || { built_ms: 0, students: {} };
  if (!fresh && Date.now() - (s.built_ms || 0) < SUMMARY_MAX_AGE_MS) { cacheSummary_(s); return s; }
  if (!fresh && s.built_ms && cache.get('summary:building')) return s;         // someone else is rebuilding it
  cache.put('summary:building', '1', 30);
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
  cacheSummary_(s);
  cache.remove('summary:building');
  return s;
}
function cacheSummary_(s) {
  try { var t = JSON.stringify(s); if (t.length < 95000) CacheService.getScriptCache().put('summary', t, 20); } catch (e) { /* too big to share: fine */ }
}

function studentSummary_(rec) {
  var lessons = {};
  Object.keys(rec.progress || {}).forEach(function (lid) {
    var L = DATA.lessons[lid];
    if (!L) return;
    var p = rec.progress[lid];
    lessons[lid] = { pct: percent_(p, L), stage: currentStage_(L, p), stages: stagesDone_(L, p),
                     steps_done: stepsDone_(L, p), steps_total: L.build.length,
                     quiz_best: p.quiz_best == null ? null : p.quiz_best, quiz_total: p.quiz_total || 0,
                     shipped: !!p.shipped_at, share: p.share || '', stars: lessonStars_(L, p),
                     completed_at: p.completed_at || null, updated_at: p.updated_at || null, partner: p.partner || null,
                     review: reviewStatus_(p), submitted_at: (p.review && p.review.submitted_at) || p.shipped_at || null, round: (p.review && p.review.round) || null };
  });
  return { name: rec.name, classes: rec.classes || [], xp: rec.xp || 0, avatar: rec.avatar ? avatarOf_(rec) : null,
           badges: Object.keys(rec.badges || {}), lessons: lessons, updated_at: rec.updated_at, wins: recentWins_(rec),
           xp_recent: recentXp_(rec), fb: fbSummary_(rec),
           arcade: rec.arcade ? { best: rec.arcade.best || 0, day: rec.arcade.day || '', day_best: rec.arcade.day_best || 0, games: rec.arcade.games || null } : null };
}

/** XP earned in the last day and a half, as [time, amount] pairs: the class display adds up today's for the class goal. */
function recentXp_(rec) {
  var since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  return (rec.xp_log || []).filter(function (e) { return e.at >= since && e.amount > 0; }).map(function (e) { return [e.at, e.amount]; });
}

/** A student's last few wins for the class display: badges, finished lessons, perfect quizzes, teacher bonuses. */
function winKind_(e) {
  var key = e.key || '', r = e.reason || '';
  if (key.indexOf('badge:') === 0 || (!key && r.indexOf('Badge: ') === 0)) return 'badge';
  if (key.indexOf('complete:') === 0) return 'complete';
  if (key.indexOf('ship:') === 0) return 'ship';
  if (key.indexOf('quiz_perfect:') === 0) return 'quiz_perfect';
  if (key.indexOf('bonus:') === 0 || (!key && r.indexOf('Bonus from your teacher') === 0)) return 'bonus';
  return null;
}
function recentWins_(rec) {
  return (rec.xp_log || []).filter(winKind_).slice(0, 5).map(function (e) {
    return { kind: winKind_(e), reason: e.reason, at: e.at };
  });
}
