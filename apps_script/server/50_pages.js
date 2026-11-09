// ---------------------------------------------------------------- pages
/** Lesson pages are stored gzip-compressed (PAGES_GZ, made by the build); unpack one when needed. */
var PAGE_CACHE_ = {};
function page_(id) {
  if (PAGE_CACHE_[id]) return PAGE_CACHE_[id];
  var packed = PAGES_GZ[id];
  if (!packed) return null;
  var blob = Utilities.newBlob(Utilities.base64Decode(packed), 'application/x-gzip');
  return (PAGE_CACHE_[id] = JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8')));
}

// Every page is one doGet: ?p=/lessons/blink-external-led mirrors the Flask site's URLs.
// Lesson pages are pre-rendered by the build (PAGES); other pages are drawn in the browser
// by client/pages.js from the data sent here.

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
  return render_(me, page);
}

function studentPage_(me, path) {
  var rec = loadStudent_(me.email), cfg = config_();
  if (!rec || !rec.name || !studentClassIds_(rec, cfg).length) return { name: 'join', title: 'Join your class', data: { name: rec ? rec.name : '' } };
  var rewards = syncRewards_(rec, cfg);
  if (rewards.xp_gained) saveStudent_(rec);
  var level = levelInfo_(rec.xp || 0), base = { level: level, avatar: avatarOf_(rec), rewards: rewards, name: rec.name };
  var m;
  if (path === '/' || path === '/dashboard') return { name: 'dashboard', title: 'Dashboard', data: merge_(base, dashboardData_(rec, cfg)) };
  if (path === '/lessons') return { name: 'catalog', title: 'Lessons', data: merge_(base, catalogData_(rec)) };
  if (path === '/map') return { name: 'map', title: 'Maker Map', data: merge_(base, { map: mapData_(rec, assignedIds_(rec, cfg)) }) };
  if (path === '/me') return { name: 'profile', title: 'My robot', data: merge_(base, profileData_(rec)) };
  if (path === '/editor') return { name: 'playground', title: 'Editor', editor: true, html: page_('_playground').html, data: base };
  if ((m = /^\/lessons\/([\w-]+)$/.exec(path)) && PAGES_GZ[m[1]]) return lessonPage_(m[1], rec, cfg, base, false);
  return { name: 'error', title: 'Not found', data: { message: "We couldn't find that page." } };
}

function teacherPage_(path) {
  var cfg = config_(), m, base = { teacher: true };
  if (path === '/' || path === '/teacher') return { name: 'teacher-home', title: 'My classes', data: merge_(base, teacherHome()) };
  if ((m = /^\/teacher\/classes\/(\w+)$/.exec(path))) return { name: 'classroom', title: 'Class', data: merge_(base, merge_(gradebook(m[1]), { units: catalogUnits_() })) };
  if ((m = /^\/teacher\/classes\/(\w+)\/students\/(.+)$/.exec(path))) return { name: 'student', title: 'Student', data: merge_(base, studentDetail(m[1], decodeURIComponent(m[2]))) };
  if ((m = /^\/teacher\/classes\/(\w+)\/google-classroom$/.exec(path))) return { name: 'google', title: 'Google Classroom', data: merge_(base, gradebook(m[1])) };
  if (path === '/teacher/standards') return { name: 'static', title: 'Standards', html: page_('_standards').html, data: base };
  if (path === '/teacher/videos') return { name: 'videos', title: 'Videos', data: merge_(base, { units: catalogUnits_(), urls: cfg.videos }) };
  if (path === '/lessons') return { name: 'catalog', title: 'Lessons', data: merge_(base, catalogData_(null)) };
  if (path === '/map') {
    var map = mapData_(null, {});
    map.nodes.forEach(function (n) { n.state = 'open'; });
    return { name: 'map', title: 'Maker Map', data: merge_(base, { map: map }) };
  }
  if (path === '/editor') return { name: 'playground', title: 'Editor', editor: true, html: page_('_playground').html, data: base };
  if ((m = /^\/lessons\/([\w-]+)$/.exec(path)) && PAGES_GZ[m[1]]) return lessonPage_(m[1], null, cfg, base, true);
  return { name: 'error', title: 'Not found', data: { message: "We couldn't find that page." } };
}

function merge_(a, b) {
  var out = {};
  Object.keys(a).forEach(function (k) { out[k] = a[k]; });
  Object.keys(b).forEach(function (k) { out[k] = b[k]; });
  return out;
}

function catalogUnits_() {
  return Object.keys(DATA.units).map(function (u) {
    return { number: +u, title: DATA.units[u].title, blurb: DATA.units[u].blurb,
             lessons: lessonList_().filter(function (L) { return String(L.unit) === u; }).map(function (L) { return L.card; }) };
  }).filter(function (u) { return u.lessons.length; });
}

function catalogData_(rec) {
  var pct = {};
  if (rec) Object.keys(rec.progress).forEach(function (l) { if (DATA.lessons[l]) pct[l] = percent_(rec.progress[l], DATA.lessons[l]); });
  return { units: catalogUnits_(), pct: pct };
}

function dashboardData_(rec, cfg) {
  var classes = studentClassIds_(rec, cfg), started = {};
  Object.keys(rec.progress).forEach(function (l) { started[l] = 1; });
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var rows = cfg.assignments.filter(function (a) {
    return classes.indexOf(a.class_id) >= 0 && DATA.lessons[a.lesson_id] && owesAssignment_(a, started);
  }).sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0; })
    .map(function (a) {
      var L = DATA.lessons[a.lesson_id], p = rec.progress[a.lesson_id], pct = p ? percent_(p, L) : 0;
      return { lesson: L.card, class_name: cfg.classes[a.class_id].name, due: a.due, note: a.note, pct: pct,
               overdue: !!(a.due && a.due < today && pct < 100), feedback: !!((cfg.feedback[rec.email] || {})[a.lesson_id]) };
    });
  var recent = Object.keys(rec.progress).filter(function (l) { return DATA.lessons[l]; })
    .sort(function (a, b) { return String(rec.progress[b].updated_at || '').localeCompare(String(rec.progress[a].updated_at || '')); })
    .slice(0, 3).map(function (l) { return { lesson: DATA.lessons[l].card, pct: percent_(rec.progress[l], DATA.lessons[l]) }; });
  var badges = badgeList_(rec).filter(function (b) { return b.earned; })
    .sort(function (a, b) { return String(b.earned_at).localeCompare(String(a.earned_at)); });
  return { rows: rows, recent: recent, badges: badges.slice(0, 6), badge_total: DATA.badges.length,
           classes: classes.map(function (c) { return cfg.classes[c].name; }) };
}

function profileData_(rec) {
  return { badges: badgeList_(rec), history: rec.xp_log || [], catalog: avatarCatalog_(rec, false),
           parts: DATA.avatar_parts, levels: DATA.levels, xp_table: DATA.xp };
}

function lessonState_(L, p, rec, cfg) {
  return {
    sections: (p && p.sections) || {}, circuit_steps: (p && p.circuit_steps) || [],
    warmup_answer: (p && p.warmup_answer) || '',
    code: (p && p.code) || L.starter,
    debug_code: (p && p.debug_code) || L.buggy,
    practice_code: (p && p.practice_code) || L.practice_starter,
    practice_solved: !!(p && p.practice_solved), debug_solved: !!(p && p.debug_solved),
    debug_hints_used: (p && p.debug_hints_used) || 0, debug_reflection: (p && p.debug_reflection) || '',
    quiz_answers: p && p.quiz_answers ? p.quiz_answers : null, quiz_score: p ? p.quiz_score : null, quiz_best: p ? p.quiz_best : null,
    challenge_code: (p && (p.challenge_code || p.code)) || L.starter,
    challenge_response: (p && p.challenge_response) || '', challenge_submitted: !!(p && p.challenge_submitted_at),
    feedback: rec ? ((cfg.feedback[rec.email] || {})[L.id] || '') : '',
  };
}

function lessonPage_(lid, rec, cfg, base, teacher) {
  var L = DATA.lessons[lid], pg = page_(lid), p = rec ? rec.progress[lid] : null;
  var state = lessonState_(L, p, rec, cfg);
  if (p && p.quiz_answers) state.quiz_results = gradeQuiz_(L, p.quiz_answers);
  return { name: 'lesson', title: L.title, editor: true, lesson: true, html: pg.html, mainClass: 'lesson-layout',
           data: merge_(base, { lesson_xp: rec ? lessonXp_(rec, lid) : 0, stars: lessonStars_(L, p), xp_possible: L.possible_xp,
                                video: embedInfo_(cfg.videos[lid]), teacher_key: teacher ? pg.teacher_key : '' }),
           globals: { LESSON: pg.view, STATE: state, SECTION_KEYS: L.section_keys } };
}

/** Same rules as app/videos.py: YouTube, Google Drive, Vimeo, or a direct video file. */
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
  BUILD_FILES.forEach(function (name) {
    var key = name.replace(/\.gs$/, ''), got = stamps[key];
    if (!got) out.push(name + ' is missing or was cut short while pasting. Add it as a Script file named "' + key + '" and paste all of it.');
    else if (got !== BUILD_ID) out.push(name + ' is from a different version than Code.gs. Paste the new ' + name + '.');
  });
  return out;
}

/** Run this from the editor (choose checkInstall, press Run) to check everything; the result is in the log. */
function checkInstall() {
  var lines = [], ok = function (good, text) { lines.push((good ? '✅ ' : '❌ ') + text); };
  var problems = installProblems_();
  ok(!problems.length, problems.length ? 'Files: ' + problems.join(' | ') : 'All ' + BUILD_FILES.length + ' files are pasted, complete, and from build ' + BUILD_ID);
  try {
    ['styles', 'app', 'editor'].forEach(function (k) { if (asset_(k).length < 1000) throw new Error(k + ' is empty'); });
    ok(true, 'The site\'s styles and code unpack');
  } catch (e) { ok(false, 'Assets.gs: ' + e.message); }
  try { ok(Object.keys(DATA.lessons).length > 0, Object.keys(DATA.lessons).length + ' lessons in Data.gs'); } catch (e) { ok(false, 'Data.gs: ' + e.message); }
  try {
    var n = Object.keys(PAGES_GZ).length, first = page_(DATA.order[0]);
    ok(!!first && first.html.length > 1000, n + ' lesson pages in Pages*.gs, and they unpack');
  } catch (e) { ok(false, 'Pages*.gs: ' + e.message); }
  try { studentFolder_(); ok(true, 'Drive folder "' + DATA_FOLDER + '" is ready'); } catch (e) { ok(false, 'Drive folder: ' + e.message + ' (run setup)'); }
  ['v1', 'v2'].forEach(function (v) {
    try { ok(firmwareInfo(v).parts > 0, 'micro:bit firmware ' + v + ' is saved'); } catch (e) { ok(false, 'firmware ' + v + ': ' + e.message); }
  });
  try { config_(); ok(true, 'Settings file reads'); } catch (e) { ok(false, 'Settings: ' + e.message); }
  try { ok(ScriptApp.getService().isEnabled(), 'Web app is deployed: ' + ScriptApp.getService().getUrl()); } catch (e) { ok(false, 'Deployment: ' + e.message); }
  var report = lines.join('\n');
  Logger.log(report);
  return report;
}

function plainPage_(title, body) {
  return HtmlService.createHtmlOutput('<!doctype html><html><head><base target="_top"><meta charset="utf-8"></head>' +
    '<body style="font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#12283f">' + body + '</body></html>')
    .setTitle(title);
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

function render_(me, page) {
  var nav = me.teacher
    ? [['/lessons', 'Lessons'], ['/map', 'Map'], ['/editor', 'Editor'], ['/', 'My classes'], ['/teacher/standards', 'Standards'], ['/teacher/videos', 'Videos']]
    : [['/lessons', 'Lessons'], ['/map', 'Map'], ['/editor', 'Editor'], ['/', 'Dashboard']];
  var ml = { base: ScriptApp.getService().getUrl(), page: page.name, teacher: me.teacher, nav: nav, data: page.data || {} };
  var globals = page.globals || {}, setup = 'window.ML=' + json_(ml) + ';';
  Object.keys(globals).forEach(function (k) { setup += 'window.' + k + '=' + json_(globals[k]) + ';'; });
  var code = [safe64_(setup), safe64_(asset_('app'))];
  if (page.editor) code.push(safe64_(asset_('editor')));
  var out = ['<!doctype html><html lang="en"><head><base target="_top"><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="csrf-token" content="apps-script">',
    '<style>', asset_('styles'), '</style></head><body class="apps-script">', CRASH_SCRIPT_,
    '<header class="topbar" id="topbar"></header>',
    '<main class="', page.mainClass || 'container', '" id="main">',
    page.html || '<p class="muted" style="padding:24px">Loading Maker Lab…</p><noscript>Maker Lab needs JavaScript turned on.</noscript>', '</main>',
    '<footer class="footer">Built for young makers · Python + micro:bit + circuits</footer>',
    '<div id="ml-code" hidden>', code.join('.'), '</div>', LOADER_SCRIPT_, '</body></html>'];
  return HtmlService.createHtmlOutput(out.join(''))
    .setTitle((page.title ? page.title + ' · ' : '') + APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
