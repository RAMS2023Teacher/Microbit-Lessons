/* Draws the pages whose content depends on live data. The markup and CSS classes match the
 * Flask templates in app/templates, so the site looks the same in Apps Script. */
(function () {
  'use strict';
  var ML = window.ML, d = ML.data || {}, E = ML.esc, main = document.getElementById('main');
  var A = ML.avatarAttr;
  var due = function (s) {
    if (!s) return '';
    var dt = new Date(s + 'T12:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  var shortDate = function (iso) { return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''; };
  var flash = function (msg, cat) {
    var box = document.createElement('div');
    box.className = 'flashes';
    box.innerHTML = '<div class="flash ' + (cat || 'info') + '"></div>';
    box.firstChild.textContent = msg;
    main.insertBefore(box, main.firstChild);
    window.scrollTo(0, 0);
  };
  // Run a teacher or student action, then reload the page (or show the error)
  var act = function (btn, name, args, then) {
    if (btn) btn.disabled = true;
    return ML.run.apply(null, [name].concat(args)).then(function (r) {
      if (then) then(r); else window.top.location.reload();
    }).catch(function (e) { if (btn) btn.disabled = false; flash((e && e.message) || 'Something went wrong.', 'error'); });
  };
  var levelLine = function (lv) {
    return lv.xp + ' XP' + (lv.max ? '' : ' · ' + (lv.next - lv.xp) + ' to level ' + (lv.level + 1));
  };
  var meter = function (pct) { return '<span class="meter" title="' + pct + '% done"><i style="width:' + pct + '%"></i></span>'; };

  var pages = {};

  pages.error = function () {
    main.innerHTML = '<div class="card center"><h1>Hmm</h1><p></p><a class="btn" href="/">Go home</a></div>';
    main.querySelector('p').textContent = d.message;
  };

  pages.join = function () {
    main.innerHTML = '<div class="auth-card card"><h1>Join your class</h1>' +
      '<p class="muted">Your teacher will give you a 6-letter class code. You only do this once.</p>' +
      '<label class="field"><span>Class code</span><input id="j-code" maxlength="10" style="text-transform:uppercase;letter-spacing:.2em" autocomplete="off"></label>' +
      '<label class="field"><span>Your name (first name + last initial)</span><input id="j-name" maxlength="40" placeholder="Sam K." value="' + E(d.name) + '"></label>' +
      '<button class="btn wide" id="j-go" type="button">Join</button><p class="bad" id="j-msg" role="status"></p></div>';
    document.getElementById('j-go').addEventListener('click', function () {
      var b = this;
      b.disabled = true;
      ML.run('joinClass', document.getElementById('j-code').value, document.getElementById('j-name').value)
        .then(function () { ML.go('/'); })
        .catch(function (e) { b.disabled = false; document.getElementById('j-msg').textContent = e.message; });
    });
  };

  pages.dashboard = function () {
    var lv = d.level, h = [];
    h.push('<section class="card hero-card"><a class="hero-avatar" href="/me" title="Customize your robot"><span data-avatar="' + A(d.avatar) +
      '" data-size="110"></span><small>✏️ Customize</small></a><div class="hero-card-main"><h1>Hi ' + E(d.name) + ' 👋</h1>');
    if (d.avatar && d.avatar.name) h.push('<p class="muted">…and your robot <b>' + E(d.avatar.name) + '</b></p>');
    h.push('<div class="level-line"><b>Level ' + lv.level + ' · ' + E(lv.title) + '</b> <span class="muted small">' + levelLine(lv) + '</span></div>' +
      '<div class="xpbar big"><i style="width:' + lv.pct + '%"></i></div><div class="row"><a class="btn" href="/map">🗺️ Open the Maker Map</a>' +
      '<a class="btn ghost" href="/me">🏅 Badges (' + d.badges.length + (d.badges.length >= 6 ? '+' : '') + ' / ' + d.badge_total + ')</a></div></div><div class="hero-badges">');
    if (d.badges.length) d.badges.forEach(function (b) { h.push('<span class="mini-badge" title="' + E(b.name + ': ' + b.desc) + '">' + E(b.icon) + '</span>'); });
    else h.push('<span class="muted small">Earn badges by finishing lessons!</span>');
    h.push('</div></section><div class="grid-2"><section class="card"><h2>My assignments</h2>');
    if (d.rows.length) {
      h.push('<ul class="assign-list">');
      d.rows.forEach(function (r) {
        h.push('<li class="' + (r.overdue ? 'overdue' : '') + '"><a href="/lessons/' + E(r.lesson.id) + '"><span class="lesson-num">' + E(r.lesson.number) +
          '</span><span class="grow"><b>' + E(r.lesson.title) + '</b><small class="muted">' + E(r.class_name) + (r.due ? ' · due ' + E(due(r.due)) : '') +
          (r.overdue ? ' · <span class="bad">overdue</span>' : '') + '</small>' + (r.note ? '<small class="note">📌 ' + E(r.note) + '</small>' : '') +
          (r.feedback ? '<small class="note">💬 Teacher feedback waiting</small>' : '') + '</span>' + meter(r.pct) + '<span class="pct">' + r.pct + '%</span></a></li>');
      });
      h.push('</ul>');
    } else h.push('<p class="muted">No assignments yet. You can still explore any lesson in the <a href="/lessons">lesson library</a>.</p>');
    h.push('</section><aside>');
    if (d.recent.length) {
      h.push('<section class="card"><h2>Pick up where you left off</h2>');
      d.recent.forEach(function (r) { h.push('<a class="resume" href="/lessons/' + E(r.lesson.id) + '"><b>' + E(r.lesson.title) + '</b><span>' + r.pct + '%</span></a>'); });
      h.push('</section>');
    }
    h.push('<section class="card"><h2>My classes</h2><ul>' + d.classes.map(function (c) { return '<li>' + E(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="inline-form"><input id="join-code" placeholder="Class code" maxlength="10"><button class="btn small" id="join-go" type="button">Join</button></div></section>' +
      '<section class="card tip"><h2>Getting code onto your micro:bit</h2><p>In any lesson, click <b>⬇ Download .hex</b> under the code.</p>' +
      '<p>Open the <b>Files</b> app, then drag the .hex file onto the <b>MICROBIT</b> drive. The light on the back blinks while it copies, then your code runs.</p></section></aside></div>');
    main.innerHTML = h.join('');
    document.getElementById('join-go').addEventListener('click', function () {
      act(this, 'joinClass', [document.getElementById('join-code').value, '']);
    });
  };

  pages.catalog = function () {
    var count = d.units.reduce(function (t, u) { return t + u.lessons.length; }, 0), h = [];
    h.push('<h1>Lesson library</h1><p class="muted">' + count + ' lessons · each designed for about 35 minutes.</p>');
    d.units.forEach(function (u) {
      h.push('<section class="unit-block"><h2><span class="unit-num">Unit ' + u.number + '</span> ' + E(u.title) + '</h2><p class="muted">' + E(u.blurb) + '</p><div class="lesson-cards">');
      u.lessons.forEach(function (l) {
        h.push('<a class="lesson-card card" href="/lessons/' + E(l.id) + '"><div class="lesson-num">' + E(l.number) + '</div><h3>' + E(l.title) + '</h3><p>' + E(l.subtitle || '') +
          '</p><div class="tags"><span class="tag">⏱ ' + l.duration_minutes + ' min</span>' + (l.circuit ? '<span class="tag">⚡ circuit</span>' : '') +
          (l.lab ? '<span class="tag">🤖 AI lab</span>' : '') + '<span class="tag">' + E(l.level || '') + '</span>' +
          (l.standards || []).slice(0, 3).map(function (c) { return '<span class="tag std">' + E(c) + '</span>'; }).join('') + '</div>' +
          (d.pct && d.pct[l.id] !== undefined ? '<span class="meter"><i style="width:' + d.pct[l.id] + '%"></i></span>' : '') + '</a>');
      });
      h.push('</div></section>');
    });
    main.innerHTML = h.join('');
  };

  pages.map = function () {
    main.className = 'container wide';
    var lv = d.level, h = ['<div class="page-head"><div><h1>Maker Map</h1><p class="muted">Follow the circuit from your first blink to a radio-controlled robot. ' +
      'Finish a lesson to send power down the paths after it. The Robot Sprint on the right can start any time, then splits into three branches.</p></div>'];
    if (!ML.teacher) h.push('<a class="level-chip card" href="/me"><span data-avatar="' + A(d.avatar) + '" data-size="52"></span><span><b>Level ' + lv.level + ' · ' +
      E(lv.title) + '</b><span class="xpbar"><i style="width:' + lv.pct + '%"></i></span><small class="muted">' + levelLine(lv) + '</small></span></a>');
    h.push('</div><div class="map-layout"><div class="map-scroll card"><div class="map" id="map" aria-label="Lesson map"></div></div><aside class="map-side">' +
      '<div class="card map-detail" id="map-detail" aria-live="polite"></div><div class="card map-legend"><h3>Legend</h3><ul>' +
      '<li><span class="dot complete"></span> Complete</li><li><span class="dot progress"></span> In progress</li><li><span class="dot open"></span> Unlocked — ready to go</li>' +
      '<li><span class="dot locked"></span> Locked</li><li>📌 Assigned by your teacher</li><li>★ The 3 star lights on a chip: bug fixed · perfect quiz · challenge done</li></ul><h3>Units</h3><ul>' +
      Object.keys(d.map.units).map(function (n) { return '<li><span class="dot unit-' + n + '"></span> ' + E(d.map.units[n].title) + '</li>'; }).join('') + '</ul></div></aside></div>');
    main.innerHTML = h.join('');
    window.MAP = d.map;
    window.ME = ML.teacher ? null : d.avatar;
    window.LESSON_URL = '/lessons/__ID__';
    if (window.__runMap) window.__runMap();
  };

  pages.profile = function () {
    var lv = d.level, h = [];
    h.push('<h1>My robot &amp; badges</h1><div class="profile-grid"><section class="card builder-card"><h2>Build your robot</h2><div class="avatar-builder"><div class="avatar-stage">' +
      '<div id="avatar-preview"></div><label class="field"><span>Robot name</span><input id="avatar-name" maxlength="20" placeholder="e.g. Sparky" value="' + E(d.avatar.name) + '"></label>' +
      '<button type="button" class="btn wide" id="avatar-save">Save my robot</button><button type="button" class="btn ghost wide small" id="avatar-random">🎲 Surprise me</button>' +
      '<p class="save-status small" id="avatar-status" role="status"></p></div><div class="avatar-parts"><div class="part-tabs" role="tablist">');
    Object.keys(d.parts).forEach(function (k, i) { h.push('<button type="button" role="tab" class="part-tab' + (i ? '' : ' active') + '" data-part="' + E(k) + '">' + E(d.parts[k]) + '</button>'); });
    h.push('</div><div class="part-options" id="part-options"></div><p class="muted small">🔒 Locked parts unlock as you level up and earn badges.</p></div></div></section>' +
      '<section class="card level-card"><h2>Level ' + lv.level + ': ' + E(lv.title) + '</h2><div class="xpbar big"><i style="width:' + lv.pct + '%"></i></div><p class="muted">' +
      lv.xp + ' XP' + (lv.max ? ' · max level!' : ' · ' + (lv.next - lv.xp) + ' XP to level ' + (lv.level + 1)) + '</p><ol class="level-ladder">');
    d.levels.forEach(function (l, i) {
      h.push('<li class="' + (lv.xp >= l[0] ? 'reached' : '') + (i + 1 === lv.level ? ' here' : '') + '"><b>' + (i + 1) + '</b> ' + E(l[1]) + ' <small>' + l[0] + ' XP</small></li>');
    });
    var x = d.xp_table;
    h.push('</ol><details><summary>How do I earn XP?</summary><table class="xp-table">' +
      [['Warm-up answered', x.warmup], ['Learn cards read', x.learn], ['Circuit built (every step checked)', x.circuit], ['Code ran', x.code],
       ['Bug fixed', x.debug + ' (+' + x.clean_fix + ' with no hints)'], ['Quiz done', x.quiz + ' (+' + x.quiz_perfect + ' perfect, +' + x.quiz_first_try + ' perfect first try)'],
       ['Challenge submitted', x.challenge], ['Whole lesson complete', x.complete], ['Every badge', x.badge]]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td>+' + r[1] + '</td></tr>'; }).join('') + '</table></details></section></div>');
    var earned = d.badges.filter(function (b) { return b.earned; }).length;
    h.push('<section class="card"><h2>Badges <small class="muted">' + earned + ' / ' + d.badges.length + '</small></h2><div class="badge-grid">');
    d.badges.forEach(function (b) {
      h.push('<div class="badge-tile' + (b.earned ? '' : ' locked') + '" title="' + E(b.desc) + '"><span class="badge-icon">' + (b.earned ? E(b.icon) : '🔒') + '</span><b>' +
        E(b.name) + '</b><small>' + E(b.desc) + '</small>' + (b.earned ? '<small class="earned">Earned ' + shortDate(b.earned_at) + '</small>' : '') + '</div>');
    });
    h.push('</div></section><section class="card"><h2>Recent XP</h2><ul class="xp-history">');
    if (d.history.length) d.history.slice(0, 15).forEach(function (e) { h.push('<li><b>+' + e.amount + '</b> ' + E(e.reason) + ' <small class="muted">' + shortDate(e.at) + '</small></li>'); });
    else h.push('<li class="muted">No XP yet — start a lesson on the <a href="/map">map</a>!</li>');
    h.push('</ul></section>');
    main.innerHTML = h.join('');
    window.AVATAR = d.avatar;
    window.CATALOG = d.catalog;
    if (window.__runProfile) window.__runProfile();
  };

  pages.playground = function () {
    var root = document.getElementById('ed-play');
    if (!root || !window.MakerEditor) return;
    var ed = window.MakerEditor.mount(root, {});
    try { var saved = localStorage.getItem('playground-code'); if (saved) ed.setCode(saved); } catch (e) { /* no storage */ }
    ed.onChange(function (code) { try { localStorage.setItem('playground-code', code); } catch (e) { /* no storage */ } });
  };

  // ---------------------------------------------------------------- teacher pages
  pages['teacher-home'] = function () {
    var h = ['<h1>My classes</h1><div class="class-cards">'];
    d.classes.forEach(function (c) {
      h.push('<a class="card class-card" href="/teacher/classes/' + E(c.id) + '"><h2>' + E(c.name) + '</h2><div class="join-code small">Code <b>' + E(c.code) +
        '</b></div><p class="muted">' + c.students + ' students · ' + c.assignments + ' assignments' + (c.classroom ? '<br>🔗 Google Classroom' : '') + '</p></a>');
    });
    var linked = d.classes.filter(function (c) { return c.classroom; }).length;
    h.push('<div class="card class-card new"><h2>+ New class</h2><input id="new-class" placeholder="e.g. Period 3 Makers" maxlength="80"><button class="btn" id="new-go" type="button">Create</button></div>' +
      '<div class="card class-card new"><h2>🔗 Google Classroom</h2><p class="muted small">Bring in your Classroom classes and their students. No join codes needed.</p>' +
      '<a class="btn" href="/teacher/google-import">Import classes</a>' + (linked ? ' <button class="btn ghost small" id="gc-sync-all" type="button">Update all rosters</button>' : '') + '</div></div>' +
      '<section class="card tip"><h2>Getting started</h2><ol><li><b>Import classes</b> from Google Classroom, or create a class. Each class also gets a 6-letter <b>join code</b>.</li>' +
      '<li>Share this page\'s web address with students. Students on an imported roster are already in. Anyone else types the code and their name once. No passwords.</li>' +
      '<li>Assign lessons with due dates. The gradebook shows who\'s done what.</li><li>Open any lesson to see the <b>teacher answer key</b>. Add videos on the <a href="/teacher/videos">Videos</a> page.</li></ol></section>');
    main.innerHTML = h.join('');
    document.getElementById('new-go').addEventListener('click', function () {
      act(this, 'createClass', [document.getElementById('new-class').value], function (c) { ML.go('/teacher/classes/' + c.id); });
    });
    var all = document.getElementById('gc-sync-all');
    if (all) all.addEventListener('click', function () {
      act(this, 'syncAllClassroom', [], function (r) { alert(syncReport(r.classes)); window.top.location.reload(); });
    });
  };

  var syncReport = function (list) {
    return list.map(function (c) {
      if (c.error) return c.name + ': ' + c.error;
      return c.name + ': ' + c.students + ' students' + (c.added ? ', ' + c.added + ' new' : '') + (c.left ? ', ' + c.left + ' left' : '') +
        (c.missing ? '. ' + c.missing + ' had no email shared by Classroom (they can still join with the code)' : '');
    }).join('\n') || 'Nothing to update.';
  };

  pages['gc-import'] = function () {
    var h = ['<a class="muted small" href="/">← My classes</a><h1>Import from Google Classroom</h1>'];
    if (d.problem) {
      h.push('<section class="card"><p class="bad">' + E(d.problem) + '</p><p class="muted small">After fixing it, deploy a new version and reload this page.</p></section>');
      main.innerHTML = h.join('');
      return;
    }
    if (!d.courses.length) {
      h.push('<section class="card"><p>No active Google Classroom classes where you are a teacher.</p></section>');
      main.innerHTML = h.join('');
      return;
    }
    h.push('<section class="card"><p class="muted">Pick what each Classroom class becomes in Maker Lab. Students on the roster are in the class ' +
      'the first time they open Maker Lab, with the name from Classroom. Nothing is changed in Google Classroom.</p>' +
      '<div class="table-scroll"><table class="gradebook"><thead><tr><th>Google Classroom class</th><th>In Maker Lab</th></tr></thead><tbody>');
    d.courses.forEach(function (c) {
      var opts = '<option value="">Skip</option><option value="new"' + (c.linked ? '' : '') + '>New Maker Lab class</option>';
      d.classes.forEach(function (k) { opts += '<option value="' + E(k.id) + '"' + (c.linked === k.id ? ' selected' : '') + '>Link to: ' + E(k.name) + '</option>'; });
      h.push('<tr><th class="who"><span><b>' + E(c.name) + '</b>' + (c.section ? '<small>' + E(c.section) + '</small>' : '') + '</span></th>' +
        '<td><select class="gc-pick" data-id="' + E(c.id) + '">' + opts + '</select>' + (c.linked ? ' <small class="muted">already linked</small>' : '') + '</td></tr>');
    });
    h.push('</tbody></table></div><button class="btn" id="gc-go" type="button">Import</button></section>');
    main.innerHTML = h.join('');
    document.getElementById('gc-go').addEventListener('click', function () {
      var choices = Array.prototype.map.call(document.querySelectorAll('.gc-pick'), function (x) { return { course_id: x.dataset.id, target: x.value }; })
        .filter(function (c) { return c.target; });
      if (!choices.length) { flash('Pick at least one class to import.', 'error'); return; }
      act(this, 'importClassroom', [choices], function (r) { alert(syncReport(r.classes)); ML.go('/'); });
    });
  };

  pages.classroom = function () {
    main.className = 'container wide';
    var c = d.cls, h = [];
    h.push('<div class="page-head"><div><a class="muted small" href="/">← My classes</a><h1>' + E(c.name) + '</h1></div>' +
      '<div class="row"><a class="btn ghost" href="/teacher/classes/' + E(c.id) + '/google-classroom">Google Classroom grades</a></div>' +
      '<div class="join-code">Join code <b>' + E(c.code) + '</b><small>' + E(d.url) + '</small></div></div>');
    if (c.classroom) {
      h.push('<section class="card tip gc-link"><b>🔗 Linked to Google Classroom:</b> ' + E(c.classroom.name) + (c.classroom.section ? ' (' + E(c.classroom.section) + ')' : '') +
        ' <small class="muted">roster updated ' + E(shortDate(c.classroom.synced_at)) + '</small> ' +
        '<button class="btn small" id="gc-sync" type="button">Update roster</button> <button class="linklike small" id="gc-unlink" type="button">unlink</button>' +
        (c.classroom.missing ? '<p class="small bad">' + c.classroom.missing + ' student(s) had no email shared by Classroom. They can join with the code above.</p>' : '') +
        '<p class="muted small">Students on the roster just open the web address above, signed in to their school account. No code needed.</p></section>');
    }
    h.push('<section class="card"><h2>Gradebook</h2>');
    if (!d.students.length) h.push('<p class="muted">No students yet. Share the web address above and the code <b>' + E(c.code) + '</b>.</p>');
    else if (!d.cols.length) h.push('<p class="muted">No assignments yet — assign lessons below.</p>');
    else {
      h.push('<div class="table-scroll"><table class="gradebook"><thead><tr><th>Student</th>');
      d.cols.forEach(function (a) { h.push('<th title="' + E(a.title) + '">' + E(a.number) + '. ' + E(a.title) + (a.due ? '<small>due ' + E(due(a.due)) + '</small>' : '') + '</th>'); });
      h.push('</tr></thead><tbody>');
      d.students.forEach(function (s) {
        var link = '/teacher/classes/' + E(c.id) + '/students/' + encodeURIComponent(s.email);
        h.push('<tr' + (s.not_yet ? ' class="muted"' : '') + '><th class="who"><span data-avatar="' + A(s.avatar || {}) + '" data-size="34"></span><span><a href="' + link + '">' + E(s.name) + '</a><small>' +
          (s.not_yet ? 'hasn\'t opened Maker Lab yet' : 'Lv ' + s.level + ' · ' + (s.xp || 0) + ' XP') + '</small></span></th>');
        d.cols.forEach(function (a) {
          var cell = d.grid[s.email + '|' + a.id];
          if (cell.status === 'other-branch') { h.push('<td class="cell other-branch" title="This student didn\'t pick this branch">—</td>'); return; }
          h.push('<td class="cell ' + cell.status + (cell.late ? ' late' : '') + '"><a href="' + link + '#' + E(a.lesson_id) + '">' + meter(cell.pct) + '<span class="cell-detail">' + cell.pct + '%' +
            (cell.quiz_total ? ' · Q ' + cell.quiz_best + '/' + cell.quiz_total : '') + (cell.debug_solved ? ' · 🐞✓' : '') + (cell.challenge ? ' · 🚀' : '') +
            (cell.late ? ' <b class="bad">late</b>' : '') + '</span></a></td>');
        });
        h.push('</tr>');
      });
      h.push('</tbody></table></div><p class="muted small">Q = best quiz score · 🐞✓ = debug challenge fixed · 🚀 = open-ended challenge submitted. ' +
        'The gradebook catches up with new work within about a minute.</p>');
    }
    h.push('</section><section class="card"><h2>🏁 Assign the Robot Sprint</h2><p class="muted">Assigns Sprints 1–3, then the branch below, all due on one date. Assigning it again updates the date.</p>' +
      '<div class="row"><label class="field"><span>Branch</span><select id="sp-branch"><option value="choice">Let students pick</option><option value="robots">🤖 Robots</option>' +
      '<option value="ai">🧠 AI</option><option value="embedded">📡 Embedded computing</option></select></label><label class="field"><span>Due date</span><input type="date" id="sp-due"></label>' +
      '<label class="field grow"><span>Note to students (optional)</span><input id="sp-note" maxlength="500"></label></div><button class="btn" id="sp-go" type="button">Assign the Sprint</button></section>' +
      '<div class="grid-2"><section class="card"><h2>Assign lessons</h2><div class="assign-picker">');
    d.units.forEach(function (u) {
      h.push('<fieldset><legend>Unit ' + u.number + ': ' + E(u.title) + '</legend>');
      u.lessons.forEach(function (l) {
        var on = d.assigned.indexOf(l.id) >= 0;
        h.push('<label class="check' + (on ? ' muted' : '') + '"><input type="checkbox" class="as-pick" value="' + E(l.id) + '"' + (on ? ' disabled checked' : '') + '> ' +
          E(l.number) + '. ' + E(l.title) + ' <a href="/lessons/' + E(l.id) + '" class="small">preview</a></label>');
      });
      h.push('</fieldset>');
    });
    h.push('</div><div class="row"><label class="field"><span>Due date (optional)</span><input type="date" id="as-due"></label><label class="field grow"><span>Note to students (optional)</span>' +
      '<input id="as-note" maxlength="500" placeholder="e.g. Bring your breakout board!"></label></div><button class="btn" id="as-go" type="button">Assign selected</button>');
    if (d.cols.length) {
      h.push('<h3>Assigned</h3><ul class="plain">');
      d.cols.forEach(function (a) {
        h.push('<li>' + E(a.number) + '. ' + E(a.title) + (a.due ? ' <small class="muted">due ' + E(due(a.due)) + '</small>' : '') +
          ' <button type="button" class="linklike small un-assign" data-id="' + E(a.id) + '">remove</button></li>');
      });
      h.push('</ul>');
    }
    h.push('</section><section class="card"><h2>Roster (' + d.students.length + ')</h2><ul class="roster plain">');
    if (d.students.length) d.students.forEach(function (s) {
      h.push('<li><span data-avatar="' + A(s.avatar || {}) + '" data-size="26"></span> <a href="/teacher/classes/' + E(c.id) + '/students/' + encodeURIComponent(s.email) + '">' +
        E(s.name) + '</a> <small class="muted">' + E(s.email) + (s.not_yet ? ' · not signed in yet' : ' · Lv ' + s.level) + '</small></li>');
    });
    else h.push('<li class="muted">Nobody yet.</li>');
    h.push('</ul><details class="danger-zone"><summary>Delete this class</summary><p class="small">Type <b>' + E(c.name) + '</b> to confirm. Student work is kept.</p>' +
      '<input id="del-name"> <button class="btn small danger" id="del-go" type="button">Delete class</button></details></section></div>');
    main.innerHTML = h.join('');
    var $ = function (id) { return document.getElementById(id); };
    $('sp-go').addEventListener('click', function () { act(this, 'assignSprint', [c.id, $('sp-branch').value, $('sp-due').value, $('sp-note').value]); });
    $('as-go').addEventListener('click', function () {
      var ids = Array.prototype.map.call(document.querySelectorAll('.as-pick:checked:not(:disabled)'), function (x) { return x.value; });
      act(this, 'assignLessons', [c.id, ids, $('as-due').value, $('as-note').value]);
    });
    document.querySelectorAll('.un-assign').forEach(function (b) {
      b.addEventListener('click', function () { if (confirm('Remove this assignment? Student work is kept.')) act(b, 'updateAssignment', [b.dataset.id, '', '', true]); });
    });
    if ($('gc-sync')) $('gc-sync').addEventListener('click', function () { act(this, 'syncClassroom', [c.id], function (r) { alert(syncReport([r])); window.top.location.reload(); }); });
    if ($('gc-unlink')) $('gc-unlink').addEventListener('click', function () {
      if (confirm('Unlink from Google Classroom? Students who never joined with the code leave this class (their work is kept).')) act(this, 'unlinkClassroom', [c.id]);
    });
    $('del-go').addEventListener('click', function () { act(this, 'deleteClass', [c.id, $('del-name').value], function () { ML.go('/'); }); });
  };

  pages.student = function () {
    var c = d.cls, s = d.student, lv = s.level, h = [];
    h.push('<a class="muted small" href="/teacher/classes/' + E(c.id) + '">← ' + E(c.name) + '</a><div class="page-head"><div class="who big"><span data-avatar="' + A(s.avatar) +
      '" data-size="72"></span><div><h1>' + E(s.name) + '</h1><p class="muted">' + E(s.email) + '<br>Level ' + lv.level + ' ' + E(lv.title) + ' · ' + lv.xp + ' XP · ' +
      s.badges.length + ' badges</p></div></div><div class="row"><button class="btn small danger" id="rm-go" type="button">Remove from class</button></div></div>' +
      '<div class="grid-2"><section class="card"><h2>Badges</h2><div class="mini-badges">' +
      (s.badges.length ? s.badges.map(function (b) { return '<span class="mini-badge" title="' + E(b.name + ': ' + b.desc) + '">' + E(b.icon) + '</span>'; }).join('') : '<span class="muted">None yet.</span>') +
      '</div></section><section class="card"><h2>Give a shout-out</h2><div class="row"><label class="field"><span>Bonus XP</span><input type="number" id="bn-amt" min="0" max="200" step="5" value="25"></label>' +
      '<label class="field grow"><span>Reason (student sees it)</span><input id="bn-why" maxlength="120" placeholder="Helped a classmate debug"></label></div>' +
      '<label class="check small"><input type="checkbox" id="bn-badge"> Also award the 🍎 Teacher\'s Pick badge</label><button class="btn small" id="bn-go" type="button">Give bonus</button>' +
      '<p class="muted small">Bonus XP shows up the next time the student opens Maker Lab.</p></section></div>');
    if (!d.items.length) h.push('<p class="muted card">No assigned or started lessons yet.</p>');
    d.items.forEach(function (it, i) {
      var p = it.p;
      h.push('<details class="card student-lesson" id="' + E(it.id) + '"' + (i ? '' : ' open') + '><summary><b>' + E(it.number) + '. ' + E(it.title) + '</b> ' +
        (it.assigned ? '' : '<small class="muted">(not assigned)</small>') + ' ' + meter(it.pct) + ' ' + it.pct + '%</summary>');
      if (!p) { h.push('<p class="muted">Not started.</p></details>'); return; }
      var pre = function (label, code) { return code ? '<details><summary>' + label + '</summary><pre class="code-block">' + E(code) + '</pre></details>' : ''; };
      h.push('<dl class="work"><dt>Warm-up</dt><dd>' + E(p.warmup_answer || '—') + '</dd>');
      if (it.stepped_count) h.push('<dt>Steps</dt><dd>' + (p.circuit_steps || []).length + ' / ' + it.stepped_count + ' checked off</dd>');
      if (p.practice_code !== undefined) h.push('<dt>Your turn</dt><dd>' + (p.practice_solved ? '✅ solved' : '❌ not yet') + pre('view their code', p.practice_code) + '</dd>');
      if (it.has_debug) {
        h.push('<dt>Code</dt><dd>' + ((p.sections || {}).code ? 'Ran it ✓' : 'not yet') + ' · downloaded ' + (p.sends || 0) + '×' + pre('view code', p.code) + '</dd>');
        h.push('<dt>Debug</dt><dd>' + (p.debug_solved ? '✅ fixed' : '❌ not fixed') + ' · ' + (p.debug_attempts || 0) + ' checks · ' + (p.debug_hints_used || 0) + ' hints' +
          pre('view their fix', p.debug_code) + (p.debug_reflection ? '<blockquote>' + E(p.debug_reflection) + '</blockquote>' : '') + '</dd>');
      }
      h.push('<dt>Quiz</dt><dd>' + (p.quiz_total ? 'latest ' + p.quiz_score + '/' + p.quiz_total + ' · best ' + p.quiz_best + '/' + p.quiz_total + ' · ' + p.quiz_attempts + ' attempt(s)' : '—') +
        '</dd><dt>Challenge</dt><dd>' + (p.challenge_submitted_at ? 'submitted ' + E(shortDate(p.challenge_submitted_at)) + '<blockquote>' + E(p.challenge_response) + '</blockquote>' +
        pre('view code', p.challenge_code) : '—') + '</dd></dl><div class="feedback-form"><label class="field"><span>Feedback (the student sees this at the top of the lesson)</span>' +
        '<textarea rows="2" class="fb-text" data-lesson="' + E(it.id) + '">' + E(it.feedback) + '</textarea></label><button class="btn small fb-go" type="button" data-lesson="' + E(it.id) +
        '">Save feedback</button> <span class="save-status small"></span></div></details>');
    });
    main.innerHTML = h.join('');
    var $ = function (id) { return document.getElementById(id); };
    $('bn-go').addEventListener('click', function () {
      act(this, 'giveBonus', [s.email, $('bn-amt').value, $('bn-why').value, $('bn-badge').checked], function (r) {
        flash('Gave ' + s.name + ' ' + r.xp + ' XP' + ($('bn-badge').checked ? " and the Teacher's Pick badge" : '') + '.', 'success');
        $('bn-go').disabled = false;
      });
    });
    $('rm-go').addEventListener('click', function () {
      if (confirm('Remove ' + s.name + ' from this class? Their work is kept.')) act(this, 'removeStudent', [c.id, s.email], function () { ML.go('/teacher/classes/' + c.id); });
    });
    document.querySelectorAll('.fb-go').forEach(function (b) {
      b.addEventListener('click', function () {
        var text = document.querySelector('.fb-text[data-lesson="' + b.dataset.lesson + '"]').value, status = b.nextElementSibling;
        act(b, 'saveFeedback', [s.email, b.dataset.lesson, text], function () { b.disabled = false; status.textContent = 'Saved ✓'; });
      });
    });
    if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) { el.open = true; el.scrollIntoView(); } }
  };

  pages.videos = function () {
    var h = ['<h1>Lesson videos</h1><p class="muted">Paste a link for any lesson: YouTube, Google Drive ("Anyone with the link" or your school), Vimeo, or a direct .mp4 link. ' +
      'It appears at the top of the lesson. Leave it blank to show "Video coming soon".</p><div class="card">'];
    d.units.forEach(function (u) {
      h.push('<h2>Unit ' + u.number + ': ' + E(u.title) + '</h2>');
      u.lessons.forEach(function (l) {
        h.push('<label class="field video-field"><span>' + E(l.number) + '. ' + E(l.title) + '</span><input type="url" class="vid" data-lesson="' + E(l.id) + '" value="' +
          E((d.urls || {})[l.id] || '') + '" placeholder="https://youtu.be/…"></label>');
      });
    });
    h.push('<button class="btn" id="vid-go" type="button">Save videos</button></div>');
    main.innerHTML = h.join('');
    document.getElementById('vid-go').addEventListener('click', function () {
      var map = {};
      document.querySelectorAll('.vid').forEach(function (i) { if (i.value.trim()) map[i.dataset.lesson] = i.value.trim(); });
      act(this, 'saveVideos', [map], function (r) { flash('Saved ' + r.count + ' video link(s).', 'success'); document.getElementById('vid-go').disabled = false; });
    });
  };

  pages.google = function () {
    var c = d.cls, h = ['<a class="muted small" href="/teacher/classes/' + E(c.id) + '">← ' + E(c.name) + '</a><h1>Send grades to Google Classroom</h1>' +
      '<div class="card"><p>This copies grades for the <b>Maker Lab to Google Classroom</b> sender (<code>maker-lab-classroom.gs</code>, see docs/GOOGLE_CLASSROOM.md). ' +
      'Paste them there to save draft grades.</p><h3>1. Pick lessons</h3>'];
    if (!d.cols.length) h.push('<p class="muted">Assign some lessons first.</p>');
    d.cols.forEach(function (a) { h.push('<label class="check"><input type="checkbox" class="gc-l" value="' + E(a.lesson_id) + '" checked> ' + E(a.number) + '. ' + E(a.title) + '</label>'); });
    h.push('<h3>2. How to score</h3><select id="gc-how"><option value="both">Average of % complete and quiz</option><option value="complete">% complete</option><option value="quiz">Best quiz score</option></select>' +
      '<div class="row"><button class="btn" id="gc-go" type="button">Copy grades</button><span class="save-status small" id="gc-msg"></span></div>' +
      '<textarea id="gc-out" rows="4" readonly hidden aria-label="Grades package"></textarea><p class="muted small">The copied grades include student names. Paste them only into the sender.</p></div>');
    main.innerHTML = h.join('');
    document.getElementById('gc-go').addEventListener('click', function () {
      var ids = Array.prototype.map.call(document.querySelectorAll('.gc-l:checked'), function (x) { return x.value; });
      act(this, 'classroomPackage', [c.id, document.getElementById('gc-how').value, ids], function (pkg) {
        var out = document.getElementById('gc-out'), text = JSON.stringify(pkg);
        out.value = text; out.hidden = false; out.select();
        document.getElementById('gc-go').disabled = false;
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
          function () { document.getElementById('gc-msg').textContent = 'Copied ✓ Paste it into the sender.'; },
          function () { document.getElementById('gc-msg').textContent = 'Select the text below and copy it.'; });
      });
    });
  };

  window.MLStart = function () {
    if (pages[ML.page]) pages[ML.page]();
    if (window.RobotAvatar) window.RobotAvatar.renderAll();
    if (window.Visuals) window.Visuals.renderAll();
    ML.fixLinks(document);
  };
})();
