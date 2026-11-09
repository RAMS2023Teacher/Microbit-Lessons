// ---------------------------------------------------------------- student API
// The browser's lesson code calls the same paths as the Flask site (/api/lessons/<id>/save ...).
// client/shim.js turns those fetch() calls into google.script.run.api(path, body).

function text_(v) {
  if (typeof v !== 'string') throw new Error('Bad request');
  return v.slice(0, MAX_TEXT);
}

function newProgress_() {
  return { sections: {}, circuit_steps: [], started_at: now_(), updated_at: now_() };
}

function mark_(p, key, done) { p.sections = p.sections || {}; p.sections[key] = done === undefined ? true : !!done; }

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
  var rewards = syncRewards_(ctx.rec, ctx.cfg);
  saveStudent_(ctx.rec);
  var out = { ok: true, sections: p.sections, percent: pct, rewards: rewards,
              lesson_xp: lessonXp_(ctx.rec, L.id), stars: lessonStars_(L, p) };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function failing_(results) {
  return results.filter(function (r) { return !r.ok && r.message; }).map(function (r) { return r.message; }).slice(0, 1);
}

/** One entry point for the lesson page. Returns {status, body} like an HTTP response. */
function api(path, bodyJson) {
  try {
    var body = bodyJson ? JSON.parse(bodyJson) : {};
    var m = /^\/api\/lessons\/([\w-]+)\/(save|sent|practice|debug|quiz|challenge|partner)$/.exec(path);
    if (path === '/api/avatar') return apiAvatar_(body);
    if (!m) return { status: 404, body: { error: 'Not found' } };
    var L = DATA.lessons[m[1]];
    if (!L) return { status: 404, body: { error: 'No such lesson' } };
    if (m[2] === 'partner') return { status: 200, body: { status: 'none', classmates: [] } };   // partners come later
    var ctx = student_();
    var p = ctx.rec.progress[L.id] || (ctx.rec.progress[L.id] = newProgress_());
    return { status: 200, body: API_[m[2]](ctx, L, p, body) };
  } catch (e) {
    if (e && e.status) return { status: e.status, body: { ok: false, error: e.message } };
    return { status: 400, body: { ok: false, error: (e && e.message) || 'Something went wrong.' } };
  }
}

function badRequest_(msg) { var e = new Error(msg); e.status = 400; return e; }

var API_ = {
  save: function (ctx, L, p, d) {
    ['code', 'practice_code', 'debug_code', 'challenge_code', 'challenge_response', 'debug_reflection'].forEach(function (f) {
      if (d[f] !== undefined) p[f] = text_(d[f]);
    });
    if (d.warmup_answer !== undefined) {
      p.warmup_answer = text_(d.warmup_answer);
      mark_(p, 'warmup', p.warmup_answer.trim().length >= 3);
    }
    if (typeof d.debug_hints_used === 'number') p.debug_hints_used = Math.max(p.debug_hints_used || 0, Math.min(d.debug_hints_used, 10));
    if (d.circuit_steps !== undefined && L.stepped_count) {
      var seen = {};
      p.circuit_steps = (d.circuit_steps || []).filter(function (i) {
        var ok = typeof i === 'number' && i === Math.floor(i) && i >= 0 && i < L.stepped_count && !seen[i];
        seen[i] = 1; return ok;
      }).sort(function (a, b) { return a - b; });
      mark_(p, L.stepped_key, p.circuit_steps.length === L.stepped_count);
    }
    ['learn', 'code'].forEach(function (k) { if (d.mark && d.mark[k] !== undefined) mark_(p, k, d.mark[k]); });
    return finish_(ctx, L, p);
  },
  sent: function (ctx, L, p, d) {
    p.sends = (p.sends || 0) + 1;
    if (d.section === 'code') mark_(p, 'code');
    return finish_(ctx, L, p);
  },
  practice: function (ctx, L, p, d) {
    if (!L.practice) throw badRequest_('This lesson has no Your turn task.');
    var code = text_(d.code || '');
    p.practice_code = code;
    var results = runChecks_(code, L.practice.checks), solved = results.every(function (r) { return r.ok; });
    if (solved) { p.practice_solved = true; mark_(p, 'practice'); }
    return finish_(ctx, L, p, { solved: solved, messages: failing_(results),
      passed: results.filter(function (r) { return r.ok; }).length, total: results.length });
  },
  debug: function (ctx, L, p, d) {
    if (!L.debug) throw badRequest_('This lesson has no debug task.');
    var code = text_(d.code || '');
    p.debug_code = code;
    p.debug_attempts = (p.debug_attempts || 0) + 1;
    var results = code.trim() === L.debug.buggy_code.trim()
      ? [{ ok: false, message: 'This is still the original broken code. Change something first!' }]
      : runChecks_(code, L.debug.checks);
    var solved = results.every(function (r) { return r.ok; });
    if (solved) { p.debug_solved = true; mark_(p, 'debug'); }
    return finish_(ctx, L, p, { solved: solved, messages: failing_(results),
      passed: results.filter(function (r) { return r.ok; }).length, total: results.length });
  },
  quiz: function (ctx, L, p, d) {
    if (!Array.isArray(d.answers) || d.answers.length !== L.quiz.length) throw badRequest_('Answer every question.');
    var answers = d.answers.map(function (a) { return typeof a === 'number' ? a : null; });
    var graded = gradeQuiz_(L, answers);
    p.quiz_answers = answers;
    p.quiz_score = graded.score;
    p.quiz_total = graded.total;
    p.quiz_best = Math.max(p.quiz_best || 0, graded.score);
    p.quiz_attempts = (p.quiz_attempts || 0) + 1;
    mark_(p, 'quiz');
    return finish_(ctx, L, p, { quiz: graded, best: p.quiz_best });
  },
  challenge: function (ctx, L, p, d) {
    var response = text_(d.response || '').trim();
    if (response.length < 10) throw badRequest_('Tell us a bit more about what you built (at least a sentence).');
    p.challenge_code = text_(d.code || '');
    p.challenge_response = response;
    p.challenge_submitted_at = now_();
    mark_(p, 'challenge');
    return finish_(ctx, L, p, { partner: null });
  },
};

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

// ---------------------------------------------------------------- firmware for .hex downloads
/** Run once from the editor (Run > setup). Makes the data folder and downloads the micro:bit firmware. */
function setup() {
  var folder = dataFolder_();
  studentFolder_();
  var props = PropertiesService.getScriptProperties();
  Object.keys(FIRMWARE).forEach(function (name) {
    var key = 'firmware:' + name;
    if (props.getProperty(key)) {
      try { DriveApp.getFileById(props.getProperty(key)); return; } catch (e) { /* re-download */ }
    }
    var text = UrlFetchApp.fetch(FIRMWARE[name]).getContentText();
    if (text.charAt(0) !== ':' || text.length < 100000) throw new Error('The ' + name + ' firmware download did not look like a .hex file.');
    props.setProperty(key, folder.createFile('firmware-' + name + '.hex', text, 'text/plain').getId());
  });
  if (!readNamed_('config', null)) saveConfig_(emptyConfig_());
  return 'Set up: data folder "' + DATA_FOLDER + '" and the micro:bit firmware are ready.';
}

function firmwareText_(name) {
  var id = PropertiesService.getScriptProperties().getProperty('firmware:' + name);
  if (!id) throw new Error('The micro:bit firmware is not set up yet. Ask your teacher to run setup.');
  return DriveApp.getFileById(id).getBlob().getDataAsString();
}
function firmwareInfo(name) {
  return { parts: Math.ceil(firmwareText_(name).length / FIRMWARE_PART) };
}
function firmwarePart(name, i) {
  return firmwareText_(name).substr(i * FIRMWARE_PART, FIRMWARE_PART);
}
