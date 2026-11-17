// ---------------------------------------------------------------- the shop and Robot Rush
// XP to spend = all the XP a student ever earned minus what they spent. Levels count all earned XP, so
// shopping never lowers a level. Robot Rush (client/lib/game.js) is closed unless the teacher opens the arcade
// for a class (class display or class page). Finishing a lesson banks DATA.arcade.minutes of play time; each race
// uses its length from the bank, and only while the arcade is open for the student's class.
// Scores are checked here: a race has to be started on the server and take about as long as the race clock,
// and a score can't be more than a robot could make.

function spendable_(rec) { return Math.max(0, ((rec && rec.xp) || 0) - ((rec && rec.spent) || 0)); }

function powerLevels_(rec) {
  var out = {};
  DATA.powerups.forEach(function (u) { out[u.id] = Math.min(u.costs.length, ((rec && rec.powerups) || {})[u.id] || 0); });
  return out;
}

function raceSeconds_(levels) { return DATA.arcade.race_seconds + 5 * (levels.time || 0); }

function arcadeDay_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

var ARCADE_BANK_MAX_ = 15 * 60;            // play time a student can save up, in seconds

/** Finishing a lesson banks play time (it doesn't open the arcade: only the teacher does that). */
function openArcade_(rec) {
  var a = rec.arcade = rec.arcade || {};
  a.bank = Math.min(ARCADE_BANK_MAX_, (a.bank || 0) + DATA.arcade.minutes * 60);
}

/** Is the arcade open for this student's class right now, and how much play time do they have? */
function arcadeState_(rec, cfg) {
  var classes = studentClassIds_(rec, cfg).map(function (cid) { return cfg.classes[cid]; }).filter(Boolean), until = '';
  classes.forEach(function (c) { if (c.arcade_until && c.arcade_until > until) until = c.arcade_until; });
  var left = until ? Math.floor((new Date(until).getTime() - Date.now()) / 1000) : 0, bank = Math.max(0, Math.round((rec.arcade || {}).bank || 0));
  return { open: left > 0, seconds_left: Math.max(0, left), bank: bank, can_play: left > 0 && bank > 0, minutes: DATA.arcade.minutes };
}

/** The class leaderboard: top 10 today and of all time. `fresh` is a student record newer than the summary. */
function arcadeBoard_(cfg, cid, fresh) {
  if (!cid || !cfg.classes[cid]) return { today: [], all: [] };
  var sum = summary_(), day = arcadeDay_(), students = classStudents_(cfg, sum, cid), names = shownNames_(students, 'first');
  var rows = students.map(function (s) {
    var me = !!fresh && fresh.email === s.email, a = me ? (fresh.arcade || {}) : ((sum.students[s.email] || {}).arcade || {});
    return { name: names[s.email], avatar: me ? avatarOf_(fresh) : (s.avatar || null), best: a.best || 0,
             today: a.day === day ? (a.day_best || 0) : 0, me: me };
  });
  var top = function (k) {
    return rows.filter(function (r) { return r[k] > 0; }).sort(function (a, b) { return b[k] - a[k]; }).slice(0, 10)
      .map(function (r) { return { name: r.name, avatar: r.avatar, score: r[k], me: r.me }; });
  };
  return { today: top('today'), all: top('best') };
}

function shopCatalog_(rec) {
  var lv = powerLevels_(rec);
  return DATA.powerups.map(function (u) {
    return { id: u.id, icon: u.icon, name: u.name, desc: u.desc, level: lv[u.id], max: u.costs.length,
             next_cost: lv[u.id] < u.costs.length ? u.costs[lv[u.id]] : null };
  });
}

/** Everything the Arcade page shows. */
function arcadeData_(rec, cfg, teacher) {
  if (teacher) {
    return { practice: true, state: { open: true, can_play: true, bank: 0 }, spendable: 0, shop: shopCatalog_(null), powerups: powerLevels_(null),
             race_seconds: DATA.arcade.race_seconds, best: 0, board: { today: [], all: [] }, minutes: DATA.arcade.minutes };
  }
  var a = rec.arcade || {};
  return { state: arcadeState_(rec, cfg), spendable: spendable_(rec), shop: shopCatalog_(rec), powerups: powerLevels_(rec),
           race_seconds: raceSeconds_(powerLevels_(rec)), best: a.best || 0, plays: a.plays || 0, minutes: DATA.arcade.minutes,
           board: arcadeBoard_(cfg, studentClassIds_(rec, cfg)[0], rec) };
}

// ---------------------------------------------------------------- student API: /api/shop/buy, /api/arcade/start, /api/arcade/finish
function shopApi_(path, d) {
  if (whoIs_().teacher) {          // the teacher's preview: nothing is saved
    if (path === '/api/arcade/start') return { ok: true, practice: true, run_id: 'practice', seconds: DATA.arcade.race_seconds, powerups: powerLevels_(null) };
    if (path === '/api/arcade/finish') return { ok: true, practice: true, score: Math.round(Number(d.score) || 0) };
    return { ok: false, error: 'This is the student shop. Students buy items with the XP they earn.' };
  }
  var ctx = student_();
  if (path === '/api/shop/buy') return shopBuy_(ctx, d);
  if (path === '/api/arcade/start') return arcadeStart_(ctx);
  return arcadeFinish_(ctx, d);
}

function shopBuy_(ctx, d) {
  var rec = ctx.rec, item = String(d.item || ''), m, cost, power = null, level = 0;
  rec.owned = rec.owned || {};
  rec.powerups = rec.powerups || {};
  if ((m = /^part:(\w+):([\w-]+)$/.exec(item))) {
    var opt = (DATA.avatar_options[m[1]] || []).filter(function (o) { return o[0] === m[2]; })[0];
    if (!opt || !opt[2] || opt[2][0] !== 'cost') throw badRequest_("That isn't for sale.");
    if (rec.owned[item]) return { ok: true, already: true, spendable: spendable_(rec), catalog: avatarCatalog_(rec, false) };
    cost = opt[2][1];
  } else if ((m = /^power:(\w+)$/.exec(item))) {
    power = DATA.powerups.filter(function (u) { return u.id === m[1]; })[0];
    if (!power) throw badRequest_('No such power-up.');
    level = powerLevels_(rec)[power.id];
    if (level >= power.costs.length) return { ok: false, error: power.name + ' is already at the top level.' };
    cost = power.costs[level];
  } else throw badRequest_('No such item.');
  if (spendable_(rec) < cost) return { ok: false, error: 'You need ' + (cost - spendable_(rec)) + ' more XP to spend. Finish more steps to earn it!', spendable: spendable_(rec) };
  rec.spent = (rec.spent || 0) + cost;
  if (power) rec.powerups[power.id] = level + 1; else rec.owned[item] = now_();
  rec.shop_log = rec.shop_log || [];
  rec.shop_log.unshift({ item: item, cost: cost, at: now_() });
  if (rec.shop_log.length > 60) rec.shop_log.length = 60;
  saveStudent_(rec);
  return { ok: true, spendable: spendable_(rec), shop: shopCatalog_(rec), powerups: powerLevels_(rec), catalog: avatarCatalog_(rec, false),
           race_seconds: raceSeconds_(powerLevels_(rec)) };
}

function arcadeStart_(ctx) {
  var rec = ctx.rec, st = arcadeState_(rec, ctx.cfg);
  if (!st.open) return { ok: false, closed: true, error: 'The arcade is closed. Your teacher opens it in class.' };
  if (!st.bank) return { ok: false, error: 'You need play time: finish a lesson to earn ' + DATA.arcade.minutes + ' minutes.' };
  var a = rec.arcade = rec.arcade || {}, levels = powerLevels_(rec), id = Math.random().toString(36).slice(2, 10), secs = raceSeconds_(levels);
  a.runs = (a.runs || []).filter(function (r) { return Date.now() - new Date(r.at).getTime() < 15 * 60000; }).slice(-4);
  a.runs.push({ id: id, at: now_() });
  a.plays = (a.plays || 0) + 1;
  a.bank = Math.max(0, (a.bank || 0) - secs);         // a race uses its length from the bank
  saveStudent_(rec);
  return { ok: true, run_id: id, seconds: secs, powerups: levels, bank: a.bank };
}

function arcadeFinish_(ctx, d) {
  var rec = ctx.rec, a = rec.arcade = rec.arcade || {};
  var run = (a.runs || []).filter(function (r) { return r.id === d.run_id; })[0];
  if (!run) return { ok: false, error: "That race wasn't found. Start a new one." };
  a.runs = a.runs.filter(function (r) { return r !== run; });
  var secs = raceSeconds_(powerLevels_(rec)), took = (Date.now() - new Date(run.at).getTime()) / 1000;
  var score = Math.max(0, Math.round(Number(d.score) || 0));
  if (took < secs - 3 || took > secs + 600 || score > secs * 250) {
    saveStudent_(rec);
    return { ok: false, error: "That score couldn't be counted. Try another race!" };
  }
  var day = arcadeDay_(), newBest = score > (a.best || 0);
  if (newBest) { a.best = score; a.best_at = now_(); }
  if (a.day !== day) { a.day = day; a.day_best = 0; }
  var dayBest = score > (a.day_best || 0);
  if (dayBest) a.day_best = score;
  a.last = score;
  saveStudent_(rec);
  return { ok: true, score: score, best: a.best, new_best: newBest, day_best: a.day_best, new_day_best: dayBest,
           board: arcadeBoard_(ctx.cfg, studentClassIds_(rec, ctx.cfg)[0], rec), state: arcadeState_(rec, ctx.cfg) };
}

// ---------------------------------------------------------------- teacher: open and close the arcade for a class
function arcadeTeacher_(cfg, cid) {
  var c = cfg.classes[cid], left = c.arcade_until ? Math.floor((new Date(c.arcade_until).getTime() - Date.now()) / 1000) : 0;
  return { open: left > 0, seconds_left: Math.max(0, left), minutes: DATA.arcade.minutes, board: arcadeBoard_(cfg, cid, null) };
}

/** action: 'open' (for `minutes`, default 60, e.g. until the bell), 'close', or 'gift' (everyone in the class gets
 *  DATA.arcade.minutes of play time). The arcade is closed unless the teacher opens it. */
function arcadeClass(cid, action, minutes) {
  var cfg = teacher_(), c = cfg.classes[cid];
  if (!c) throw new Error('No such class.');
  if (action === 'open') {
    var m = Math.max(5, Math.min(180, Math.round(Number(minutes) || 60)));
    c.arcade_until = new Date(Date.now() + m * 60000).toISOString();
  } else if (action === 'close') c.arcade_until = '';
  else if (action === 'gift') {
    var sum = summary_(true), n = 0;                // fresh: include students who just joined
    classStudents_(cfg, sum, cid).forEach(function (s) {
      var rec = loadStudent_(s.email);
      if (!rec) return;
      openArcade_(rec);
      saveStudent_(rec);
      n += 1;
    });
    var out = arcadeTeacher_(cfg, cid);
    out.gifted = n;
    return out;
  } else throw new Error('Unknown action.');
  saveConfig_(cfg);
  return arcadeTeacher_(cfg, cid);
}
