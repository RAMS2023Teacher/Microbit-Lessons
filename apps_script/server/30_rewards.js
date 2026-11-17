// ---------------------------------------------------------------- XP, levels, badges, map, avatars
// A JavaScript copy of app/gamify.py. The numbers (XP values, levels, badges, map, avatar parts)
// come from gamify.py through the build, so there is still one place to change them.

function levelInfo_(xp) {
  var levels = DATA.levels, lvl = 1;
  for (var i = 0; i < levels.length; i++) if (xp >= levels[i][0]) lvl = i + 1;
  var floor = levels[lvl - 1][0], next = lvl < levels.length ? levels[lvl][0] : null;
  return { level: lvl, title: levels[lvl - 1][1], xp: xp, floor: floor, next: next,
           pct: next === null ? 100 : Math.round(100 * (xp - floor) / (next - floor)), max: next === null };
}

function badgeById_(id) {
  for (var i = 0; i < DATA.badges.length; i++) {
    var b = DATA.badges[i];
    if (b[0] === id) return { id: b[0], icon: b[1], name: b[2], desc: b[3] };
  }
  return null;
}

function lessonList_() { return DATA.order.filter(function (id) { return DATA.lessons[id]; }).map(function (id) { return DATA.lessons[id]; }); }

function complete_(L, p) { return !!p && percent_(p, L) === 100; }

/** Counts the badge rules in course/rules.py look at. */
function rewardCounts_(rec) {
  var c = { steps: 0, lessons: 0, wired: 0, perfect: 0, first_try: 0, extensions: 0, shipped: 0, partner: 0, done: {} };
  Object.keys(rec.progress || {}).forEach(function (lid) {
    var L = DATA.lessons[lid], p = rec.progress[lid];
    if (!L || !p) return;
    c.steps += stepsDone_(L, p);
    if (quizPerfect_(p)) { c.perfect++; if (p.quiz_attempts === 1) c.first_try++; }
    c.extensions += Object.keys(p.ext || {}).filter(function (k) { return p.ext[k]; }).length;
    if (p.shipped_at) c.shipped++;
    if (complete_(L, p)) {
      c.lessons++; c.done[lid] = 1;
      if (L.wired) c.wired++;
      if (p.partner) c.partner++;
    }
  });
  return c;
}

function badgeChecks_(rec, cfg) {
  var c = rewardCounts_(rec), earned = {};
  DATA.badges.forEach(function (b) {
    var rule = b[4] || [], ok = false;
    if (rule[0] === 'lesson') ok = !!c.done[rule[1]];
    else if (rule[0] === 'avatar') ok = !!rec.avatar;
    else if (rule[0] === 'teacher') ok = !!(cfg.picks || {})[rec.email];
    else if (rule[0] === 'early') {
      var classes = studentClassIds_(rec, cfg);
      ok = cfg.assignments.some(function (a) {
        var p = (rec.progress || {})[a.lesson_id];
        return classes.indexOf(a.class_id) >= 0 && a.due && p && p.completed_at && p.completed_at.slice(0, 10) <= a.due;
      });
    } else if (c[rule[0]] !== undefined) ok = c[rule[0]] >= rule[1];
    if (ok) earned[b[0]] = 1;
  });
  return earned;
}

function award_(rec, key, amount, reason, gained) {
  if (rec.xp_keys[key] !== undefined) return;
  rec.xp_keys[key] = amount;
  rec.xp = (rec.xp || 0) + amount;
  rec.xp_log.unshift({ amount: amount, reason: reason, at: now_(), key: key });
  if (rec.xp_log.length > 100) rec.xp_log.length = 100;
  gained.push({ amount: amount, reason: reason });
}

/** Awards any XP and badges the student has earned but not yet received. Never double-counts. */
function syncRewards_(rec, cfg) {
  var before = levelInfo_(rec.xp || 0), gained = [], X = DATA.xp, T = DATA.labels;
  rec.xp_keys = rec.xp_keys || {}; rec.xp_log = rec.xp_log || []; rec.badges = rec.badges || {};
  Object.keys(rec.progress || {}).forEach(function (lid) {
    var L = DATA.lessons[lid], p = rec.progress[lid];
    if (!L || !p) return;
    var t = ' · ' + L.title;
    if (p.mission_done) award_(rec, 'mission:' + lid, X.mission, T.mission + t, gained);
    for (var i = 0; i < L.build.length; i++) if (stepDone_(L, p, i)) award_(rec, 'step_' + i + ':' + lid, X.step, T.step + ': ' + L.build[i].title, gained);
    if (quizPassed_(L, p)) award_(rec, 'quiz:' + lid, X.quiz, T.quiz + t, gained);
    if (quizPerfect_(p)) {
      award_(rec, 'quiz_perfect:' + lid, X.quiz_perfect, T.quiz_perfect + t, gained);
      if (p.quiz_attempts === 1) award_(rec, 'quiz_first_try:' + lid, X.quiz_first_try, T.quiz_first_try + t, gained);
    }
    Object.keys(p.ext || {}).forEach(function (k) {
      var E = ((L.ship || {}).extensions || [])[+k];
      if (p.ext[k] && E) award_(rec, 'ext_' + k + ':' + lid, X.extension, T.extension + ': ' + E.title, gained);
    });
    if (p.shipped_at) award_(rec, 'ship:' + lid, X.ship, T.ship + t, gained);
    if (complete_(L, p)) {
      if (rec.xp_keys['complete:' + lid] === undefined) openArcade_(rec);     // a finished lesson opens Robot Rush for a few minutes
      award_(rec, 'complete:' + lid, X.complete, T.complete + t, gained);
    }
  });
  ((cfg.bonuses || {})[rec.email] || []).forEach(function (b) { award_(rec, b.key, b.amount, b.reason, gained); });
  var newBadges = [], earned = badgeChecks_(rec, cfg);
  Object.keys(earned).sort().forEach(function (bid) {
    if (rec.badges[bid]) return;
    var b = badgeById_(bid);
    if (!b) return;
    rec.badges[bid] = now_();
    award_(rec, 'badge:' + bid, X.badge, 'Badge: ' + b.name, gained);
    newBadges.push(b);
  });
  var after = levelInfo_(rec.xp || 0);
  return { xp_gained: gained.reduce(function (t, g) { return t + g.amount; }, 0), items: gained.slice(0, 6),
           badges: newBadges, level: after, level_up: after.level > before.level };
}

function lessonXp_(rec, lid) {
  var total = 0;
  Object.keys(rec.xp_keys || {}).forEach(function (k) {
    var i = k.indexOf(':');
    if (i > 0 && k.slice(i + 1) === lid) total += rec.xp_keys[k];
  });
  return total;
}

function possibleXp_(L) {
  var X = DATA.xp;
  return X.mission + X.step * L.build.length + X.quiz + X.quiz_perfect + X.quiz_first_try +
    X.extension * ((L.ship || {}).extensions || []).length + X.ship + X.complete;
}

function badgeList_(rec) {
  return DATA.badges.map(function (b) {
    var at = (rec.badges || {})[b[0]];
    return { id: b[0], icon: b[1], name: b[2], desc: b[3], earned: !!at, earned_at: at || null };
  });
}

// ---------------------------------------------------------------- the skill tree
/** Lessons a student's class assigned. */
function assignedIds_(rec, cfg) {
  var classes = studentClassIds_(rec, cfg), out = {};
  cfg.assignments.forEach(function (a) { if (classes.indexOf(a.class_id) >= 0) out[a.lesson_id] = 1; });
  return out;
}

var COLOR_UNIT_ = { blue: 1, gold: 2, green: 3, red: 4, purple: 5, teal: 6, orange: 7, pink: 4 };

function mapData_(rec, assigned) {
  var prog = (rec && rec.progress) || {}, complete = {}, nodes = [], current = null;
  DATA.course.forEach(function (c) { var L = DATA.lessons[c.id]; if (L && complete_(L, prog[c.id])) complete[c.id] = 1; });
  var recent = Object.keys(prog).filter(function (l) { return DATA.lessons[l] && !complete[l]; })
    .sort(function (a, b) { return String(prog[b].updated_at || '').localeCompare(String(prog[a].updated_at || '')); });
  if (recent.length) current = recent[0];
  DATA.course.forEach(function (c, i) {
    var L = DATA.lessons[c.id], p = prog[c.id], pct = L && p ? percent_(p, L) : 0;
    var reqs = DATA.requires[c.id] || [];
    var unlocked = !reqs.length || reqs.some(function (r) { return complete[r]; }) || assigned[c.id] || pct > 0;
    var state = !L ? 'locked' : complete[c.id] ? 'complete' : pct > 0 ? 'progress' : unlocked ? 'open' : 'locked';
    nodes.push({ id: c.id, number: c.number, title: c.title, unit: COLOR_UNIT_[c.color] || 1, x: c.pos[0], y: c.pos[1],
                 requires: i === 0 ? [] : reqs,
                 requires_titles: !L ? ['Coming soon'] : reqs.filter(function (r) { return !complete[r]; }).map(function (r) { return DATA.course_by_id[r].title; }),
                 or_titles: reqs.length > 1 ? reqs.map(function (r) { return DATA.course_by_id[r].title; }) : [],
                 state: state, pct: pct, stars: L ? lessonStars_(L, p) : 0, assigned: !!assigned[c.id],
                 xp_possible: L ? possibleXp_(L) : 0, soon: !L });
  });
  if (!current) {
    var open = nodes.filter(function (n) { return n.state === 'open'; })[0];
    current = open ? open.id : (nodes.length ? nodes[0].id : null);
  }
  return { nodes: nodes, current: current, units: {} };
}

// ---------------------------------------------------------------- avatars
function avatarOf_(rec) {
  var a = JSON.parse(JSON.stringify(DATA.default_avatar));
  if (rec && rec.avatar) Object.keys(a).forEach(function (k) { if (rec.avatar[k] !== undefined) a[k] = rec.avatar[k]; });
  return a;
}
function unlockText_(u) {
  if (!u) return '';
  if (u[0] === 'cost') return 'Buy it for ' + u[1] + ' XP';
  return u[0] === 'level' ? 'Reach level ' + u[1] : 'Earn the ' + badgeById_(u[1]).name + ' badge';
}
function isUnlocked_(u, level, badges, owned, part, id) {
  if (!u) return true;
  if (u[0] === 'cost') return !!(owned || {})['part:' + part + ':' + id];
  return u[0] === 'level' ? level >= u[1] : !!badges[u[1]];
}
function avatarCatalog_(rec, teacher) {
  var level = levelInfo_((rec && rec.xp) || 0).level, badges = (rec && rec.badges) || {}, owned = (rec && rec.owned) || {}, out = {};
  Object.keys(DATA.avatar_options).forEach(function (part) {
    out[part] = DATA.avatar_options[part].map(function (o) {
      return { id: o[0], label: o[1], unlocked: teacher || isUnlocked_(o[2], level, badges, owned, part, o[0]), how: unlockText_(o[2]),
               cost: o[2] && o[2][0] === 'cost' ? o[2][1] : 0 };
    });
  });
  return out;
}
function cleanAvatar_(rec, data, teacher) {
  var level = levelInfo_(rec.xp || 0).level, out = {};
  var parts = Object.keys(DATA.avatar_options);
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i], choice = data[part] === undefined ? DATA.default_avatar[part] : data[part];
    var match = DATA.avatar_options[part].filter(function (o) { return o[0] === choice; })[0];
    if (!match) return { error: 'Unknown ' + part };
    if (!teacher && !isUnlocked_(match[2], level, rec.badges || {}, rec.owned, part, choice)) return { error: match[1] + ' is still locked: ' + unlockText_(match[2]) + '.' };
    out[part] = choice;
  }
  var name = String(data.name || '').trim();
  if (!/^[A-Za-z0-9 .\-_!']{0,20}$/.test(name)) return { error: 'Robot names can be up to 20 letters, numbers and spaces.' };
  out.name = name;
  return { avatar: out };
}
