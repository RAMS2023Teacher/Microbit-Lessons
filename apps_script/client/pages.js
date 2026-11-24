/* Draws every page except the lesson page (lesson.js) from the data the server sends (ML.data).
 * Student-typed text is always escaped (E) or set with textContent. */
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
      if (then) then(r); else ML.reload();
    }).catch(function (e) { if (btn) btn.disabled = false; flash((e && e.message) || 'Something went wrong.', 'error'); });
  };
  var levelLine = function (lv) {
    return lv.xp + ' XP' + (lv.max ? '' : ' · ' + (lv.next - lv.xp) + ' to level ' + (lv.level + 1));
  };
  var stageLabel = function (cell) {
    if (cell.status === 'complete') return '✓ done';
    if (cell.review === 'submitted') return '📨 to review';
    if (cell.review === 'returned') return '🔧 sent back';
    if (cell.stage === 'build') return 'Build ' + cell.steps_done + '/' + cell.steps_total;
    return { mission: 'Mission', quiz: 'Quiz', ship: 'Ship it' }[cell.stage] || '';
  };
  var meter = function (pct) { return '<span class="meter" title="' + pct + '% done"><i style="width:' + pct + '%"></i></span>'; };

  var reviewUrl = function (lid, email) { return '/teacher/review/' + encodeURIComponent(lid) + '/' + encodeURIComponent(email); };
  var whenSent = function (iso) {
    if (!iso) return '';
    var t = new Date(iso), mins = Math.round((Date.now() - t.getTime()) / 60000);
    if (mins < 60) return mins <= 1 ? 'just now' : mins + ' min ago';
    if (mins < 60 * 20) return Math.round(mins / 60) + ' h ago';
    return t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  var pages = {};

  pages.error = function () {
    main.innerHTML = '<div class="card center"><h1>Hmm</h1><p></p><a class="btn" href="/">Go home</a></div>';
    main.querySelector('p').textContent = d.message;
    if (d.retry) setTimeout(ML.reload, 4000 + Math.random() * 4000);      // busy: try again by itself, spread out
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
    var lv = d.level, h = [], nu = d.next_up, earned = d.badges.filter(function (b) { return b.earned; }).length;
    h.push('<section class="card player-card"><a class="avatar-tile" href="/me" title="Customize your robot"><span data-avatar="' + A(d.avatar) + '" data-size="96"></span></a>' +
      '<div style="flex:1"><h1>Hi ' + E(d.name) + '!</h1>' + (RobotAvatar.card(d.avatar) ? '<p class="card-line"><a href="/me" title="Change your calling card">' + RobotAvatar.card(d.avatar) + '</a></p>' : '<p class="card-line"><a class="small" href="/me">🪪 Pick a calling card</a></p>') + (d.avatar && d.avatar.name ? '<p class="muted">…and your robot <b>' + E(d.avatar.name) + '</b></p>' : '') +
      '<div class="level-row"><span class="level-badge">' + lv.level + '</span><div class="grow"><div class="level-title"><span>' + E(lv.title) + '</span>' +
      '<span>' + (lv.max ? 'max level!' : 'next: ' + lv.next) + '</span></div><div class="xpbar"><i style="width:' + lv.pct + '%"></i><b>⭐ ' + lv.xp + ' XP</b></div></div></div></div></section>');
    var back = (d.reviews || []).filter(function (x) { return x.status === 'returned'; }), wait = (d.reviews || []).filter(function (x) { return x.status === 'submitted'; });
    if (back.length) h.push('<section class="card review-home returned"><h2>🔧 Your teacher asked for changes</h2>' + back.map(function (x) {
      return '<a class="assign-row" href="/lessons/' + E(x.lesson_id) + '"><span class="icon-tile">' + E(x.icon) + '</span><span style="flex:1"><b>' + E(x.title) + '</b>' +
        (x.feedback ? '<br><small>💬 ' + E(x.feedback.length > 160 ? x.feedback.slice(0, 157) + '…' : x.feedback) + '</small>' : '') + '</span><span class="btn small">Fix it ▶</span></a>';
    }).join('') + '</section>');
    if (nu) h.push('<a class="banner mission-banner ' + E(nu.lesson.color) + '" href="/lessons/' + E(nu.lesson.id) + '"><div class="banner-icon">' + E(nu.lesson.icon) + '</div>' +
      '<div class="grow"><small>' + (nu.verb === 'Keep going' ? 'Keep going' : 'Next mission') + '</small><h1>' + E(nu.lesson.title) + '</h1>' +
      '<p>' + (nu.verb === 'Keep going' ? 'Next up: ' + E(nu.stage) : E(nu.lesson.tagline)) + '</p></div><span class="btn go big">GO ▶</span></a>');
    else h.push('<div class="card" style="padding:18px;margin:18px 0"><h2>🎉 You\'ve finished every lesson so far!</h2><p>Check the skill tree for what\'s coming next.</p></div>');
    h.push('<div class="stat-tiles"><div class="card stat"><span>🗺️</span><span class="big">' + d.done + '/' + d.total + '</span><small>Lessons done</small></div>' +
      '<div class="card stat"><span>🏅</span><span class="big">' + earned + '</span><small>Badges</small></div>' +
      '<div class="card stat"><span>⭐</span><span class="big">' + lv.xp + '</span><small>XP</small></div>' +
      '<a class="card stat" href="/map" style="text-decoration:none;color:inherit"><span>🌳</span><span class="big">Tree</span><small>See the skill tree</small></a></div>');
    h.push('<div class="home-grid"><section class="card" style="padding:18px"><h2>📋 My assignments</h2>');
    if (d.rows.length) d.rows.forEach(function (r) {
      h.push('<a class="assign-row" href="/lessons/' + E(r.lesson.id) + '"><span class="icon-tile ' + E(r.lesson.color) + '">' + E(r.lesson.icon) + '</span>' +
        '<span style="flex:1"><b>' + E(r.lesson.number) + '. ' + E(r.lesson.title) + '</b><br><small class="muted">' + E(r.class_name) +
        (r.due ? ' · due ' + E(due(r.due)) : '') + (r.overdue ? ' · <span class="bad">overdue</span>' : '') + (r.feedback ? ' · 💬 feedback' : '') +
        (r.review === 'submitted' && r.pct < 100 ? ' · 📨 with your teacher' : r.review === 'returned' ? ' · <b>🔧 fix it</b>' : '') + '</small>' +
        (r.note ? '<br><small>📌 ' + E(r.note) + '</small>' : '') + '</span>' + meter(r.pct) + '<b>' + r.pct + '%</b></a>');
    });
    else h.push('<p class="muted">No assignments yet. Start the next mission above, or pick any lesson.</p>');
    if (wait.length) h.push('<h3 class="small-head">📨 Waiting for your teacher</h3><ul class="plain waiting-list">' + wait.map(function (x) {
      return '<li><a href="/lessons/' + E(x.lesson_id) + '">' + E(x.icon) + ' ' + E(x.title) + '</a> <small class="muted">shipped, waiting for review</small></li>';
    }).join('') + '</ul>');
    h.push('</section><section class="card" style="padding:18px"><h2>🏅 Badge shelf</h2><div class="badge-shelf">');
    d.badges.forEach(function (b) {
      h.push('<span class="badge-slot' + (b.earned ? '' : ' locked') + '" title="' + E(b.name + ': ' + b.desc) + '">' + (b.earned ? E(b.icon) : '?') + '</span>');
    });
    h.push('</div><p class="muted small">Hover a badge to see how to earn it. <a href="/me">My robot &amp; badges →</a></p>' +
      '<div class="inline-form" style="margin-top:12px"><input id="join-code" placeholder="Join another class: code" maxlength="10"><button class="btn small" id="join-go" type="button">Join</button></div></section></div>');
    main.innerHTML = h.join('');
    document.getElementById('join-go').addEventListener('click', function () {
      act(this, 'joinClass', [document.getElementById('join-code').value, '']);
    });
  };

  pages.catalog = function () {
    var cardHtml = function (c) {
      var inner = '<span class="num">' + E(c.number) + '</span><span class="icon-tile ' + E(c.color) + '">' + E(c.icon) + '</span><h3>' + E(c.title) + '</h3>' +
        (c.soon ? '<p class="muted">Coming soon</p>' : '<p>' + E(c.tagline) + '</p>' + (c.pct ? meter(c.pct) : '')) +
        '<div class="tags"><span class="tag">' + (c.course === 'g6' ? '🧩 ' : '🐍 ') + E(c.python) + '</span><span class="tag">🔌 ' + E(c.hardware) + '</span>' +
        (c.stars ? '<span class="tag">' + '★'.repeat(c.stars) + '</span>' : '') + '</div>';
      return c.soon ? '<div class="card course-card soon">' + inner + '</div>' : '<a class="card course-card" href="/lessons/' + E(c.id) + '">' + inner + '</a>';
    };
    var h = ['<h1>Lessons</h1>'];
    if (d.courses) {                     // the teacher sees every grade
      d.courses.forEach(function (co) {
        h.push('<h2 class="course-head">' + E(co.name) + '</h2><div class="course-grid">' + co.cards.map(cardHtml).join('') + '</div>');
      });
    } else {
      h.push('<p class="muted">' + E(d.course_name) + ' · ' + d.course.length + ' projects. You code in MakeCode' + (ML.data.editor === 'blocks' ? ' Blocks.' : ' Python.') + '</p>' +
        '<div class="course-grid">' + d.course.map(cardHtml).join('') + '</div>');
    }
    main.innerHTML = h.join('');
  };

  pages.lesson = function () {
    main.className = 'lesson-main';
    window.__lessonPage();
  };

  pages.help = function () {
    main.innerHTML = '<div class="card" style="padding:22px;max-width:820px;margin:0 auto"><h1>🧰 Using MakeCode</h1>' +
      '<ol class="help-steps"><li>Click the green <b>Open MakeCode</b> button in any lesson (or go to <a href="' + E(d.makecode) + '" target="_blank" rel="noopener">makecode.microbit.org</a>).</li>' +
      '<li>Click <b>New Project</b> and give it the lesson\'s name.</li>' + (d.editor === 'blocks' ? '<li>Stay in <b>Blocks</b>. Drag blocks out of the colored drawers in the middle.</li>' : '<li>At the top, switch from <b>Blocks</b> to <b>Python</b>.</li>') +
      '<li>Test your code on the <b>simulator</b> (the micro:bit picture on the left).</li>' +
      '<li>To put it on a real micro:bit: plug it in with the USB cable and click <b>Download</b>. The first time, MakeCode asks to ' +
      '<b>connect</b> (pair) your micro:bit: pick it from the list. After that, Download sends your code straight to it.</li>' +
      '<li>If it saves a .hex file instead, drag the file onto the <b>MICROBIT</b> drive in the Files app.</li>' +
      '<li>When you finish a lesson: <b>Share</b> → <b>Share Project</b> → <b>Copy</b>, then paste the link in <b>Ship it</b>.</li></ol>' +
      (d.editor === 'blocks' ? '<div class="panel-soft box-tip"><h3>Blocks snap together</h3><p>Drop a block until it clicks into place. A gray, see-through block isn\'t connected, so it won\'t run.</p></div></div>'
        : '<div class="panel-soft box-tip"><h3>Python cares about spaces</h3><p>Lines inside a loop or an <code>if</code> are pushed in (indented) the same amount. If something breaks, check the spaces first.</p></div></div>');
  };

  pages.map = function () {
    main.className = 'container wide';
    var lv = d.level, h = ['<div class="page-head"><div><h1>Skill tree' + (d.map.course ? ' <small class="muted">' + E(d.map.course.name) + '</small>' : '') + '</h1>' +
      (d.map.courses ? '<p class="row">' + d.map.courses.map(function (co) { return '<a class="btn small' + (co.id === d.map.course.id ? '' : ' ghost') + '" href="/map/' + E(co.id) + '">' + E(co.name) + '</a>'; }).join(' ') + '</p>' : '') +
      '<p class="muted">Each lesson you finish builds a gadget and a robot part, and powers the paths after it.</p></div>'];
    if (!ML.teacher) h.push('<a class="level-chip card" href="/me"><span data-avatar="' + A(d.avatar) + '" data-size="52"></span><span><b>Level ' + lv.level + ' · ' +
      E(lv.title) + '</b><span class="xpbar"><i style="width:' + lv.pct + '%"></i></span><small class="muted">' + levelLine(lv) + '</small></span></a>');
    h.push('</div><div class="lab-hero" id="lab-hero"></div><div class="map-layout"><div class="map-scroll card"><div class="map" id="map" aria-label="Lesson map"></div></div><aside class="map-side">' +
      '<div class="card map-detail" id="map-detail" aria-live="polite"></div><div class="card map-legend"><h3>Legend</h3><ul>' +
      '<li><span class="dot complete"></span> Built (gold edge)</li><li><span class="dot progress"></span> In progress</li><li><span class="dot open"></span> Unlocked, ready to go</li>' +
      '<li><span class="dot locked"></span> Locked (grey outline)</li><li>📌 Assigned by your teacher</li><li>★ 3 stars: perfect quiz · an extension · shipped</li></ul></div></aside></div>');
    main.innerHTML = h.join('');
    window.MAP = d.map;
    window.ME = ML.teacher ? null : d.avatar;
    window.LESSON_URL = '/lessons/__ID__';
    if (window.__runMap) window.__runMap();
  };

  pages.profile = function () {
    var lv = d.level, h = [];
    h.push('<h1>My robot &amp; badges</h1><div class="profile-grid"><section class="card builder-card"><h2>Build your robot</h2><div class="avatar-builder"><div class="avatar-stage">' +
      '<div id="avatar-preview"></div><div id="card-preview" class="card-preview"></div><label class="field"><span>Robot name</span><input id="avatar-name" maxlength="20" placeholder="e.g. Sparky" value="' + E(d.avatar.name) + '"></label>' +
      '<button type="button" class="btn wide" id="avatar-save">Save my robot</button><button type="button" class="btn ghost wide small" id="avatar-random">🎲 Surprise me</button>' +
      '<p class="save-status small" id="avatar-status" role="status"></p>' + (ML.teacher ? '' : '<p class="pill-xp" id="spend">⚡ <b>' + (d.spendable || 0) + '</b> XP to spend</p>') + '</div><div class="avatar-parts"><div class="part-tabs" role="tablist">');
    Object.keys(d.parts).forEach(function (k, i) { h.push('<button type="button" role="tab" class="part-tab' + (i ? '' : ' active') + '" data-part="' + E(k) + '">' + E(d.parts[k]) + '</button>'); });
    h.push('</div><div class="part-options" id="part-options"></div><p class="muted small">🔒 Locked parts and calling cards unlock as you level up, earn badges and score in the arcade. 🛒 Some you can buy with XP to spend.</p></div></div></section>' +
      '<section class="card level-card"><h2>Level ' + lv.level + ': ' + E(lv.title) + '</h2><div class="xpbar big"><i style="width:' + lv.pct + '%"></i></div><p class="muted">' +
      lv.xp + ' XP' + (lv.max ? ' · max level!' : ' · ' + (lv.next - lv.xp) + ' XP to level ' + (lv.level + 1)) + '</p><ol class="level-ladder">');
    d.levels.forEach(function (l, i) {
      h.push('<li class="' + (lv.xp >= l[0] ? 'reached' : '') + (i + 1 === lv.level ? ' here' : '') + '"><b>' + (i + 1) + '</b> ' + E(l[1]) + ' <small>' + l[0] + ' XP</small></li>');
    });
    var x = d.xp_table;
    h.push('</ol><details><summary>How do I earn XP?</summary><table class="xp-table">' +
      [['Mission accepted', x.mission], ['Every build step (all its tests checked)', x.step],
       ['Quiz passed', x.quiz + ' (+' + x.quiz_perfect + ' perfect, +' + x.quiz_first_try + ' perfect first try)'],
       ['Every extension you add', x.extension], ['Project shipped', x.ship], ['Whole lesson complete', x.complete], ['Every badge', x.badge]]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td>+' + r[1] + '</td></tr>'; }).join('') + '</table></details></section></div>');
    var earned = d.badges.filter(function (b) { return b.earned; }).length;
    h.push('<section class="card"><h2>Badges <small class="muted">' + earned + ' / ' + d.badges.length + '</small></h2><div class="badge-grid">');
    d.badges.forEach(function (b) {
      h.push('<div class="badge-tile' + (b.earned ? '' : ' locked') + '" title="' + E(b.desc) + '"><span class="badge-icon">' + (b.earned ? E(b.icon) : '🔒') + '</span><b>' +
        E(b.name) + '</b><small>' + E(b.desc) + '</small>' + (b.earned ? '<small class="earned">Earned ' + shortDate(b.earned_at) + '</small>' : '') + '</div>');
    });
    h.push('</div></section><section class="card"><h2>Recent XP</h2><ul class="xp-history">');
    if (d.history.length) d.history.slice(0, 15).forEach(function (e) { h.push('<li><b>+' + e.amount + '</b> ' + E(e.reason) + ' <small class="muted">' + shortDate(e.at) + '</small></li>'); });
    else h.push('<li class="muted">No XP yet. Start a lesson on the <a href="/map">skill tree</a>!</li>');
    h.push('</ul></section>');
    main.innerHTML = h.join('');
    window.AVATAR = d.avatar;
    window.CATALOG = d.catalog;
    if (window.__runProfile) window.__runProfile();
  };

  // ---------------------------------------------------------------- Robot Rush: the arcade, its leaderboard and the power-up shop
  var mmss = function (sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  pages.arcade = function () {
    var h = [], st = d.state || {}, openUntil = st.open ? Date.now() + st.seconds_left * 1000 : null;
    var games = d.games || [{ id: 'rush', icon: '🏃', name: 'Robot Rush', desc: '', unlocked: true }], game = 'rush';
    try { game = localStorage.getItem('ml-game') || 'rush'; } catch (e) { /* default */ }
    var G = function () { return games.filter(function (x) { return x.id === game; })[0] || games[0]; };
    if (!G().unlocked && !d.practice) game = games[0].id;
    game = G().id;
    h.push('<div class="page-head"><div><h1>🎮 Arcade</h1><p class="muted">' + d.race_seconds + '-second races with your own robot. Pick a game:</p>' +
      '<div class="game-tabs" id="game-tabs">' + games.map(function (x) {
        return '<button type="button" class="game-tab' + (x.unlocked ? '' : ' is-locked') + '" data-game="' + E(x.id) + '"><span class="game-tab-icon">' + x.icon + '</span><span><b>' + E(x.name) + '</b>' +
          '<small>' + (x.unlocked ? (x.best ? 'Your best: ' + x.best : E(x.desc)) : '🔒 ' + E(x.how)) + '</small></span></button>';
      }).join('') + '</div></div>' +
      (d.practice ? '<span class="pill-xp">Teacher preview: scores aren\'t saved</span>' : '<span class="pill-xp" id="spend">⚡ <b>' + d.spendable + '</b> XP to spend</span>') + '</div>');
    h.push('<div class="arcade-grid"><div><section class="card arcade-play" id="play-card"><div id="play-gate"></div>' +
      '<div class="game-wrap" id="game-wrap" hidden><canvas id="rush" aria-label="Arcade race"></canvas>' +
      '<div class="game-pad" id="game-pad"></div></div><div id="result"></div></section>' +
      '<section class="card"><h2>🛒 Power-up shop</h2><p class="muted small">Spend XP on upgrades for your robot. Your level never goes down: it counts all the XP you ever earned.</p>' +
      '<div class="power-grid" id="power-grid"></div><p class="small">🎨 Costumes, jerseys, hats, beards and more robot looks to buy in <a href="/me">My robot</a>.</p><p class="bad small" id="shop-msg" role="status"></p></section></div>' +
      '<section class="card board-card"><h2>🏆 <span id="board-game"></span> leaderboard</h2><div class="board-tabs"><button type="button" class="here" data-b="today">Today</button>' +
      '<button type="button" data-b="all">All time</button></div><ol class="board" id="board"></ol>' +
      '<p class="muted small" id="board-best"></p><p class="small">🎁 Big scores win robot parts you can\'t buy. See them in <a href="/me">My robot</a>.</p></section></div>');
    main.innerHTML = h.join('');
    var $ = function (id) { return document.getElementById(id); }, which = 'today', boards = d.boards || {}, board = boards[game] || d.board || { today: [], all: [] };
    function pickGame(id) {
      if (racing) return;
      var x = games.filter(function (y) { return y.id === id; })[0];
      if (!x) return;
      game = id;
      try { localStorage.setItem('ml-game', id); } catch (e) { /* fine */ }
      board = boards[game] || { today: [], all: [] };
      document.querySelectorAll('.game-tab').forEach(function (b) { b.classList.toggle('here', b.dataset.game === game); });
      $('board-game').textContent = x.name;
      $('board-best').innerHTML = x.best ? 'Your best ever: <b>' + x.best + '</b>' : '';
      $('result').textContent = '';
      drawBoard(); drawGate();
    }
    document.querySelectorAll('.game-tab').forEach(function (b) { b.addEventListener('click', function () { pickGame(b.dataset.game); }); });

    function drawBoard() {
      var rows = board[which] || [], ol = $('board');
      ol.textContent = '';
      if (!rows.length) { ol.innerHTML = '<li class="muted">No races yet' + (which === 'today' ? ' today' : '') + '. Be the first!</li>'; return; }
      rows.forEach(function (r, i) {
        var li = document.createElement('li');
        li.className = r.me ? 'me' : '';
        li.innerHTML = '<span class="rank">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span><span data-avatar="' + A(r.avatar || {}) + '" data-size="40"></span><b></b><span class="score">' + r.score + '</span>';
        li.querySelector('b').textContent = r.name + (r.me ? ' (you)' : '');
        li.querySelector('b').setAttribute('translate', 'no');
        if (RobotAvatar.card(r.avatar)) { li.classList.add('has-card'); li.querySelector('b').insertAdjacentHTML('afterend', RobotAvatar.card(r.avatar, 'tiny')); }
        ol.appendChild(li);
      });
      RobotAvatar.renderAll(ol);
    }
    document.querySelectorAll('.board-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        which = b.dataset.b;
        document.querySelectorAll('.board-tabs button').forEach(function (x) { x.classList.toggle('here', x === b); });
        drawBoard();
      });
    });

    function drawShop() {
      var box = $('power-grid');
      box.innerHTML = (d.shop || []).map(function (u) {
        var pips = '';
        for (var i = 0; i < u.max; i++) pips += '<i class="' + (i < u.level ? 'on' : '') + '"></i>';
        var btn = u.next_cost == null ? '<span class="maxed">MAX</span>' :
          '<button type="button" class="btn small' + (d.spendable >= u.next_cost && !d.practice ? ' go' : ' locked') + '" data-buy="' + E(u.id) + '">' + (u.level ? 'Upgrade' : 'Buy') + ' · ' + u.next_cost + ' XP</button>';
        return '<div class="power"><span class="power-icon">' + u.icon + '</span><div><b>' + E(u.name) + '</b><span class="pips">' + pips + '</span><small>' + E(u.desc) + '</small></div>' + btn + '</div>';
      }).join('');
      box.querySelectorAll('[data-buy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = d.shop.filter(function (x) { return x.id === b.dataset.buy; })[0];
          if (d.spendable < u.next_cost || d.practice) {
            $('shop-msg').textContent = d.practice ? 'Students buy power-ups with XP they earn.' : 'You need ' + (u.next_cost - d.spendable) + ' more XP to spend. Finish more steps to earn it!';
            if (window.Celebrate) window.Celebrate.nope(b, $('shop-msg'));
            return;
          }
          if (!confirm('Buy ' + u.name + ' level ' + (u.level + 1) + ' for ' + u.next_cost + ' XP?')) return;
          b.disabled = true;
          ML.api('/api/shop/buy', { item: 'power:' + u.id }).then(function (r) {
            $('shop-msg').textContent = r.ok ? '' : (r.error || 'Could not buy that.');
            if (window.Celebrate) { if (r.ok) window.Celebrate.buy(b); else window.Celebrate.nope(b, $('shop-msg')); }
            if (r.ok) { d.shop = r.shop; d.spendable = r.spendable; d.powerups = r.powerups; d.race_seconds = r.race_seconds; $('spend').innerHTML = '⚡ <b>' + r.spendable + '</b> XP to spend'; }
            drawShop();
          });
        });
      });
    }

    var tick = null, bank = st.bank || 0;
    function drawGate() {
      var gate = $('play-gate'), left = openUntil ? Math.max(0, Math.round((openUntil - Date.now()) / 1000)) : 0;
      if (!G().unlocked && !d.practice) {
        gate.innerHTML = '<div class="gate"><span class="gate-lock">🔒</span><div><b>' + E(G().name) + ' is locked.</b><span>' + E(G().how) + ' to unlock it. ' + E(G().desc) + '</span></div></div>';
      } else if (d.practice || (left > 0 && bank > 0)) {
        gate.innerHTML = '<div class="gate open"><div><b>' + (d.practice ? 'Practice race: ' + E(G().name) : G().icon + ' ' + E(G().name) + ' is open!') + '</b>' +
          (d.practice ? '' : '<span>You have <b id="gate-bank">' + mmss(bank) + '</b> of play time. Each race uses ' + d.race_seconds + ' seconds.</span>') + '</div>' +
          '<button type="button" class="btn go big" id="start">▶ Start race</button></div>';
        $('start').addEventListener('click', start);
      } else if (left > 0) {
        gate.innerHTML = '<div class="gate"><span class="gate-lock">⏳</span><div><b>The arcade is open, but you\'re out of play time.</b>' +
          '<span>Finish a lesson to earn ' + d.minutes + ' minutes of play time. Spend XP on power-ups while you work!</span></div></div>';
      } else {
        gate.innerHTML = '<div class="gate"><span class="gate-lock">🔒</span><div><b>The arcade is closed.</b>' +
          '<span>Your teacher opens it in class. Finish a lesson to earn ' + d.minutes + ' minutes of play time' +
          (bank ? ': you have <b>' + mmss(bank) + '</b> saved.' : '.') + '</span></div></div>';
      }
    }
    function countdown() {
      clearInterval(tick);
      tick = setInterval(function () {
        if (openUntil && openUntil <= Date.now()) { clearInterval(tick); openUntil = null; if (!racing) drawGate(); }
      }, 1000);
    }
    var racing = false;
    function start() {
      var btn = $('start');
      btn.disabled = true;
      ML.api('/api/arcade/start', { game: game }).then(function (r) {
        if (!r.ok) { $('play-gate').innerHTML = '<p class="bad"></p>'; $('play-gate').firstChild.textContent = r.error; return; }
        racing = true;
        bank = r.bank || 0;
        $('play-gate').hidden = true; $('result').textContent = ''; $('game-wrap').hidden = false;
        $('game-wrap').scrollIntoView({ block: 'center', behavior: 'smooth' });
        var pad = $('game-pad'), circuit = game === 'circuit';
        pad.innerHTML = circuit
          ? '<button type="button" class="btn" id="pad-left">◀ Left</button><button type="button" class="btn go" id="pad-boost">🔋 Boost</button><button type="button" class="btn" id="pad-right">Right ▶</button>'
          : '<button type="button" class="btn" id="pad-up">▲ Up</button><button type="button" class="btn go" id="pad-dash">🚀 Dash</button><button type="button" class="btn" id="pad-down">▼ Down</button>';
        var hold = function (id, fn) {
          var b = $(id);
          b.addEventListener('pointerdown', function (e) { e.preventDefault(); fn(true); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { fn(false); }); });
        };
        var run = circuit
          ? CircuitDriver.play($('rush'), { avatar: d.avatar, seconds: r.seconds, powerups: r.powerups, controls: function (c) { hold('pad-left', c.left); hold('pad-right', c.right); $('pad-boost').onclick = c.boost; } })
          : RobotRush.play($('rush'), { avatar: d.avatar, seconds: r.seconds, powerups: r.powerups, controls: function (c) { $('pad-up').onclick = c.up; $('pad-down').onclick = c.down; $('pad-dash').onclick = c.dash; } });
        run.then(function (res) {
          racing = false;
          var line = circuit ? '🏁 ' + res.laps + ' lap' + (res.laps === 1 ? '' : 's') + ' · 💡 ' + res.leds + ' LEDs · ' + res.electrons + ' electrons'
            : res.meters + ' m · 🔩 ' + res.bolts + ' bolts';
          $('result').innerHTML = '<div class="result-card"><b>Finished!</b><span class="big-score">' + res.score + '</span><span class="muted small">' +
            line + (res.smashed ? ' · 💥 ' + res.smashed + ' smashed' : '') + '</span><p id="res-note" class="small">Saving…</p><p id="res-won" class="won-parts" hidden></p></div>';
          return ML.api('/api/arcade/finish', { run_id: r.run_id, score: res.score }).then(function (f) {
            var note = $('res-note');
            if (!f.ok) { note.className = 'bad small'; note.textContent = f.error; }
            else if (f.practice) note.textContent = 'Practice race: scores are not saved for the teacher.';
            else {
              note.textContent = f.new_best ? '🎉 New personal best!' : f.new_day_best ? '⭐ Your best today!' : 'Your best: ' + f.best;
              board = boards[game] = f.board || board; drawBoard();
              G().best = f.best; $('board-best').innerHTML = 'Your best ever: <b>' + f.best + '</b>';
              var tab = document.querySelector('.game-tab[data-game="' + game + '"] small'); if (tab) tab.textContent = 'Your best: ' + f.best;
              if ((f.unlocked || []).length) {
                $('res-won').hidden = false;
                $('res-won').innerHTML = '🎁 <b>You won ' + f.unlocked.map(E).join(', ') + '!</b> Put ' + (f.unlocked.length > 1 ? 'them' : 'it') + ' on in <a href="/me">My robot</a>.';
                if (window.Celebrate && window.Celebrate.confetti) window.Celebrate.confetti();
              }
              if (f.state) { openUntil = f.state.open ? Date.now() + f.state.seconds_left * 1000 : null; bank = f.state.bank || 0; }
            }
            $('play-gate').hidden = false;
            drawGate();
            var s = $('start');
            if (s) s.textContent = '▶ Race again';
          });
        });
      }).catch(function () { btn.disabled = false; });
    }
    drawShop();
    pickGame(game);
    if (openUntil) countdown();
  };

  // ---------------------------------------------------------------- teacher pages
  pages['teacher-home'] = function () {
    var waiting = d.classes.reduce(function (t, c) { return t + (c.waiting || 0); }, 0);
    var h = ['<h1>My classes</h1>'];
    if (waiting) h.push('<a class="banner review-banner" href="/teacher/review"><div class="banner-icon">📨</div><div class="grow"><small>Waiting for you</small><h2>' + waiting + ' shipped project' + (waiting > 1 ? 's' : '') + ' to review</h2>' +
      '<p>Students finish a lesson when you approve it.</p></div><span class="btn">Review ▶</span></a>');
    h.push('<div class="class-cards">');
    d.classes.forEach(function (c) {
      h.push('<a class="card class-card" href="/teacher/classes/' + E(c.id) + '"><span class="grade-tag ' + E(c.grade) + '">' + E(c.grade_name) + '</span><h2>' + E(c.name) + '</h2><div class="join-code small">Code <b>' + E(c.code) +
        '</b></div><p class="muted">' + c.students + ' students · ' + c.assignments + ' assignments' + (c.classroom ? '<br>🔗 Google Classroom' : '') + '</p>' +
        (c.waiting ? '<p class="small"><b>📨 ' + c.waiting + ' to review</b></p>' : '') + '</a>');
    });
    var linked = d.classes.filter(function (c) { return c.classroom; }).length;
    h.push('<div class="card class-card new"><h2>+ New class</h2><input id="new-class" placeholder="e.g. Period 3 Makers" maxlength="80"><select id="new-grade"><option value="">Pick a grade…</option>' + (d.grades || []).map(function (g) { return '<option value="' + E(g.id) + '">' + E(g.name) + '</option>'; }).join('') + '</select><button class="btn" id="new-go" type="button">Create</button></div>' +
      '<div class="card class-card new"><h2>🔗 Google Classroom</h2><p class="muted small">Bring in your Classroom classes and their students. No join codes needed.</p>' +
      '<a class="btn" href="/teacher/google-import">Import classes</a>' + (linked ? ' <button class="btn ghost small" id="gc-sync-all" type="button">Update all rosters</button>' : '') + '</div></div>' +
      '<section class="card tab-icon-card"><h2>Tab icon</h2><p class="muted small">The little picture in the browser tab, for you and your students.</p>' +
      '<div class="tab-icon-row"><img id="tab-icon-now" alt="" width="32" height="32"><select id="tab-icon-pick"></select>' +
      '<input id="tab-icon-url" placeholder="…or paste a picture address (https://…png)" hidden style="flex:1;min-width:240px">' +
      '<button class="btn small" id="tab-icon-go" type="button">Save</button></div>' +
      '<p class="muted small">After saving, reload the page to see it in the tab.</p>' +
      (d.logo_refused ? '<p class="small bad">Google wouldn\'t accept the logo from your Drive, so the tab shows 🤖. Pick one of the emoji instead.</p>' : '') +
      '</section>' +
      '<section class="card data-card" id="data-card"><h2>🗄️ Your data</h2><p class="muted small">Loading…</p></section>' +
      '<section class="card tip"><h2>Getting started</h2><ol><li><b>Import classes</b> from Google Classroom, or create a class. Each class also gets a 6-letter <b>join code</b>.</li>' +
      '<li>Share this page\'s web address with students. Students on an imported roster are already in. Anyone else types the code and their name once. No passwords.</li>' +
      '<li>Assign lessons with due dates. The gradebook shows who\'s done what.</li><li>Open any lesson to see the <b>teacher answer key</b>. Add videos on the <a href="/teacher/videos">Videos</a> page.</li></ol></section>');
    main.innerHTML = h.join('');
    // Your data: where Maker Lab keeps everything, backups, and other "Maker Lab data" folders (owner only)
    var drawData = function (info) {
      var box = document.getElementById('data-card'), h2 = [];
      h2.push('<h2>🗄️ Your data</h2>');
      h2.push(info.folder.url ? '<p>Maker Lab keeps everything in <a href="' + E(info.folder.url) + '" target="_blank" rel="noopener">' + E(info.folder.name) +
        '</a> in your Google Drive: <b>' + info.students + '</b> students, <b>' + info.classes + '</b> classes.</p>'
        : info.folder.missing ? '<p class="bad">Maker Lab can\'t open its data folder right now. Your data is not lost: nothing new was made. Try again in a minute.</p>'
        : '<p class="muted">No data yet.</p>');
      h2.push('<p class="small">' + (info.today ? (info.today.done ? '✅ Today\'s backup is done.' : '⏳ Today\'s backup: ' + info.today.students + ' students so far.') : 'Today\'s backup hasn\'t started yet.') +
        ' <button class="btn small ghost" id="backup-go" type="button">Back up now</button></p>');
      if (info.backups.length) h2.push('<p class="small">Backups: ' + info.backups.map(function (b) {
        return b.url ? '<a href="' + E(b.url) + '" target="_blank" rel="noopener">' + E(b.day) + '</a> (' + b.students + ')' : E(b.day);
      }).join(' · ') + '</p>');
      if (info.others.length) h2.push('<p class="small bad">⚠️ Your Drive has ' + info.others.length + ' other "Maker Lab data" folder(s): ' +
        info.others.map(function (o) { return '<a href="' + E(o.url) + '" target="_blank" rel="noopener">open</a>'; }).join(', ') +
        '. Maker Lab only uses the one above. Don\'t delete anything; ask Claude if you\'re not sure which is right.</p>');
      box.innerHTML = h2.join('');
      document.getElementById('backup-go').addEventListener('click', function () {
        var b = this; b.disabled = true; b.textContent = 'Backing up…';
        ML.run('backupNow').then(drawData).catch(function (e) { b.disabled = false; b.textContent = 'Back up now'; flash(e.message, 'error'); });
      });
    };
    ML.run('dataInfo').then(drawData).catch(function () { document.getElementById('data-card').querySelector('p').textContent = 'Couldn\'t load right now.'; });
    document.getElementById('new-go').addEventListener('click', function () {
      act(this, 'createClass', [document.getElementById('new-class').value, document.getElementById('new-grade').value], function (c) { ML.go('/teacher/classes/' + c.id); });
    });
    var pick = document.getElementById('tab-icon-pick'), url = document.getElementById('tab-icon-url');
    document.getElementById('tab-icon-now').src = d.tab_icon_url;
    (d.tab_icons || []).forEach(function (t) { var o = pick.appendChild(document.createElement('option')); o.value = t.id; o.textContent = t.label; });
    pick.appendChild(document.createElement('option')).value = 'custom';
    pick.lastChild.textContent = 'My own picture…';
    var custom = /^https:/.test(d.tab_icon);
    pick.value = custom ? 'custom' : d.tab_icon;
    url.hidden = !custom;
    if (custom) url.value = d.tab_icon;
    pick.addEventListener('change', function () { url.hidden = pick.value !== 'custom'; });
    document.getElementById('tab-icon-go').addEventListener('click', function () {
      var btn = this;
      act(btn, 'setTabIcon', [pick.value === 'custom' ? url.value : pick.value], function (r) {
        btn.disabled = false;
        document.getElementById('tab-icon-now').src = r.url;
        flash('Saved. Reload the page to see the new tab icon.', 'success');
      });
    });
    var all = document.getElementById('gc-sync-all');
    if (all) all.addEventListener('click', function () {
      act(this, 'syncAllClassroom', [], function (r) { alert(syncReport(r.classes)); ML.reload(); });
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
      '<div class="table-scroll"><table class="gradebook"><thead><tr><th>Google Classroom class</th><th>In Maker Lab</th><th>Grade</th></tr></thead><tbody>');
    var guessGrade = function (text) { var m = /\b(6|7)(?:th)?\b|\b(six|seven)/i.exec(text || ''); return !m ? '' : (m[1] || m[2].toLowerCase()) === '6' || /six/i.test(m[2] || '') ? 'g6' : 'g7'; };
    d.courses.forEach(function (c) {
      var opts = '<option value="">Skip</option><option value="new"' + (c.linked ? '' : '') + '>New Maker Lab class</option>';
      d.classes.forEach(function (k) { opts += '<option value="' + E(k.id) + '"' + (c.linked === k.id ? ' selected' : '') + '>Link to: ' + E(k.name) + '</option>'; });
      h.push('<tr><th class="who"><span><b>' + E(c.name) + '</b>' + (c.section ? '<small>' + E(c.section) + '</small>' : '') + '</span></th>' +
        '<td><select class="gc-pick" data-id="' + E(c.id) + '">' + opts + '</select>' + (c.linked ? ' <small class="muted">already linked</small>' : '') + '</td>' +
        '<td><select class="gc-grade" data-id="' + E(c.id) + '"><option value="">Pick a grade…</option>' + (d.grades || []).map(function (g) {
          var pre = c.linked ? (d.classes.filter(function (k) { return k.id === c.linked; })[0] || {}).grade : guessGrade(c.name + ' ' + c.section);
          return '<option value="' + E(g.id) + '"' + (g.id === pre ? ' selected' : '') + '>' + E(g.name) + '</option>';
        }).join('') + '</select></td></tr>');
    });
    h.push('</tbody></table></div><button class="btn" id="gc-go" type="button">Import</button></section>');
    main.innerHTML = h.join('');
    document.getElementById('gc-go').addEventListener('click', function () {
      var choices = Array.prototype.map.call(document.querySelectorAll('.gc-pick'), function (x) {
        return { course_id: x.dataset.id, target: x.value, grade: document.querySelector('.gc-grade[data-id="' + x.dataset.id + '"]').value };
      }).filter(function (c) { return c.target; });
      if (!choices.length) { flash('Pick at least one class to import.', 'error'); return; }
      if (choices.some(function (c) { return !c.grade; })) { flash('Pick 6th or 7th grade for every class you import.', 'error'); return; }
      act(this, 'importClassroom', [choices], function (r) { alert(syncReport(r.classes)); ML.go('/'); });
    });
  };

  pages.classroom = function () {
    main.className = 'container wide';
    var c = d.cls, h = [];
    h.push('<div class="page-head"><div><a class="muted small" href="/">← My classes</a><h1>' + E(c.name) + '</h1></div>' +
      '<div class="row"><a class="btn" href="/teacher/classes/' + E(c.id) + '/screen">📺 Class display</a>' +
      '<a class="btn ghost" href="/student-view/' + E(c.id) + '">👀 Student view</a>' +
      '<a class="btn ghost" href="/teacher/classes/' + E(c.id) + '/google-classroom">Google Classroom grades</a></div>' +
      '<div class="join-code">Join code <b>' + E(c.code) + '</b><small>' + E(d.url) + '</small></div></div>' +
      '<p class="grade-pick">Course: <select id="grade-pick">' + (d.grades || []).map(function (g) { return '<option value="' + E(g.id) + '"' + (g.id === d.grade ? ' selected' : '') + '>' + E(g.name) + '</option>'; }).join('') +
      '</select> <small class="muted">Students in this class see only this course\'s lessons.</small></p>');
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
      var names = {};
      d.students.forEach(function (s) { names[s.email] = s.name; });
      d.students.forEach(function (s) {
        var link = '/teacher/classes/' + E(c.id) + '/students/' + encodeURIComponent(s.email);
        h.push('<tr' + (s.not_yet ? ' class="muted"' : '') + '><th class="who"><span data-avatar="' + A(s.avatar || {}) + '" data-size="34"></span><span><a href="' + link + '">' + E(s.name) + '</a><small>' +
          (s.not_yet ? 'hasn\'t opened Maker Lab yet' : 'Lv ' + s.level + ' · ' + (s.xp || 0) + ' XP') + '</small></span></th>');
        d.cols.forEach(function (a) {
          var cell = d.grid[s.email + '|' + a.id];
          h.push('<td class="cell ' + cell.status + (cell.late ? ' late' : '') + '"><a href="' + link + '#' + E(a.lesson_id) + '">' + meter(cell.pct) + '<span class="cell-detail">' + cell.pct + '%' +
            (cell.status !== 'not-started' ? ' · ' + E(stageLabel(cell)) : '') + (cell.quiz_total ? ' · Q ' + cell.quiz_best + '/' + cell.quiz_total : '') +
            (cell.late ? ' <b class="bad">late</b>' : '') + (cell.partner ? ' · 👥 ' + E(names[cell.partner] || 'partner') : '') + '</span></a>' +
            (cell.review === 'submitted' ? '<a class="cell-link review-now" href="' + reviewUrl(a.lesson_id, s.email) + '">📨 Review it</a>'
              : cell.share ? '<a class="cell-link" href="' + reviewUrl(a.lesson_id, s.email) + '" title="Their MakeCode project and your review">🔗 project</a>' : '') + '</td>');
        });
        h.push('</tr>');
      });
      h.push('</tbody></table></div><p class="muted small">Stage = where they are (Mission, Build step, Quiz, Ship it) · Q = best quiz score · 📨 = shipped, waiting for your review · 🔧 = you sent it back · ✓ done = you approved it · 🔗 = their MakeCode project and your review. ' +
        'The gradebook catches up with new work within about a minute.</p>');
    }
    h.push('</section><section class="card arcade-teacher" id="arcade-card"></section>');
    h.push('<div class="grid-2"><section class="card"><h2>Assign lessons</h2><div class="assign-picker">');
    h.push('<fieldset><legend>The course</legend>');
    d.course.forEach(function (l) {
      if (l.soon) { h.push('<label class="check muted"><input type="checkbox" disabled> ' + E(l.number) + '. ' + E(l.title) + ' <small>(coming soon)</small></label>'); return; }
      var on = d.assigned.indexOf(l.id) >= 0;
      h.push('<label class="check' + (on ? ' muted' : '') + '"><input type="checkbox" class="as-pick" value="' + E(l.id) + '"' + (on ? ' disabled checked' : '') + '> ' +
        E(l.icon) + ' ' + E(l.number) + '. ' + E(l.title) + ' <a href="/lessons/' + E(l.id) + '" class="small">preview</a></label>');
    });
    h.push('</fieldset>');
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
    $('as-go').addEventListener('click', function () {
      var ids = Array.prototype.map.call(document.querySelectorAll('.as-pick:checked:not(:disabled)'), function (x) { return x.value; });
      act(this, 'assignLessons', [c.id, ids, $('as-due').value, $('as-note').value]);
    });
    document.querySelectorAll('.un-assign').forEach(function (b) {
      b.addEventListener('click', function () { if (confirm('Remove this assignment? Student work is kept.')) act(b, 'updateAssignment', [b.dataset.id, '', '', true]); });
    });
    if ($('gc-sync')) $('gc-sync').addEventListener('click', function () { act(this, 'syncClassroom', [c.id], function (r) { alert(syncReport([r])); ML.reload(); }); });
    if ($('gc-unlink')) $('gc-unlink').addEventListener('click', function () {
      if (confirm('Unlink from Google Classroom? Students who never joined with the code leave this class (their work is kept).')) act(this, 'unlinkClassroom', [c.id]);
    });
    $('del-go').addEventListener('click', function () { act(this, 'deleteClass', [c.id, $('del-name').value], function () { ML.go('/'); }); });
    $('grade-pick').addEventListener('change', function () {
      var sel = this;
      if (!confirm('Switch this class to "' + sel.options[sel.selectedIndex].text + '"? Students keep all their work and XP.')) { sel.value = d.grade; return; }
      act(sel, 'setClassGrade', [c.id, sel.value]);
    });
    // Robot Rush: closed unless the teacher opens it for this class
    var arc = d.arcade, arcEnd = null, arcTick = null;
    function drawArcade() {
      var left = arcEnd ? Math.max(0, Math.round((arcEnd - Date.now()) / 1000)) : 0, b = arc.board || { today: [] };
      $('arcade-card').innerHTML = '<div class="arcade-teacher-head"><h2>🎮 Robot Rush</h2><a class="btn ghost small" href="/arcade">Try it yourself</a></div>' +
        '<p class="muted small">The arcade is closed unless you open it here or on the 📺 Class display. Finishing a lesson earns a student ' + arc.minutes +
        ' minutes of play time, which they can only use while the arcade is open for this class. Spending XP on power-ups never lowers a level.</p><div class="row">' +
        (left ? '<b class="ok">Open · closes in <span id="arc-left">' + mmss(left) + '</span></b> <button class="btn small ghost" type="button" data-arc="close">Close now</button>'
          : '<button class="btn small" type="button" data-arc="open">Open for this class (1 hour)</button>') +
        ' <button class="btn small ghost" type="button" data-arc="gift">Give everyone ' + arc.minutes + ' minutes</button></div>' +
        '<h3>Today\'s top racers</h3>' + (b.today.length ? '<ol class="board small-board">' + b.today.slice(0, 5).map(function (r, i) {
          return '<li><span class="rank">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span><span data-avatar="' + A(r.avatar || {}) + '" data-size="30"></span><b>' + E(r.name) + '</b><span class="score">' + r.score + '</span></li>';
        }).join('') + '</ol>' : '<p class="muted small">No races yet today.</p>');
      RobotAvatar.renderAll($('arcade-card'));
      $('arcade-card').querySelectorAll('[data-arc]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.arc === 'gift' && !confirm('Give every student in this class ' + arc.minutes + ' minutes of play time?')) return;
          act(btn, 'arcadeClass', [c.id, btn.dataset.arc, 60], function (r) {
            arc = r; arcEnd = r.seconds_left ? Date.now() + r.seconds_left * 1000 : null; drawArcade();
            if (r.gifted != null) flash('Gave ' + r.gifted + ' students ' + arc.minutes + ' minutes of play time.', 'ok');
          });
        });
      });
      clearInterval(arcTick);
      if (left) arcTick = setInterval(function () {
        var l = Math.max(0, Math.round((arcEnd - Date.now()) / 1000));
        if ($('arc-left')) $('arc-left').textContent = mmss(l);
        if (!l) drawArcade();
      }, 1000);
    }
    if (arc) { arcEnd = arc.seconds_left ? Date.now() + arc.seconds_left * 1000 : null; drawArcade(); }
  };

  pages.student = function () {
    var s = d.student, h = [];
    h.push('<a class="muted small" href="/teacher/classes/' + E(d.cls.id) + '">← ' + E(d.cls.name) + '</a>' +
      '<section class="card player-card"><span class="avatar-tile"><span data-avatar="' + A(s.avatar) + '" data-size="80"></span></span><div style="flex:1"><h1></h1>' +
      '<p class="muted">' + E(s.email) + ' · Level ' + s.level.level + ' (' + E(s.level.title) + ') · ' + s.xp + ' XP · ' +
      s.badges.map(function (b) { return E(b.icon); }).join(' ') + '</p></div>' +
      '<div class="inline-form"><input id="bx" type="number" min="0" max="200" placeholder="XP" style="width:80px"><input id="br" placeholder="Reason" maxlength="120">' +
      '<label class="small"><input type="checkbox" id="bp"> 🍎 Teacher\'s Pick</label><button class="btn small" id="bgo" type="button">Give</button></div></section>');
    if (!d.items.length) h.push('<p class="muted">No lessons started or assigned yet.</p>');
    d.items.forEach(function (it) {
      var p = it.p || {}, steps = p.steps || {};
      h.push('<section class="card" id="' + E(it.id) + '" style="padding:18px;margin-top:16px"><h2>' + E(it.icon) + ' ' + E(it.number) + '. ' + E(it.title) +
        ' <small class="muted">' + it.pct + '%' + (it.assigned ? ' · assigned' : '') + '</small></h2>' + meter(it.pct) + '<dl class="work">' +
        (it.partner ? '<dt>Partner</dt><dd>👥 Worked with ' + E(it.partner) + '</dd>' : '') +
        '<dt>Mission</dt><dd><small class="muted">' + E(it.talk_q.replace(/<[^>]+>/g, '')) + '</small><br><span data-text="talk"></span></dd><dt>Build</dt><dd><ol class="small">');
      it.steps.forEach(function (st, k) {
        var r = steps[k] || {};
        h.push('<li>' + (r.done ? '✅' : '⬜') + ' ' + E(st.title) + (st.ask && r.answer ? '<br><small class="muted">' + E(st.ask) + '</small> <span class="ans">' + E(r.answer) + '</span>' : '') +
          (st.fields.length && r.fields ? '<br><small>' + st.fields.map(function (f, i) { return E(f) + ': <b>' + E((r.fields || [])[i] || '') + '</b>'; }).join(' · ') + '</small>' : '') + '</li>');
      });
      h.push('</ol></dd><dt>Quiz</dt><dd>' + (p.quiz_total ? 'best ' + p.quiz_best + '/' + p.quiz_total + ' · ' + p.quiz_attempts + ' attempt(s)' : '—') + '</dd>' +
        '<dt>Ship it</dt><dd>' + (p.shipped_at ? '📦 shipped ' + E(shortDate(p.shipped_at)) : 'not yet') +
        (p.share ? ' · <a href="' + E(p.share) + '" target="_blank" rel="noopener">🔗 open their MakeCode project</a>' : '') +
        (it.review === 'submitted' ? '<br><a class="btn small" href="' + reviewUrl(it.id, s.email) + '">📨 Review it</a>'
          : it.graded ? '<br><span class="chip ' + E(it.graded.status) + '">' + (it.graded.status === 'approved' ? '✅ Approved' : '🔧 Sent back') + '</span>' +
            (it.graded.max ? ' <small>' + it.graded.total + ' of ' + it.graded.max + '</small>' : '') + (it.graded.feedback ? ' <small class="muted">“' + E(it.graded.feedback) + '”</small>' : '') +
            ' <a class="small" href="' + reviewUrl(it.id, s.email) + '">open review</a>'
          : it.review === 'approved' && p.shipped_at ? '<br><small class="muted">✅ Shipped before reviews: counts as done.</small> <a class="small" href="' + reviewUrl(it.id, s.email) + '">review it anyway</a>' : '') +
        (it.extensions.length ? '<br><small>Extensions: ' + (it.extensions.filter(function (e, k) { return (p.ext || {})[k]; }).map(E).join(', ') || 'none yet') + '</small>' : '') +
        it.reflect_q.map(function (q, k) { return '<br><small class="muted">' + E(q) + '</small> <span class="ans">' + E((p.reflect || [])[k] || '—') + '</span>'; }).join('') + '</dd></dl>' +
        '<div class="feedback-form"><label class="field"><span>Feedback (the student sees it in the lesson)</span><textarea rows="2" class="fb-text" data-lesson="' + E(it.id) + '">' +
        E(it.feedback) + '</textarea></label><button class="btn small fb-go" type="button" data-lesson="' + E(it.id) + '">Save feedback</button></div></section>');
    });
    main.innerHTML = h.join('');
    main.querySelector('h1').textContent = s.name;
    d.items.forEach(function (it) {
      var t = document.querySelector('#' + CSS.escape(it.id) + ' [data-text="talk"]');
      if (t) t.textContent = (it.p && it.p.talk) || '—';
    });
    document.querySelectorAll('.fb-go').forEach(function (b) {
      b.addEventListener('click', function () {
        var text = document.querySelector('.fb-text[data-lesson="' + b.dataset.lesson + '"]').value;
        act(b, 'saveFeedback', [s.email, b.dataset.lesson, text], function () { b.disabled = false; flash('Feedback saved.', 'success'); });
      });
    });
    document.getElementById('bgo').addEventListener('click', function () {
      act(this, 'giveBonus', [s.email, document.getElementById('bx').value, document.getElementById('br').value, document.getElementById('bp').checked],
        function (r) { flash('Given! ' + (r.xp ? r.xp + ' XP' : '') + ' It shows up next time ' + s.name + ' opens Maker Lab.', 'success'); document.getElementById('bgo').disabled = false; });
    });
  };

  // ---------------------------------------------------------------- 📨 reviewing shipped projects (server: 62_review.js)
  pages['review-queue'] = function () {
    var h = ['<div class="page-head"><div><h1>📨 Review</h1><p class="muted">Shipped projects wait here, oldest first. A lesson only counts as done once you approve it.</p></div>'];
    if (d.classes.length > 1) h.push('<label class="field"><span>Class</span><select id="rq-class"><option value="">All classes</option>' +
      d.classes.map(function (c) { return '<option value="' + E(c.id) + '"' + (c.id === d.cid ? ' selected' : '') + '>' + E(c.name) + '</option>'; }).join('') + '</select></label>');
    h.push('</div>');
    if (!d.queue.length) h.push('<section class="card center review-empty"><div class="big-icon">🎉</div><h2>All caught up</h2><p class="muted">Nothing is waiting for review' + (d.cid ? ' in this class' : '') + '.</p></section>');
    else {
      h.push('<p><a class="btn" href="' + reviewUrl(d.queue[0].lesson_id, d.queue[0].email) + '">Start reviewing (' + d.queue.length + ') ▶</a></p><section class="card"><ul class="review-list plain">');
      d.queue.forEach(function (x) {
        h.push('<li><a class="review-row" href="' + reviewUrl(x.lesson_id, x.email) + '"><span data-avatar="' + A(x.avatar || {}) + '" data-size="40"></span>' +
          '<span class="grow"><b>' + E(x.name) + '</b>' + (x.partner ? ' <span class="muted">+ ' + E(x.partner) + '</span>' : '') +
          '<br><small class="muted">' + E(x.class_name) + '</small></span>' +
          '<span class="grow"><span class="review-lesson">' + E(x.icon) + ' ' + E(x.number) + '. ' + E(x.title) + '</span>' +
          (x.round > 1 ? ' <span class="chip returned">fixed · try ' + x.round + '</span>' : '') + '</span>' +
          '<small class="muted">' + E(whenSent(x.submitted_at)) + '</small><span class="btn small">Review</span></a></li>');
      });
      h.push('</ul></section>');
    }
    main.innerHTML = h.join('');
    var pick = document.getElementById('rq-class');
    if (pick) pick.addEventListener('change', function () { ML.go('/teacher/review' + (pick.value ? '/' + pick.value : '')); });
  };

  pages.review = function () {
    main.className = 'container wide';
    var s = d.student, L = d.lesson, r = d.review || {}, scores = {}, h = [];
    Object.keys(r.scores || {}).forEach(function (k) { scores[k] = r.scores[k]; });
    var mc = 'https://makecode.microbit.org/';
    var views = d.project ? [
      { id: 'code', label: 'Code + simulator', src: mc + '#pub:' + d.project },
      { id: 'sim', label: 'Simulator only', src: mc + '---run?id=' + encodeURIComponent(d.project) },
    ] : [];
    var chip = { submitted: ['submitted', '📨 Waiting for you'], approved: ['approved', '✅ Approved'], returned: ['returned', '🔧 Sent back'], draft: ['draft', '✏️ Being changed'] }[d.status] || ['draft', 'Not shipped yet'];
    h.push('<div class="page-head"><div><a class="muted small" href="/teacher/review">← Review queue</a>' +
      '<h1>' + E(L.icon) + ' ' + E(L.number) + '. ' + E(L.title) + ' <span class="chip ' + chip[0] + '">' + chip[1] + '</span></h1>' +
      '<p class="review-who"><span data-avatar="' + A(s.avatar || {}) + '" data-size="34"></span><b>' + E(s.name) + '</b>' +
      (d.partner ? ' <span>with 👥 ' + E(d.partner) + '</span>' : '') +
      (d.classes.length ? ' <span class="muted">· ' + d.classes.map(function (c) { return '<a href="/teacher/classes/' + E(c.id) + '/students/' + encodeURIComponent(s.email) + '#' + E(L.id) + '">' + E(c.name) + '</a>'; }).join(', ') + '</span>' : '') +
      (d.submitted_at ? ' <span class="muted">· shipped ' + E(whenSent(d.submitted_at)) + '</span>' : '') +
      (d.round > 1 ? ' <span class="chip returned">try ' + d.round + '</span>' : '') + '</p></div>' +
      (d.next ? '<a class="btn ghost" href="' + reviewUrl(d.next.lesson_id, d.next.email) + '">Skip to next (' + d.next.left + ' left) ▶</a>' : '') + '</div>');
    h.push('<div class="review-grid"><div class="review-main">');
    // the project, running in MakeCode
    h.push('<section class="card mc-card">');
    if (views.length) {
      h.push('<div class="mc-bar"><div class="seg" role="tablist" aria-label="How to show the project">' + views.map(function (v, i) {
        return '<button type="button" role="tab" class="seg-btn" data-view="' + v.id + '" aria-selected="' + (i === 0) + '">' + E(v.label) + '</button>';
      }).join('') + '</div><a class="btn small ghost" href="' + E(d.share) + '" target="_blank" rel="noopener">Open in MakeCode ↗</a></div>' +
        '<div class="mc-frame"><iframe id="mc-embed" title="' + E(s.name) + '\'s MakeCode project" src="' + E(views[0].src) + '" ' +
        'sandbox="allow-popups allow-forms allow-scripts allow-same-origin" allow="usb; autoplay; camera; microphone" loading="lazy"></iframe></div>' +
        '<p class="muted small">Their shared project, read-only: changes you make here don\'t touch theirs. If it stays blank, use <b>Open in MakeCode ↗</b>. Share link: <a href="' + E(d.share) + '" target="_blank" rel="noopener">' + E(d.share) + '</a></p>');
    } else if (d.share) {
      h.push('<h2>Their project</h2><p class="bad">This link isn\'t a MakeCode share link, so it can\'t be shown here.</p><p><a href="' + E(d.share) + '" target="_blank" rel="noopener">' + E(d.share) + ' ↗</a></p>' +
        '<p class="muted small">Send it back and ask them to use <b>Share</b> in MakeCode, then paste the link it gives (it starts with https://makecode.microbit.org/).</p>');
    } else h.push('<h2>Their project</h2><p class="muted">No share link yet.</p>');
    h.push('</section>');
    // what Maker Lab checked
    var c = d.checks;
    h.push('<section class="card review-checks"><h2>What Maker Lab checked</h2><ul class="plain check-list">' +
      '<li>' + (c.steps_done === c.steps_total ? '✅' : '⬜') + ' Build steps: <b>' + c.steps_done + ' of ' + c.steps_total + '</b></li>' +
      '<li>' + (c.quiz_best != null && c.quiz_best >= Math.ceil(c.quiz_total * 0.75) ? '✅' : '⬜') + ' Quiz: best <b>' + (c.quiz_best == null ? '—' : c.quiz_best) + ' of ' + c.quiz_total + '</b>' +
      (c.quiz_first != null ? ' <span class="muted">(first try ' + c.quiz_first + ')</span>' : '') + '</li>' +
      (d.extensions.length ? '<li>' + (d.extensions.some(function (e) { return e.done; }) ? '✅' : '⬜') + ' Extensions they say they added: ' +
        (d.extensions.filter(function (e) { return e.done; }).map(function (e) { return '<b>' + E(e.title) + '</b> <small class="muted">(' + E(e.level) + ')</small>'; }).join(', ') || 'none') + '</li>' : '') +
      '</ul><p class="muted small">Extensions are ticked by the student. Look for them in the code.</p></section>');
    if (d.reflect.length) {
      h.push('<section class="card"><h2>Their reflection</h2><dl class="work">');
      d.reflect.forEach(function (q) { h.push('<dt>' + E(q.q) + '</dt><dd class="ans">' + (q.a ? E(q.a) : '<span class="muted">—</span>') + '</dd>'); });
      h.push('</dl></section>');
    }
    if (L.mission) h.push('<details class="card review-mission"><summary>The mission they were given</summary><div>' + L.mission + '</div></details>');
    if (d.history.length) {
      h.push('<section class="card"><h2>Earlier reviews</h2><ol class="plain history">');
      d.history.slice().reverse().forEach(function (x) {
        h.push('<li><span class="chip ' + E(x.status) + '">' + (x.status === 'approved' ? '✅ Approved' : '🔧 Sent back') + '</span> <small class="muted">' + E(shortDate(x.at)) +
          (x.max ? ' · ' + x.total + ' of ' + x.max : '') + '</small>' + (x.feedback ? '<br>' + E(x.feedback) : '') + '</li>');
      });
      h.push('</ol></section>');
    }
    h.push('</div>');
    // the rubric
    h.push('<aside class="card rubric-card" aria-labelledby="rb-title"><h2 id="rb-title">Rubric</h2>');
    if (d.standards.length) h.push('<div class="rubric-standards"><small>Standards in this lesson</small>' + d.standards.map(function (st) {
      return '<details><summary><b>' + E(st.code) + '</b> ' + E(st.text) + '</summary><p class="small">' + E(st.how) + '</p></details>';
    }).join('') + '</div>');
    d.rubric.forEach(function (row) {
      h.push('<fieldset class="rubric-row" data-row="' + E(row.id) + '"><legend>' + E(row.label) + '</legend><div class="levels">' + row.levels.map(function (lv, i) {
        return '<button type="button" class="level-btn" data-score="' + (i + 1) + '" aria-pressed="' + (scores[row.id] === i + 1) + '"><b>' + (i + 1) + '</b><span>' + E(lv) + '</span></button>';
      }).join('') + '</div></fieldset>');
    });
    h.push('<p class="rubric-total">Total: <b id="rb-total"></b></p>' +
      '<label class="field"><span>Feedback for ' + E(s.name.split(' ')[0]) + (d.partner ? ' and ' + E(d.partner.split(' ')[0]) : '') + '</span>' +
      '<textarea id="rb-feedback" rows="5" maxlength="1500" placeholder="Name one thing that works well, and one thing to try next."></textarea></label>' +
      '<p class="small bad" id="rb-msg" role="status"></p>' +
      '<div class="rubric-actions"><button class="btn" id="rb-approve" type="button">✅ Approve</button><button class="btn ghost warn" id="rb-return" type="button">🔧 Send back for changes</button></div>' +
      '<p class="muted small">Approve finishes the lesson for them: 100%, XP, play time, and the next lesson. Send back shows them your feedback and asks them to fix it and ship again.' +
      (d.partner ? ' <b>Both partners</b> get the same review.' : '') + '</p></aside></div>');
    main.innerHTML = h.join('');
    var $ = function (id) { return document.getElementById(id); };
    $('rb-feedback').value = r.feedback || '';
    var max = d.rubric.length * 4;
    var drawTotal = function () {
      var t = 0, n = 0;
      d.rubric.forEach(function (row) { if (scores[row.id]) { t += scores[row.id]; n++; } });
      $('rb-total').textContent = t + ' of ' + max + (n < d.rubric.length ? ' (' + (d.rubric.length - n) + ' row' + (d.rubric.length - n > 1 ? 's' : '') + ' to score)' : '');
    };
    drawTotal();
    main.querySelectorAll('.rubric-row').forEach(function (fs) {
      fs.addEventListener('click', function (e) {
        var b = e.target.closest('.level-btn');
        if (!b) return;
        scores[fs.dataset.row] = Number(b.dataset.score);
        fs.querySelectorAll('.level-btn').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        fs.classList.remove('unscored');
        drawTotal();
      });
    });
    main.querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        main.querySelectorAll('.seg-btn').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        $('mc-embed').src = views.filter(function (v) { return v.id === b.dataset.view; })[0].src;
      });
    });
    var grade = function (btn, status) {
      var msg = $('rb-msg'), fb = $('rb-feedback').value.trim();
      msg.textContent = '';
      if (status === 'approved') {
        var missing = d.rubric.filter(function (row) { return !scores[row.id]; });
        if (missing.length) {
          missing.forEach(function (row) { main.querySelector('.rubric-row[data-row="' + CSS.escape(row.id) + '"]').classList.add('unscored'); });
          msg.textContent = 'Score each row of the rubric first.';
          if (window.Celebrate) window.Celebrate.nope(btn, msg);
          return;
        }
      } else if (fb.length < 3) {
        msg.textContent = 'Tell them what to fix: write a little feedback first.';
        if (window.Celebrate) window.Celebrate.nope(btn, msg);
        $('rb-feedback').focus();
        return;
      }
      $('rb-approve').disabled = $('rb-return').disabled = true;
      btn.textContent = 'Saving…';
      ML.run('gradeWork', s.email, L.id, { status: status, scores: scores, feedback: fb }).then(function (res) {
        var who = res.students.join(' and ');
        btn.textContent = status === 'approved' ? '✅ Approved' : '🔧 Sent back';
        msg.className = 'small ok';
        msg.textContent = (status === 'approved' ? 'Approved for ' : 'Sent back to ') + who + '. They\'ll see it next time they open Maker Lab.';
        if (status === 'approved' && window.Celebrate) window.Celebrate.sound('coin');
        ML.go(d.next ? reviewUrl(d.next.lesson_id, d.next.email) : '/teacher/review', msg.textContent + (d.next ? ' Tap Continue for the next project.' : ' Tap Continue to go back to the queue.'));
      }).catch(function (e) {
        $('rb-approve').disabled = $('rb-return').disabled = false;
        btn.textContent = status === 'approved' ? '✅ Approve' : '🔧 Send back for changes';
        msg.className = 'small bad';
        msg.textContent = (e && e.message) || 'Something went wrong. Try again.';
      });
    };
    $('rb-approve').addEventListener('click', function () { grade(this, 'approved'); });
    $('rb-return').addEventListener('click', function () { grade(this, 'returned'); });
  };

  pages.videos = function () {
    var h = ['<h1>Lesson videos</h1><p class="muted">Paste a link for any lesson: YouTube, Google Drive ("Anyone with the link" or your school), Vimeo, or a direct .mp4 link. ' +
      'It appears in the lesson\'s Mission.</p><div class="card" style="padding:18px">'];
    d.courses.forEach(function (co) { h.push('<h2 class="course-head">' + E(co.name) + '</h2>'); co.cards.filter(function (l) { return !l.soon; }).forEach(function (l) {
      h.push('<label class="field video-field"><span>' + E(l.icon) + ' ' + E(l.number) + '. ' + E(l.title) + '</span><input type="url" class="vid" data-lesson="' + E(l.id) + '" value="' +
        E((d.urls || {})[l.id] || '') + '" placeholder="https://youtu.be/…"></label>');
    }); });
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

  // ---------------------------------------------------------------- lesson feedback, and the report to paste to Claude
  pages.feedback = function () {
    main.className = 'container wide';
    var R = d.reasons || {}, FACES = ['😣', '😕', '😐', '🙂', '🤩'];
    var reasonText = function (rs) { return Object.keys(rs).sort(function (a, b) { return rs[b] - rs[a]; }).map(function (k) { return (R[k] || k).toLowerCase() + ' ' + rs[k]; }).join(', '); };
    var pct = function (a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; };
    var hasData = function (l) { return l.rated || l.steps.some(function (x) { return x.flags || x.help; }) || l.quiz.some(function (q) { return q.answered || q.flags; }); };
    var hotSteps = function (l) { return l.steps.filter(function (x) { return x.flags || x.help; }).sort(function (a, b) { return (b.flags * 2 + b.help) - (a.flags * 2 + a.help); }); };
    var hotQuiz = function (l) { return l.quiz.filter(function (q) { return q.flags || (q.answered && q.missed / q.answered >= 0.3); }); };

    function markdown(only) {
      var out = ['# Maker Lab lesson feedback', '', d.grade_name + ' · ' + d.generated + ' · ' + d.students + ' students in Maker Lab · student names removed', '',
        'Please use this to improve the lessons in the Maker Lab repository. Each lesson is a YAML file (path given). ' +
        'Steps are numbered the way students see them (Step 1 = the first build step). Quiz "missed" counts first tries only.', ''];
      d.lessons.filter(function (l) { return only ? l.id === only : hasData(l); }).forEach(function (l) {
        out.push('## Lesson ' + l.number + ': ' + l.title, '', 'File: `' + l.file + '`', '');
        out.push('- Students started: ' + l.started + ', finished: ' + l.finished);
        out.push('- Rating: ' + (l.rated ? l.avg + ' / 5 from ' + l.rated + ' students (' + l.ratings.map(function (c, i) { return (i + 1) + '★ ' + c; }).join(', ') + ')' : 'no ratings yet'), '');
        var hs = hotSteps(l);
        if (hs.length) {
          out.push('### Build steps students found confusing or needed help with', '', '| Step | Title | Confusing flags | Reasons | Help requests |', '|---|---|---|---|---|');
          hs.forEach(function (x) { out.push('| ' + x.n + ' | ' + x.title + ' | ' + x.flags + ' | ' + (reasonText(x.reasons) || '–') + ' | ' + x.help + ' |'); });
          out.push('');
          hs.filter(function (x) { return x.notes.length; }).forEach(function (x) { x.notes.forEach(function (n) { out.push('- Step ' + x.n + ': "' + n + '"'); }); });
          if (hs.some(function (x) { return x.notes.length; })) out.push('');
        }
        var hq = l.quiz.filter(function (q) { return q.answered || q.flags; });
        if (hq.length) {
          out.push('### Quiz', '', '| Q | Question | Missed on first try | Confusing flags |', '|---|---|---|---|');
          hq.forEach(function (q) { out.push('| ' + q.n + ' | ' + q.question.replace(/\|/g, '/') + ' | ' + pct(q.missed, q.answered) + ' (' + q.missed + '/' + q.answered + ') | ' + q.flags + (q.flags ? ' (' + reasonText(q.reasons) + ')' : '') + ' |'); });
          out.push('');
          hq.forEach(function (q) { q.notes.forEach(function (n) { out.push('- Q' + q.n + ': "' + n + '"'); }); });
          if (hq.some(function (q) { return q.notes.length; })) out.push('');
        }
        if (l.hardest.length) { out.push('### "What was the hardest part?"', ''); l.hardest.forEach(function (t) { out.push('- ' + t.replace(/\s+/g, ' ')); }); out.push(''); }
        if (l.change.length) { out.push('### "What would make this lesson better?"', ''); l.change.forEach(function (t) { out.push('- ' + t.replace(/\s+/g, ' ')); }); out.push(''); }
      });
      return out.join('\n');
    }

    var h = ['<div class="page-head"><div><h1>Lesson feedback</h1><p class="muted">What students flagged as confusing, how they rated each lesson, ' +
      'and which quiz questions they missed on the first try. No names are shown or copied.</p><p class="row">' +
      (d.grades || []).map(function (g) { return '<a class="btn small' + (g.id === d.grade ? '' : ' ghost') + '" href="/teacher/feedback/' + E(g.id) + '">' + E(g.name) + '</a>'; }).join(' ') +
      '</p></div><div class="row"><button class="btn go" id="fb-copy" type="button">📋 Copy report for Claude</button>' +
      '<button class="btn ghost" id="fb-dl" type="button">⬇ Download .md</button></div></div>' +
      '<p class="muted small">Paste the report into Claude and ask it to improve the lessons. Student notes are copied as they typed them, so skim them for names first.</p>'];
    var any = false;
    d.lessons.forEach(function (l) {
      if (!hasData(l)) return;
      any = true;
      var hs = hotSteps(l).slice(0, 5), hq = hotQuiz(l);
      h.push('<section class="card fb-card"><div class="fb-head"><h2>' + E(l.number) + '. ' + E(l.title) + '</h2><span class="fb-stars">' +
        (l.rated ? FACES[Math.max(0, Math.round(l.avg) - 1)] + ' <b>' + l.avg + '</b> / 5 <small class="muted">(' + l.rated + ')</small>' : '<small class="muted">no ratings yet</small>') +
        '</span><button class="btn small ghost fb-one" type="button" data-id="' + E(l.id) + '">📋 Copy this lesson</button></div>' +
        '<p class="muted small">' + l.started + ' started · ' + l.finished + ' finished</p><div class="grid-2">');
      h.push('<div><h3>🤔 Confusing steps</h3>' + (hs.length ? '<ul class="fb-list">' + hs.map(function (x) {
        return '<li><b>Step ' + x.n + ':</b> ' + E(x.title) + ' <span class="fb-n">' + (x.flags ? x.flags + ' 🤔' : '') + (x.help ? ' ' + x.help + ' ✋' : '') + '</span>' +
          (x.flags ? '<small>' + E(reasonText(x.reasons)) + '</small>' : '') + x.notes.slice(0, 3).map(function (n) { return '<q>' + E(n) + '</q>'; }).join('') + '</li>';
      }).join('') + '</ul>' : '<p class="muted small">Nothing flagged.</p>') + '</div>');
      h.push('<div><h3>🧠 Quiz trouble</h3>' + (hq.length ? '<ul class="fb-list">' + hq.map(function (q) {
        return '<li><b>Q' + q.n + ':</b> ' + E(q.question) + ' <span class="fb-n">' + pct(q.missed, q.answered) + ' missed</span>' + (q.flags ? '<small>' + q.flags + ' 🤔 ' + E(reasonText(q.reasons)) + '</small>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="muted small">No question missed by 30% or more.</p>') + '</div></div>');
      var words = l.hardest.slice(0, 3).map(function (t) { return '<q>' + E(t) + '</q>'; }).concat(l.change.slice(0, 3).map(function (t) { return '<q class="change">' + E(t) + '</q>'; }));
      if (words.length) h.push('<h3>💬 In their words</h3><div class="fb-quotes">' + words.join('') + '</div>');
      h.push('</section>');
    });
    if (!any) h.push('<section class="card"><p class="muted">No feedback yet for this grade. Students flag confusing steps with 🤔 and rate each lesson at the end.</p></section>');
    main.innerHTML = h.join('');
    var copyText = function (text, btn) {
      var done = function () { var t = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(function () { btn.textContent = t; }, 1600); };
      var fallback = function () { var ta = document.body.appendChild(document.createElement('textarea')); ta.value = text; ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* select it */ } ta.remove(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    };
    document.getElementById('fb-copy').addEventListener('click', function () { copyText(markdown(), this); });
    document.querySelectorAll('.fb-one').forEach(function (b) { b.addEventListener('click', function () { copyText(markdown(b.dataset.id), b); }); });
    document.getElementById('fb-dl').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' }));
      a.download = 'maker-lab-feedback-' + d.grade + '-' + d.generated + '.md';
      document.body.appendChild(a); a.click(); a.remove();
    });
  };

  // ---------------------------------------------------------------- 🐞 problem reports (from students, the teacher and page errors)
  pages.reports = function () {
    main.className = 'container wide';
    var show = 'new', K = d.kinds || {};
    var when = function (iso) { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    function markdown(list) {
      var out = ['# Maker Lab problem reports', '', list.length + ' report(s) · student names removed · app version ' + ((list[0] || {}).version || '?'), '',
        'Please use these to find and fix bugs in the Maker Lab repository (Apps Script app in apps_script/, lessons in course/lessons/).', ''];
      list.forEach(function (b, i) {
        out.push('## ' + (i + 1) + '. ' + (K[b.kind] || b.kind) + ' · ' + b.at.slice(0, 16).replace('T', ' '), '');
        if (b.text) out.push('> ' + b.text.replace(/\n+/g, ' '), '');
        out.push('- Page: `' + b.page + '`' + (b.lesson_title ? ' · lesson ' + b.lesson_title + ' (`' + b.file + '`)' : '') +
          (b.stage ? ' · stage ' + b.stage : '') + (b.step_title ? ' · ' + b.step_title : ''));
        out.push('- Browser: ' + b.browser + ' · screen ' + b.screen + (b.lang && b.lang !== 'en' ? ' · language ' + b.lang : '') + ' · version ' + b.version);
        if (b.errors && b.errors.length) { out.push('- Page errors:'); b.errors.forEach(function (e) { out.push('  - `' + e.replace(/`/g, "'") + '`'); }); }
        out.push('');
      });
      return out.join('\n');
    }
    function draw() {
      var list = d.bugs.filter(function (b) { return show === 'all' || b.status === show; });
      var counts = { new: 0, fixed: 0 };
      d.bugs.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
      var h = ['<div class="page-head"><div><h1>🐞 Problem reports</h1><p class="muted">What students reported with "Report a problem", plus page errors ' +
        'caught on their own. Students\' names are shown here but never copied into the report for Claude.</p><p class="row">' +
        [['new', 'New (' + counts.new + ')'], ['fixed', 'Fixed (' + counts.fixed + ')'], ['all', 'All (' + d.bugs.length + ')']].map(function (t) {
          return '<button type="button" class="btn small' + (t[0] === show ? '' : ' ghost') + '" data-show="' + t[0] + '">' + t[1] + '</button>';
        }).join(' ') + '</p></div><div class="row"><button class="btn go" id="bug-copy" type="button">📋 Copy for Claude</button></div></div>'];
      if (!list.length) h.push('<section class="card"><p class="muted">No ' + (show === 'all' ? '' : show + ' ') + 'reports. 🎉</p></section>');
      list.forEach(function (b) {
        h.push('<section class="card bug-card ' + E(b.status) + '"><div class="fb-head"><b class="bug-kind">' + E(K[b.kind] || b.kind) + '</b>' +
          '<span class="muted small">' + E(when(b.at)) + ' · <span translate="no">' + E(b.name) + '</span></span>' +
          '<span class="row"><button class="btn small ' + (b.status === 'fixed' ? 'ghost' : 'go') + '" type="button" data-id="' + E(b.id) + '" data-st="' + (b.status === 'fixed' ? 'new' : 'fixed') + '">' +
          (b.status === 'fixed' ? 'Mark new' : '✓ Fixed') + '</button><button class="btn small ghost" type="button" data-id="' + E(b.id) + '" data-st="deleted">Delete</button></span></div>' +
          (b.text ? '<p class="bug-text">' + E(b.text) + '</p>' : '') +
          '<p class="small muted">' + E(b.page) + (b.lesson_title ? ' · ' + E(b.lesson_title) : '') + (b.step_title ? ' · ' + E(b.step_title) : b.stage ? ' · ' + E(b.stage) : '') +
          (b.lang && b.lang !== 'en' ? ' · ' + E(b.lang) : '') + ' · ' + E(b.screen) + '</p>' +
          (b.errors && b.errors.length ? '<details><summary class="small">Page errors (' + b.errors.length + ')</summary><pre class="code-block small">' + E(b.errors.join('\n')) + '</pre></details>' : '') +
          '</section>');
      });
      main.innerHTML = h.join('');
      main.querySelectorAll('[data-show]').forEach(function (b) { b.addEventListener('click', function () { show = b.dataset.show; draw(); }); });
      main.querySelectorAll('[data-st]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.dataset.st === 'deleted' && !confirm('Delete this report?')) return;
          act(b, 'bugUpdate', [b.dataset.id, b.dataset.st], function (r) { d.bugs = r.bugs; draw(); });
        });
      });
      document.getElementById('bug-copy').addEventListener('click', function () {
        var text = markdown(list), btn = this;
        var ok = function () { btn.textContent = '✓ Copied'; setTimeout(function () { btn.textContent = '📋 Copy for Claude'; }, 1600); };
        var fallback = function () { var ta = document.body.appendChild(document.createElement('textarea')); ta.value = text; ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* select */ } ta.remove(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
      });
    }
    draw();
  };

  pages.standards = function () {
    var h = ['<h1>MA DLCS standards</h1><p class="muted">What each lesson covers, and how.</p>'];
    d.lessons.forEach(function (l) {
      h.push('<section class="card" style="padding:16px;margin-bottom:14px"><h2><span class="grade-tag">' + E(l.course || '') + '</span> ' + E(l.number) + '. ' + E(l.title) + '</h2><ul>' +
        l.standards.map(function (st) { return '<li><b>' + E(st.code) + '</b> ' + E(st.text) + '<br><small class="muted">In this lesson: ' + E(st.how) + '</small></li>'; }).join('') + '</ul></section>');
    });
    main.innerHTML = h.join('');
  };

  // ---------------------------------------------------------------- class display (projector)
  pages.screen = function () {
    main.innerHTML = '<div id="screen-root"></div>';
    var id = d.cls.id;
    window.ClassScreen.start({
      classId: id, className: d.cls.name, backHref: '/teacher/classes/' + id, units: d.units, refreshMs: 20000,
      load: function () { return ML.run('screenData', id); },
      save: function (body) { return ML.run('screenSave', id, body); },
      arcade: function (action, minutes) { return ML.run('arcadeClass', id, action, minutes); },
      help: function () { return ML.run('helpList', id); },
      helped: function (who) { return ML.run('helpResolve', id, who); },
    });
  };

  window.MLStart = function () {
    if (pages[ML.page]) pages[ML.page]();
    if (window.RobotAvatar) window.RobotAvatar.renderAll();
    if (window.Visuals) window.Visuals.renderAll();
    ML.fixLinks(document);
    if (window.MLTranslate) window.MLTranslate.start();
    if (window.MLReview) window.MLReview.start();
    try { if (sessionStorage.getItem('ml-reopen-prefs')) { sessionStorage.removeItem('ml-reopen-prefs'); window.MLPrefs.open(); } } catch (e) { /* fine */ }
  };
})();
