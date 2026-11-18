// ---------------------------------------------------------------- 🐞 problem reports
// Students (and the teacher) report a problem from Aa → "Report a problem" or the footer; the page adds where they
// were (page, lesson, stage, step), the browser, the app version and its last errors. Page errors are also reported
// on their own (client/lib/bugs.js, at most 3 per visit) and repeats are dropped here. Reports are kept in one file
// ("bugs"), newest 400. Saving takes the lock briefly (read, add one, write); nothing slow happens inside it.

var BUG_KEEP_ = 400, BUG_PER_DAY_ = 10;
var BUG_KINDS_ = { broken: "Something didn't work", words: 'Words are wrong or confusing', find: "I can't find something", other: 'Something else', auto: 'Page error (automatic)' };

function reportBug(d) {
  var me = whoIs_();
  if (!me.email) throw new Error('Sign in with your school Google account.');
  d = d || {};
  var kind = BUG_KINDS_[d.kind] ? d.kind : 'other';
  var text = String(d.text || '').slice(0, 1500).trim();
  if (kind !== 'auto' && text.length < 3) throw new Error('Tell us a little about what happened.');
  var cache = CacheService.getScriptCache(), day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var mine = 'bugs:' + day + ':' + me.email, count = Number(cache.get(mine) || 0);
  if (count >= BUG_PER_DAY_) return { ok: true, skipped: 'too many today' };
  if (kind === 'auto') {                                       // the same page error once a day is enough
    var key = 'bug:' + trHash_(String(d.text || '') + '|' + String(d.page || ''));
    if (cache.get(key)) return { ok: true, skipped: 'seen' };
    cache.put(key, '1', 21600);
  }
  cache.put(mine, String(count + 1), 21600);
  var ctx = d.ctx || {};
  var rec = me.teacher ? null : (function () { try { return loadStudent_(me.email); } catch (e) { return null; } })();
  var bug = { id: Math.random().toString(36).slice(2, 10), at: now_(), status: 'new', kind: kind, text: text,
              email: me.email, name: me.teacher ? 'Teacher' : ((rec && rec.name) || me.email.split('@')[0]),
              page: String(d.page || '').slice(0, 200),
              lesson: String(ctx.lesson || '').slice(0, 60), stage: String(ctx.stage || '').slice(0, 20),
              step: ctx.step == null ? null : Number(ctx.step), lang: String(ctx.lang || '').slice(0, 5),
              browser: String(d.browser || '').slice(0, 200), screen: String(d.screen || '').slice(0, 40),
              version: typeof BUILD_STAMPS !== "undefined" ? (BUILD_STAMPS.Assets || "") + "/" + (BUILD_STAMPS.Data || "") : "",
              errors: (d.errors || []).slice(-5).map(function (e) { return String(e).slice(0, 300); }) };
  withLock_(function () {
    var list = readNamed_('bugs', []);
    list.unshift(bug);
    if (list.length > BUG_KEEP_) list = list.slice(0, BUG_KEEP_);
    writeNamed_('bugs', list);
  });
  return { ok: true, id: bug.id };
}

/** Teacher: all reports, newest first, with the lesson's title and file. */
function bugList() {
  teacher_();
  return { kinds: BUG_KINDS_, bugs: readNamed_('bugs', []).map(function (b) {
    var L = DATA.lessons[b.lesson];
    var out = JSON.parse(JSON.stringify(b));
    delete out.email;
    if (L) { out.lesson_title = L.number + '. ' + L.title; out.file = L.file; out.course = DATA.courses[L.course].short;
             if (b.step != null && L.build[b.step]) out.step_title = 'Step ' + (b.step + 1) + ': ' + L.build[b.step].title; }
    return out;
  }) };
}

/** Teacher: mark a report fixed / new again, or delete it. */
function bugUpdate(id, status) {
  teacher_();
  if (['new', 'fixed', 'deleted'].indexOf(status) < 0) throw new Error('Unknown status.');
  withLock_(function () {
    var list = readNamed_('bugs', []);
    list = status === 'deleted' ? list.filter(function (b) { return b.id !== id; })
      : list.map(function (b) { if (b.id === id) b.status = status; return b; });
    writeNamed_('bugs', list);
  });
  return bugList();
}

function bugCountNew_() {
  try { return readNamed_('bugs', []).filter(function (b) { return b.status === 'new'; }).length; } catch (e) { return 0; }
}
