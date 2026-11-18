// ---------------------------------------------------------------- pages
// Every page is one doGet: ?p=/lessons/dodge-the-drop. The server sends data; client/pages.js and
// client/lesson.js draw the page in the browser.

function doGet(e) {
  var problems = installProblems_();
  if (problems.length) return plainPage_('Maker Lab needs a fix', '<h1>Maker Lab isn\'t installed correctly yet</h1><ul><li>' +
    problems.map(escapeHtml_).join('</li><li>') + '</li></ul><p>Fix the files above in the Apps Script editor, save, then deploy a ' +
    '<b>new version</b> (Deploy → Manage deployments → ✏️ → Version: New version). The steps are in INSTALL.md.</p>');
  var me = whoIs_();
  var path = String((e && e.parameter && e.parameter.p) || '/');
  var page;
  try {
    if (!me.email) page = { name: 'error', title: 'Sign in', data: { message: 'Open Maker Lab while signed in to your school Google account.' } };
    else page = me.teacher ? teacherPage_(path) : studentPage_(me, path);
  } catch (err) {
    page = { name: 'error', title: 'Problem', data: { message: (err && err.message) || 'Something went wrong.' } };
  }
  page.path = path;
  return render_(me, page);
}

function studentPage_(me, path) {
  var rec = loadStudent_(me.email), cfg = config_();
  var listed = rosterName_(cfg, me.email);
  if (listed && (!rec || !rec.name)) {          // on a Google Classroom roster: no join page, use the Classroom name
    rec = rec || newStudent_(me.email);
    rec.name = listed;
    saveStudent_(rec);
  }
  if (!rec || !rec.name || !studentClassIds_(rec, cfg).length) return { name: 'join', title: 'Join your class', data: { name: rec ? rec.name : '' } };
  var rewards = syncRewards_(rec, cfg);
  if (rewards.xp_gained) saveStudent_(rec);
  var level = levelInfo_(rec.xp || 0), base = { level: level, avatar: avatarOf_(rec), rewards: rewards, name: rec.name,
                                                arcade_state: arcadeState_(rec, cfg), spendable: spendable_(rec),
                                                course: courseOf_(rec, cfg), editor: DATA.courses[courseOf_(rec, cfg)].editor };
  var m;
  if (path === '/' || path === '/dashboard') return { name: 'dashboard', title: 'Home', data: merge_(base, dashboardData_(rec, cfg)) };
  if (path === '/lessons') return { name: 'catalog', title: 'Lessons', data: merge_(base, catalogData_(rec, courseOf_(rec, cfg))) };
  if (path === '/map') return { name: 'map', title: 'Skill tree', data: merge_(base, { map: mapData_(rec, assignedIds_(rec, cfg), courseOf_(rec, cfg)) }) };
  if (path === '/me') return { name: 'profile', title: 'My robot', data: merge_(base, profileData_(rec, courseOf_(rec, cfg))) };
  if (path === '/arcade') return { name: 'arcade', title: 'Robot Rush', data: merge_(base, arcadeData_(rec, cfg, false)) };
  if (path === '/help') return { name: 'help', title: 'MakeCode help', data: merge_(base, { makecode: DATA.makecode_url }) };
  if ((m = /^\/lessons\/([\w-]+)$/.exec(path))) return lessonPage_(m[1], rec, cfg, base, false);
  return { name: 'error', title: 'Not found', data: { message: "We couldn't find that page." } };
}

function teacherPage_(path) {
  var cfg = config_(), m, base = { teacher: true };
  if (path === '/' || path === '/teacher') return { name: 'teacher-home', title: 'My classes', data: merge_(base, merge_(teacherHome(), {
    tab_icons: TAB_ICONS_.map(function (t) { return { id: t[0], label: t[2] }; }), tab_icon: cfg.tab_icon || 'logo', tab_icon_url: faviconUrl_(),
    logo_refused: !!PropertiesService.getScriptProperties().getProperty('logo:refused') })) };
  if ((m = /^\/teacher\/classes\/(\w+)$/.exec(path))) return { name: 'classroom', title: 'Class', data: merge_(base, merge_(gradebook(m[1]), { course: courseCards_(null, courseOfClass_(cfg, m[1])),
    grade: courseOfClass_(cfg, m[1]), grades: DATA.course_ids.map(function (g) { return { id: g, name: DATA.courses[g].name }; }), arcade: arcadeTeacher_(cfg, m[1]) })) };
  if ((m = /^\/teacher\/classes\/(\w+)\/students\/(.+)$/.exec(path))) return { name: 'student', title: 'Student', data: merge_(base, studentDetail(m[1], decodeURIComponent(m[2]))) };
  if (path === '/teacher/google-import') return { name: 'gc-import', title: 'Import from Google Classroom', data: merge_(base, classroomImportData_()) };
  if ((m = /^\/teacher\/classes\/(\w+)\/screen$/.exec(path))) {
    if (!cfg.classes[m[1]]) throw new Error('No such class.');
    return { name: 'screen', title: 'Class display', bodyClass: 'screen-page', mainClass: 'screen-main',
             data: merge_(base, { cls: { id: m[1], name: cfg.classes[m[1]].name }, units: screenUnits_(courseOfClass_(cfg, m[1])) }) };
  }
  if ((m = /^\/teacher\/classes\/(\w+)\/google-classroom$/.exec(path))) return { name: 'google', title: 'Google Classroom', data: merge_(base, gradebook(m[1])) };
  if (path === '/arcade') return { name: 'arcade', title: 'Robot Rush', data: merge_(base, merge_(arcadeData_(null, cfg, true), { avatar: DATA.default_avatar })) };
  if (path === '/teacher/standards') return { name: 'standards', title: 'Standards', data: merge_(base, standardsData_()) };
  if (path === '/teacher/videos') return { name: 'videos', title: 'Videos', data: merge_(base, { courses: allCourses_(), urls: cfg.videos }) };
  if (path === '/lessons') return { name: 'catalog', title: 'Lessons', data: merge_(base, { courses: allCourses_() }) };
  if (path === '/help') return { name: 'help', title: 'MakeCode help', data: merge_(base, { makecode: DATA.makecode_url }) };
  if ((m = /^\/map(?:\/(\w+))?$/.exec(path))) {
    var map = mapData_(null, {}, DATA.courses[m[1]] ? m[1] : DATA.default_course);
    map.courses = DATA.course_ids.map(function (g) { return { id: g, name: DATA.courses[g].short }; });
    map.nodes.forEach(function (n) { if (!n.soon) n.state = 'open'; });
    return { name: 'map', title: 'Skill tree', data: merge_(base, { map: map }) };
  }
  if ((m = /^\/lessons\/([\w-]+)$/.exec(path))) return lessonPage_(m[1], null, cfg, base, true);
  return { name: 'error', title: 'Not found', data: { message: "We couldn't find that page." } };
}

function classroomImportData_() {
  try { return classroomCourses(); } catch (e) { return { courses: [], classes: [], problem: e.message }; }
}

function merge_(a, b) {
  var out = {};
  Object.keys(a).forEach(function (k) { out[k] = a[k]; });
  Object.keys(b).forEach(function (k) { out[k] = b[k]; });
  return out;
}

/** Every lesson in the course plan, written or not ("soon"), with the student's progress. */
function courseCards_(rec, cid) {
  return DATA.courses[cid || DATA.default_course].plan.map(function (c) {
    var L = DATA.lessons[c.id], p = rec && L ? rec.progress[c.id] : null;
    return { id: c.id, course: c.course, number: c.number, title: c.title, icon: c.icon, color: c.color, python: c.python, hardware: c.hardware,
             tagline: L ? L.tagline : '', minutes: L ? L.minutes : 0, soon: !L,
             pct: L && p ? percent_(p, L) : 0, stage: L ? currentStage_(L, p) : 'mission', stars: L ? lessonStars_(L, p) : 0 };
  });
}

function catalogData_(rec, cid) { return { course: courseCards_(rec, cid), course_name: DATA.courses[cid].name }; }
/** The teacher sees every course. */
function allCourses_() {
  return DATA.course_ids.map(function (cid) { return { id: cid, name: DATA.courses[cid].name, short: DATA.courses[cid].short, cards: courseCards_(null, cid) }; });
}

function stageName_(stage) {
  var st = STAGES_.filter(function (s) { return s[0] === stage; })[0];
  return st ? st[1] : 'Done';
}

function dashboardData_(rec, cfg) {
  var classes = studentClassIds_(rec, cfg), cid = courseOf_(rec, cfg), cards = courseCards_(rec, cid), byId = {};
  cards.forEach(function (c) { byId[c.id] = c; });
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var rows = cfg.assignments.filter(function (a) { return classes.indexOf(a.class_id) >= 0 && DATA.lessons[a.lesson_id] && byId[a.lesson_id]; })
    .sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0; })
    .map(function (a) {
      var c = byId[a.lesson_id];
      return { lesson: c, class_name: cfg.classes[a.class_id].name, due: a.due, note: a.note, pct: c.pct,
               overdue: !!(a.due && a.due < today && c.pct < 100), feedback: !!((cfg.feedback[rec.email] || {})[a.lesson_id]) };
    });
  var done = cards.filter(function (c) { return !c.soon && c.pct === 100; }).length;
  return { rows: rows, next_up: nextUp_(rec, rows, cards), badges: badgeList_(rec, cid), done: done, course_name: DATA.courses[cid].name,
           total: cards.length, classes: classes.map(function (c) { return cfg.classes[c].name; }) };
}

/** One clear thing to do: the lesson they were last working on, else the next assignment, else the next lesson. */
function nextUp_(rec, rows, cards) {
  var pick = function (verb, c) { return { verb: verb, lesson: c, stage: stageName_(c.stage) }; };
  var started = Object.keys(rec.progress).filter(function (l) { return DATA.lessons[l]; })
    .sort(function (a, b) { return String(rec.progress[b].updated_at || '').localeCompare(String(rec.progress[a].updated_at || '')); });
  var byId = {};
  cards.forEach(function (c) { byId[c.id] = c; });
  for (var i = 0; i < started.length; i++) if (byId[started[i]] && byId[started[i]].pct < 100) return pick('Keep going', byId[started[i]]);
  for (var j = 0; j < rows.length; j++) if (rows[j].pct < 100) return pick('Start', rows[j].lesson);
  for (var k = 0; k < cards.length; k++) if (!cards[k].soon && cards[k].pct < 100) return pick('Start', cards[k]);
  return null;
}

function profileData_(rec, cid) {
  return { badges: badgeList_(rec, cid), history: rec.xp_log || [], catalog: avatarCatalog_(rec, false),
           parts: DATA.avatar_parts, levels: DATA.levels, xp_table: DATA.xp, xp_labels: DATA.labels };
}

/** The lesson as the browser gets it: no quiz answers (they're checked on the server). */
function publicLesson_(L) {
  var v = JSON.parse(JSON.stringify(L));
  v.quiz = L.quiz.map(function (q) { return { question: q.question, choices: q.choices }; });
  delete v.teacher_notes;
  return v;
}

function lessonPage_(lid, rec, cfg, base, teacher) {
  var L = DATA.lessons[lid];
  var c = DATA.course_by_id[lid];
  if (L && rec && !teacher && L.course !== courseOf_(rec, cfg))
    return { name: 'error', title: 'Another grade', data: merge_(base, { message: '"' + L.title + '" is a lesson for another grade. Find your lessons on the Lessons page.' }) };
  if (!L) return { name: 'error', title: 'Coming soon', data: merge_(base, { message: c ? '"' + c.title + '" is coming soon.' : "We couldn't find that lesson." }) };
  var p = rec ? rec.progress[lid] || null : null;
  var state = p ? JSON.parse(JSON.stringify(p)) : newProgress_();
  if (p && p.quiz_answers) state.quiz_results = gradeQuiz_(L, p.quiz_answers);
  return { name: 'lesson', title: L.title, mainClass: 'lesson-main',
           data: merge_(base, { lesson: publicLesson_(L), state: state, stage: currentStage_(L, p), stages: stagesDone_(L, p),
                                lesson_xp: rec ? lessonXp_(rec, lid) : 0, xp_possible: possibleXp_(L), stars: lessonStars_(L, p),
                                pct: percent_(p, L), feedback: rec ? ((cfg.feedback[rec.email] || {})[lid] || '') : '',
                                video: embedInfo_(cfg.videos[lid]), makecode: DATA.makecode_url,
                                key: teacher ? { quiz: L.quiz.map(function (q) { return q.choices[q.answer]; }), notes: L.teacher_notes || '',
                                                 standards: L.standards_full || [] } : null }) };
}

function standardsData_() {
  return { lessons: lessonList_().map(function (L) { return { id: L.id, number: L.number, title: L.title, course: DATA.courses[L.course].short, standards: L.standards_full || [] }; }) };
}

/** Same rules as before: YouTube, Google Drive, Vimeo, or a direct video file. */
function embedInfo_(url) {
  if (!url || !/^https:\/\//.test(url)) return null;
  var m;
  if ((m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/.exec(url)))
    return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] };
  if ((m = /^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/.exec(url))) return { kind: 'iframe', src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
  if ((m = /^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/.exec(url))) return { kind: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: 'video', src: url };
  return { kind: 'link', src: url };
}

// ---------------------------------------------------------------- install check
function escapeHtml_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

/** Every pasted Script file must be there, complete (its last line sets its stamp), and from the same build. */
function installProblems_() {
  var out = [], stamps = typeof BUILD_STAMPS === 'undefined' ? {} : BUILD_STAMPS;
  Object.keys(BUILD_EXPECT).forEach(function (key) {
    var got = stamps[key], name = key + '.gs';
    if (!got) out.push(name + ' is missing or was cut short while pasting. Add it as a Script file named "' + key + '" and paste all of it.');
    else if (got !== BUILD_EXPECT[key]) out.push(name + ' is from a different version than Code.gs. Paste the new ' + name + '.');
  });
  return out;
}

/** Run this from the editor (choose checkInstall, press Run) to check everything; the result is in the log. */
function checkInstall() {
  var lines = [], ok = function (good, text) { lines.push((good ? '✅ ' : '❌ ') + text); };
  var problems = installProblems_();
  ok(!problems.length, problems.length ? 'Files: ' + problems.join(' | ') : 'All ' + BUILD_FILES.length + ' files are pasted, complete, and match (Code.gs ' + BUILD_ID + ')');
  try {
    ['styles', 'app'].forEach(function (k) { if (asset_(k).length < 1000) throw new Error(k + ' is empty'); });
    ok(true, 'The site\'s styles and code unpack');
  } catch (e) { ok(false, 'Assets.gs: ' + e.message); }
  try { ok(Object.keys(DATA.lessons).length > 0, Object.keys(DATA.lessons).length + ' lessons in Data.gs'); } catch (e) { ok(false, 'Data.gs: ' + e.message); }
  try { studentFolder_(); ok(true, 'Drive folder "' + DATA_FOLDER + '" is ready'); } catch (e) { ok(false, 'Drive folder: ' + e.message + ' (run setup)'); }
  try { var icon = faviconUrl_(); ok(true, 'Tab icon: ' + icon); } catch (e) { ok(false, 'Tab icon: ' + e.message); }
  try { config_(); ok(true, 'Settings file reads'); } catch (e) { ok(false, 'Settings: ' + e.message); }
  try { ok(true, 'Google Classroom: ' + classroomCoursesRaw_().length + ' active classes you teach'); }
  catch (e) { ok(false, 'Google Classroom: ' + e.message); }
  try { ok(ScriptApp.getService().isEnabled(), 'Web app is deployed: ' + ScriptApp.getService().getUrl()); } catch (e) { ok(false, 'Deployment: ' + e.message); }
  var report = lines.join('\n');
  Logger.log(report);
  return report;
}

function plainPage_(title, body) {
  return withIcon_(HtmlService.createHtmlOutput('<!doctype html><html><head><base target="_top"><meta charset="utf-8"></head>' +
    '<body style="font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#12283f">' + body + '</body></html>')
    .setTitle(title));
}

// ---------------------------------------------------------------- the HTML around every page
/** The site's CSS and JavaScript, stored gzip-compressed in Assets.gs. */
var ASSET_CACHE_ = {};
function asset_(name) {
  if (ASSET_CACHE_[name] !== undefined) return ASSET_CACHE_[name];
  var blob = Utilities.newBlob(Utilities.base64Decode(ASSETS_GZ[name]), 'application/x-gzip');
  return (ASSET_CACHE_[name] = JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8')));
}

/** Text as web-safe base64: only letters, digits, - and _, so Apps Script can't mistake any of it for a comment. */
function safe64_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(text, 'text/plain').getBytes()).replace(/=+$/, '');
}

// Apps Script strips // and /* comments from <script> blocks, without noticing when they're inside strings.
// So the page gets exactly two tiny scripts written with no slashes at all, and all real code and data
// travel as safe64 text that the loader decodes and runs.
var CRASH_SCRIPT_ = '<script>window.addEventListener("error",function(e){var b=document.getElementById("ml-crash");' +
  'if(!b){b=document.createElement("div");b.id="ml-crash";b.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;' +
  'z-index:9999;background:#fde2e2;color:#7a1010;border:2px solid #b32626;border-radius:10px;padding:10px 14px;' +
  'font:14px system-ui,sans-serif;white-space:pre-wrap";(document.body||document.documentElement).appendChild(b);' +
  'b.textContent="Something went wrong on this page. Please send this to your teacher:"}' +
  'b.textContent+=String.fromCharCode(10)+(e.message||"error")+(e.lineno?" (line "+e.lineno+")":"")});</script>';
var LOADER_SCRIPT_ = '<script>(function(){var t=document.getElementById("ml-code");' +
  'function d(s){var b=atob(s.split("-").join("+").split("_").join(String.fromCharCode(47)));' +
  'var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++){u[i]=b.charCodeAt(i)}return new TextDecoder().decode(u)}' +
  'var parts=t.textContent.split(".");for(var j=0;j<parts.length;j++){if(!parts[j])continue;' +
  'var s=document.createElement("script");s.textContent=d(parts[j]);document.body.appendChild(s)}' +
  'if(window.MLStart){window.MLStart()}})();</script>';

function json_(v) { return JSON.stringify(v).replace(/</g, '\\u003c'); }

// AppVenture's fonts: Lilita One for headings, Nunito for text (system fonts if Google Fonts is blocked). A <link>, not a
// CSS @import, because Apps Script strips "//" inside <style> blocks.
var FONTS_HTML_ = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@500;700;800;900&display=swap">';

function render_(me, page) {
  var nav = me.teacher
    ? [['/', 'My classes'], ['/lessons', 'Lessons'], ['/map', 'Skill trees'], ['/teacher/standards', 'Standards'], ['/teacher/videos', 'Videos'], ['/arcade', '🎮 Arcade']]
    : [['/', 'Home'], ['/lessons', 'Lessons'], ['/map', 'Skill tree'], ['/me', 'My robot'], ['/arcade', '🎮 Arcade']];
  var ml = { base: ScriptApp.getService().getUrl(), page: page.name, path: page.path || '/', teacher: me.teacher, nav: nav, data: page.data || {} };
  var globals = page.globals || {}, setup = 'window.ML=' + json_(ml) + ';';
  Object.keys(globals).forEach(function (k) { setup += 'window.' + k + '=' + json_(globals[k]) + ';'; });
  var code = [safe64_(setup), safe64_(asset_('app'))];
  var out = ['<!doctype html><html lang="en"><head><base target="_top"><meta charset="utf-8">', FONTS_HTML_,
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="csrf-token" content="apps-script">',
    '<style>', asset_('styles'), '</style></head><body class="apps-script ' + (page.bodyClass || '') + '">', CRASH_SCRIPT_,
    '<header class="topbar" id="topbar"></header>',
    '<main class="', page.mainClass || 'container', '" id="main">',
    page.html || '<p class="muted" style="padding:24px">Loading Maker Lab…</p><noscript>Maker Lab needs JavaScript turned on.</noscript>', '</main>',
    '<footer class="footer">micro:bit Maker Lab · MakeCode Python + circuits</footer>',
    '<div id="ml-code" hidden>', code.join('.'), '</div>', LOADER_SCRIPT_, '</body></html>'];
  return withIcon_(HtmlService.createHtmlOutput(out.join(''))
    .setTitle((page.title ? page.title + ' · ' : '') + APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1'));
}
