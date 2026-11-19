// ---------------------------------------------------------------- "I'm stuck": help requests
// A student presses ✋ on a lesson; the class display rings and shows who needs help and where.
// Requests live in script properties (fast to read every few seconds), one per student, and expire after an hour.
// The display never gets emails: each request has a short "who" id instead.

var HELP_MAX_MS_ = 60 * 60 * 1000;

function helpWho_(email) {
  var h = 5381;
  for (var i = 0; i < email.length; i++) h = ((h * 33) ^ email.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function helpGet_(email) {
  var raw = PropertiesService.getScriptProperties().getProperty('help:' + email);
  if (!raw) return null;
  try {
    var r = JSON.parse(raw);
    if (Date.now() - new Date(r.at).getTime() > HELP_MAX_MS_) { PropertiesService.getScriptProperties().deleteProperty('help:' + email); return null; }
    return r;
  } catch (e) { return null; }
}

/** Student API: /api/help {action: 'ask' | 'cancel' | 'status', lesson, stage, step, note}. */
function helpApi_(d) {
  if (whoIs_().teacher) return { ok: true, teacher: true, help: null };
  var ctx = student_(), email = ctx.rec.email, props = PropertiesService.getScriptProperties();
  if (d.action === 'cancel') { props.deleteProperty('help:' + email); return { ok: true, help: null }; }
  if (d.action === 'ask') {
    var L = DATA.lessons[d.lesson], step = L && d.stage === 'build' ? L.build[Math.max(0, Math.min(L.build.length - 1, Number(d.step) || 0))] : null;
    var where = L ? L.title + (step ? ' · Step ' + ((Number(d.step) || 0) + 1) + ': ' + step.title : d.stage ? ' · ' + stageName_(d.stage) : '') : 'Maker Lab';
    var req = { who: helpWho_(email), email: email, name: ctx.rec.name, classes: studentClassIds_(ctx.rec, ctx.cfg), at: now_(),
                where: where, note: text_(d.note, 140).replace(/\s+/g, ' ').trim(), avatar: avatarOf_(ctx.rec) };
    props.setProperty('help:' + email, JSON.stringify(req));
    if (L && d.stage === 'build') {                           // the feedback report counts help requests per step
      var fb = fbOf_(ctx.rec, L.id), k = String(Math.max(0, Number(d.step) || 0));
      fb.help[k] = (fb.help[k] || 0) + 1;
      saveStudent_(ctx.rec);
    }
    return { ok: true, help: { at: req.at } };
  }
  var mine = helpGet_(email);
  return { ok: true, help: mine ? { at: mine.at } : null };
}

/** Open help requests for a class, oldest first. Names follow the display's "show students as" setting. */
function helpList_(cfg, cid) {
  var props = PropertiesService.getScriptProperties().getProperties(), out = [];
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('help:') !== 0) return;
    var r = helpGet_(k.slice(5));
    if (r && (r.classes || []).indexOf(cid) >= 0) out.push(r);
  });
  var mode = ((cfg.classes[cid] || {}).screen || {}).names || 'first';
  var names = shownNames_(out.map(function (r) { return { email: r.email, name: r.name, avatar: r.avatar }; }), mode);
  return out.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); })
    .map(function (r) { return { who: r.who, name: names[r.email] || r.name, where: r.where, note: r.note, at: r.at, avatar: r.avatar }; });
}

/** Teacher: the class display asks for these every few seconds. */
function helpList(cid) {
  var cfg = teacher_();
  if (!cfg.classes[cid]) throw new Error('No such class.');
  return helpList_(cfg, cid);
}

/** Teacher: "✓ Helped" clears a request. */
function helpResolve(cid, who) {
  var cfg = teacher_(), props = PropertiesService.getScriptProperties().getProperties();
  Object.keys(props).forEach(function (k) {
    if (k.indexOf('help:') === 0 && helpWho_(k.slice(5)) === who) PropertiesService.getScriptProperties().deleteProperty(k);
  });
  return helpList_(cfg, cid);
}

// ---------------------------------------------------------------- 💤 idle students (client/lib/nudge.js)
// After two minutes without touching the Chromebook (with the Maker Lab tab in front), the page says so here, and
// says so again when the student is back. It's kept in the cache only (no files, no lock) and forgets itself after
// five minutes, so a closed Chromebook doesn't stay marked. The class display shows 💤 on those robots.
var IDLE_TTL_ = 300;

/** Student API: /api/idle {on: true|false, secs: how long they've been idle}. */
function idleApi_(d) {
  var me = whoIs_();
  if (me.teacher || !me.email) return { ok: true };
  var cache = CacheService.getScriptCache(), key = 'idle:' + me.email;
  if (d && d.on) {
    var secs = Math.max(0, Math.min(3600, Number(d.secs) || 0));
    cache.put(key, String(Date.now() - secs * 1000), IDLE_TTL_);
  } else cache.remove(key);
  return { ok: true };
}

/** email -> minutes idle, for the students who are idle right now. One cache read for the whole class. */
function idleMinutes_(emails) {
  var out = {};
  if (!emails.length) return out;
  var got = {};
  try { got = CacheService.getScriptCache().getAll(emails.map(function (e) { return 'idle:' + e; })) || {}; } catch (e) { return out; }
  emails.forEach(function (e) {
    var since = Number(got['idle:' + e]);
    if (since) out[e] = Math.max(2, Math.round((Date.now() - since) / 60000));
  });
  return out;
}
