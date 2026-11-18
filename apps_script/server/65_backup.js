// ---------------------------------------------------------------- daily backups and the owner's "Your data" card
// Once a day, every student record and the settings go into one dated JSON file in "Maker Lab data/backups"
// ("Maker Lab Backup 2026-11-18.json"). Reading every student takes a while, so the backup is built a few students
// at a time while the teacher uses Maker Lab (teacher pages and the class display), never inside the lock and never
// while a student waits. "Back up now" finishes it in one go. The last 8 backups are kept.

var BACKUPS_KEPT_ = 8;

function backupDay_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function backupList_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('backup:list') || '[]'); } catch (e) { return []; }
}

/** Add up to `budgetMs` of students to today's backup. Safe to call often; a backup problem never breaks a page. */
function backupStep_(budgetMs) {
  var props = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  try {
    var day = backupDay_(), st = JSON.parse(props.getProperty('backup:state') || '{}');
    if (st.day === day && st.done && !st.redo) return st;
    if (cache.get('backup:running')) return st;                       // another request is working on it
    cache.put('backup:running', '1', 60);
    if (st.day !== day) st = { day: day, i: 0, done: false, file: null };
    if (st.redo) st = { day: day, i: 0, done: false, file: st.file };          // "Back up now": start today's over, same file
    var emails = Object.keys(props.getProperties()).filter(function (k) { return k.indexOf('student:') === 0; })
      .map(function (k) { return k.slice(8); }).sort();
    var data = st.file && st.i > 0 ? readJsonFile_(st.file) : { app: 'Maker Lab', day: day, made_at: now_(), config: readNamed_('config', null), students: {} };
    var t0 = Date.now();
    while (st.i < emails.length && Date.now() - t0 < budgetMs) {
      var id = props.getProperty('student:' + emails[st.i]);
      if (id) data.students[emails[st.i]] = readJsonFile_(id);
      st.i++;
    }
    st.done = st.i >= emails.length;
    data.complete = st.done;
    data.count = Object.keys(data.students).length;
    var text = JSON.stringify(data);
    if (st.file) retry_(function () { DriveApp.getFileById(st.file).setContent(text); });
    else st.file = backupFolder_().createFile('Maker Lab Backup ' + day + '.json', text, 'application/json').getId();
    if (st.done) {
      var list = backupList_().filter(function (b) { return b.id !== st.file; });
      list.push({ id: st.file, day: day, students: data.count });
      while (list.length > BACKUPS_KEPT_) {
        var old = list.shift();
        try { DriveApp.getFileById(old.id).setTrashed(true); } catch (e) { /* already gone */ }
      }
      props.setProperty('backup:list', JSON.stringify(list));
    }
    props.setProperty('backup:state', JSON.stringify(st));
    cache.remove('backup:running');
    return st;
  } catch (e) {
    cache.remove('backup:running');
    console.warn('Backup step failed (nothing lost): ' + ((e && e.message) || e));
    return null;
  }
}

/** Owner: make today's backup again from scratch, now (it replaces today's file, so there's still one per day). */
function backupNow() {
  teacher_();
  var props = PropertiesService.getScriptProperties(), st = {};
  try { st = JSON.parse(props.getProperty('backup:state') || '{}'); } catch (e) { st = {}; }
  if (st.day === backupDay_()) { st.redo = true; props.setProperty('backup:state', JSON.stringify(st)); }
  CacheService.getScriptCache().remove('backup:running');
  var st = null;
  for (var k = 0; k < 6; k++) { st = backupStep_(4000); if (!st || st.done) break; }
  return dataInfo();
}

/** Owner: where the data lives, how much there is, the backups, and any other "Maker Lab data" folders in Drive. */
function dataInfo() {
  teacher_();
  var props = PropertiesService.getScriptProperties(), all = props.getProperties(), cfg = config_();
  var folderId = all['folder:data'] || '', folder = null, others = [];
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; } }
  try {
    var it = DriveApp.getFoldersByName(DATA_FOLDER);
    while (it.hasNext() && others.length < 10) { var f = it.next(); if (f.getId() !== folderId) others.push({ id: f.getId(), url: f.getUrl() }); }
  } catch (e) { /* Drive search unavailable: skip */ }
  var history = [];
  try { history = JSON.parse(all['storage:history'] || '[]'); } catch (e) { history = []; }
  var st = {};
  try { st = JSON.parse(all['backup:state'] || '{}'); } catch (e) { st = {}; }
  return {
    folder: folder ? { id: folderId, url: folder.getUrl(), name: folder.getName() } : { id: folderId, missing: !!folderId },
    students: Object.keys(all).filter(function (k) { return k.indexOf('student:') === 0; }).length,
    classes: Object.keys(cfg.classes).length,
    backups: backupList_().map(function (b) {
      var url = '';
      try { url = DriveApp.getFileById(b.id).getUrl(); } catch (e) { url = ''; }
      return { day: b.day, students: b.students, url: url };
    }).reverse(),
    today: st.day === backupDay_() ? { done: !!st.done, students: st.i || 0 } : null,
    others: others, history: history.slice(-10).reverse(),
  };
}
