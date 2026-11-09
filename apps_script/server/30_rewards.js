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

function lessonList_() { return DATA.order.map(function (id) { return DATA.lessons[id]; }); }

function badgeChecks_(rec, cfg) {
  var earned = {}, prog = rec.progress || {}, ids = Object.keys(prog).filter(function (l) { return DATA.lessons[l]; });
  var done = ids.filter(function (l) { return percent_(prog[l], DATA.lessons[l]) === 100; });
  var keys = Object.keys(rec.xp_keys || {});
  var any = function (fn) { return ids.some(function (l) { return fn(prog[l], DATA.lessons[l]); }); };
  var count = function (fn) { return ids.filter(function (l) { return fn(prog[l], DATA.lessons[l]); }).length; };
  if (any(function (p) { var s = p.sections || {}; return Object.keys(s).some(function (k) { return s[k]; }); })) earned['first-spark'] = 1;
  if (any(function (p) { return (p.sections || {}).circuit; })) earned['let-there-be-light'] = 1;
  if (ids.reduce(function (t, l) { return t + (prog[l].sends || 0); }, 0) >= 10) earned['hardware-hacker'] = 1;
  var fixed = count(function (p) { return p.debug_solved; });
  if (fixed >= 1) earned['bug-squasher'] = 1;
  if (fixed >= 5) earned['exterminator'] = 1;
  if (keys.some(function (k) { return k.indexOf('clean_fix:') === 0; })) earned['clean-fix'] = 1;
  if (keys.some(function (k) { return k.indexOf('quiz_perfect:') === 0; })) earned['quiz-whiz'] = 1;
  if (keys.filter(function (k) { return k.indexOf('quiz_first_try:') === 0; }).length >= 3) earned['sharpshooter'] = 1;
  if (count(function (p) { return p.challenge_submitted_at; }) >= 3) earned['inventor'] = 1;
  if (done.length) earned['finisher'] = 1;
  if (count(function (p, L) { return lessonStars_(L, p) === 3; }) >= 5) earned['star-collector'] = 1;
  var units = {};
  ids.forEach(function (l) { units[DATA.lessons[l].unit] = 1; });
  if (Object.keys(units).length >= 3) earned['explorer'] = 1;
  if (rec.avatar) earned['robot-stylist'] = 1;
  Object.keys(DATA.units).forEach(function (u) {
    var inUnit = lessonList_().filter(function (L) { return String(L.unit) === String(u) && L.kind !== 'check'; });
    if (inUnit.length && inUnit.every(function (L) { return done.indexOf(L.id) >= 0; })) earned['unit-' + u] = 1;
  });
  var core = lessonList_().filter(function (L) { return L.unit <= 4 && L.kind !== 'check'; });
  if (core.length && core.every(function (L) { return done.indexOf(L.id) >= 0; })) earned['graduate'] = 1;
  var classes = studentClassIds_(rec, cfg);
  if (classes.length && done.length) {
    cfg.assignments.forEach(function (a) {
      if (classes.indexOf(a.class_id) < 0 || !a.due) return;
      var p = prog[a.lesson_id];
      if (p && p.completed_at && p.completed_at.slice(0, 10) <= a.due) earned['early-bird'] = 1;
    });
  }
  if ((cfg.picks || {})[rec.email]) earned['teachers-pick'] = 1;
  return earned;
}

function award_(rec, key, amount, reason, gained) {
  if (rec.xp_keys[key] !== undefined) return;
  rec.xp_keys[key] = amount;
  rec.xp = (rec.xp || 0) + amount;
  rec.xp_log.unshift({ amount: amount, reason: reason, at: now_() });
  if (rec.xp_log.length > 40) rec.xp_log.length = 40;
  gained.push({ amount: amount, reason: reason });
}

/** Awards any XP and badges the student has earned but not yet received. Never double-counts. */
function syncRewards_(rec, cfg) {
  var before = levelInfo_(rec.xp || 0), gained = [], X = DATA.xp, labels = DATA.section_labels;
  rec.xp_keys = rec.xp_keys || {}; rec.xp_log = rec.xp_log || []; rec.badges = rec.badges || {};
  Object.keys(rec.progress || {}).forEach(function (lid) {
    var L = DATA.lessons[lid], p = rec.progress[lid];
    if (!L) return;
    var s = p.sections || {};
    L.section_keys.forEach(function (k) {
      if (s[k]) award_(rec, k + ':' + lid, X[k], labels[k] + ' · ' + L.title, gained);
    });
    if (p.debug_solved && !(p.debug_hints_used || 0)) award_(rec, 'clean_fix:' + lid, X.clean_fix, labels.clean_fix + ' · ' + L.title, gained);
    if (p.quiz_total && p.quiz_best === p.quiz_total) {
      award_(rec, 'quiz_perfect:' + lid, X.quiz_perfect, labels.quiz_perfect + ' · ' + L.title, gained);
      if (p.quiz_attempts === 1) award_(rec, 'quiz_first_try:' + lid, X.quiz_first_try, labels.quiz_first_try + ' · ' + L.title, gained);
    }
    if (percent_(p, L) === 100) award_(rec, 'complete:' + lid, X.complete, labels.complete + ' · ' + L.title, gained);
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

function badgeList_(rec) {
  return DATA.badges.map(function (b) {
    var at = (rec.badges || {})[b[0]];
    return { id: b[0], icon: b[1], name: b[2], desc: b[3], earned: !!at, earned_at: at || null };
  });
}

// ---------------------------------------------------------------- map
/** Lessons a student must do because their class assigned them (choice branches only once started). */
function assignedIds_(rec, cfg) {
  var classes = studentClassIds_(rec, cfg), out = {};
  cfg.assignments.forEach(function (a) { if (classes.indexOf(a.class_id) >= 0 && !a.branch) out[a.lesson_id] = 1; });
  return out;
}

function mapData_(rec, assigned) {
  var prog = (rec && rec.progress) || {}, complete = {}, nodes = [], current = null;
  lessonList_().forEach(function (L) { if (prog[L.id] && percent_(prog[L.id], L) === 100) complete[L.id] = 1; });
  var recent = Object.keys(prog).filter(function (l) { return DATA.lessons[l] && !complete[l]; })
    .sort(function (a, b) { return String(prog[b].updated_at || '').localeCompare(String(prog[a].updated_at || '')); });
  if (recent.length) current = recent[0];
  lessonList_().forEach(function (L) {
    var t = DATA.tree[L.id];
    if (!t) return;
    var p = prog[L.id], pct = p ? percent_(p, L) : 0;
    var reqs = t.requires.filter(function (r) { return DATA.lessons[r]; });
    var also = (t.or_after || []).filter(function (r) { return DATA.lessons[r]; });
    var unlocked = reqs.every(function (r) { return complete[r]; }) || also.some(function (r) { return complete[r]; }) || assigned[L.id] || pct > 0;
    var state = complete[L.id] ? 'complete' : pct > 0 ? 'progress' : unlocked ? 'open' : 'locked';
    nodes.push({ id: L.id, number: L.number, title: L.title, unit: L.unit, x: t.pos[0], y: t.pos[1], requires: reqs,
                 requires_titles: reqs.filter(function (r) { return !complete[r]; }).map(function (r) { return DATA.lessons[r].title; }),
                 or_titles: also.map(function (r) { return DATA.lessons[r].title; }),
                 state: state, pct: pct, stars: lessonStars_(L, p), assigned: !!assigned[L.id], xp_possible: L.possible_xp });
  });
  if (!current) {
    var open = nodes.filter(function (n) { return n.state === 'open'; })[0];
    current = open ? open.id : (nodes.length ? nodes[nodes.length - 1].id : null);
  }
  return { nodes: nodes, current: current, units: DATA.units };
}

// ---------------------------------------------------------------- avatars
function avatarOf_(rec) {
  var a = JSON.parse(JSON.stringify(DATA.default_avatar));
  if (rec && rec.avatar) Object.keys(a).forEach(function (k) { if (rec.avatar[k] !== undefined) a[k] = rec.avatar[k]; });
  return a;
}
function unlockText_(u) {
  if (!u) return '';
  return u[0] === 'level' ? 'Reach level ' + u[1] : 'Earn the ' + badgeById_(u[1]).name + ' badge';
}
function isUnlocked_(u, level, badges) {
  if (!u) return true;
  return u[0] === 'level' ? level >= u[1] : !!badges[u[1]];
}
function avatarCatalog_(rec, teacher) {
  var level = levelInfo_((rec && rec.xp) || 0).level, badges = (rec && rec.badges) || {}, out = {};
  Object.keys(DATA.avatar_options).forEach(function (part) {
    out[part] = DATA.avatar_options[part].map(function (o) {
      return { id: o[0], label: o[1], unlocked: teacher || isUnlocked_(o[2], level, badges), how: unlockText_(o[2]) };
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
    if (!teacher && !isUnlocked_(match[2], level, rec.badges || {})) return { error: match[1] + ' is still locked: ' + unlockText_(match[2]) + '.' };
    out[part] = choice;
  }
  var name = String(data.name || '').trim();
  if (!/^[A-Za-z0-9 .\-_!']{0,20}$/.test(name)) return { error: 'Robot names can be up to 20 letters, numbers and spaces.' };
  out.name = name;
  return { avatar: out };
}
