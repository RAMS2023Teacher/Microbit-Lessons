/* Class display for the projector: time left in class, the question of the day (the lesson's
 * essential question), a race track of where everyone is (with their robot), the standards in play, and recent wins. Shared by the Flask site and the Apps Script version:
 *   ClassScreen.start({ classId, className, backHref, units, load: () => Promise<data>, save: (settings) => Promise<data> })
 * Everything a student typed is put on the page with textContent, never as HTML. */
(function () {
  'use strict';

  function start(C) {
    const root = document.getElementById('screen-root');
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    let data = null;

    // ----- page skeleton (static markup only) -----
    root.innerHTML = '<div class="screen-stage" id="screen-stage">' +
      '<header class="screen-head"><div><h1 id="screen-class"></h1><p id="screen-lesson"></p></div>' +
      '<div class="screen-goal" id="screen-goal" hidden><div class="goal-top"><b>🎯 Class goal today</b><span id="goal-num"></span></div>' +
      '<div class="goal-bar"><i id="goal-fill"></i></div><div class="goal-note" id="goal-note"></div></div>' +
      '<b id="screen-total" class="screen-total"></b><div class="screen-tools">' +
      '<button type="button" class="help-pill" id="help-pill" hidden></button>' +
      '<button type="button" class="btn small ghost" id="bell-test" title="Help sound: click once so this computer can play it">🔔</button>' +
      '<button type="button" class="btn small arcade-btn" id="arcade-toggle">🎮 Open arcade</button>' +
      '<button type="button" class="btn small ghost" id="set-open">⚙ Set up</button>' +
      '<button type="button" class="btn small ghost" id="set-full">⛶ Full screen</button>' +
      '<a class="btn small ghost" id="screen-exit">Exit</a></div></header>' +
      '<section class="help-dock" id="help-dock" hidden><h2>✋ Needs help</h2><ul id="help-list"></ul></section>' +
      '<p class="screen-offline" id="screen-offline" hidden>Can\'t reach Maker Lab. Retrying…</p>' +
      '<p class="screen-offline" id="screen-fullhint" hidden>Press your keyboard\'s full-screen key (or F11) to fill the screen.</p>' +
      '<section class="card screen-setup" id="screen-setup" hidden><div class="setup-head"><h2>⚙ Set up</h2>' +
      '<button type="button" class="setup-x" id="set-close" aria-label="Close set up">✕</button></div>' +
      '<label class="field"><span>Today\'s lesson</span><select id="set-lesson"></select></label>' +
      '<label class="field"><span>Question of the day</span><textarea id="set-question" rows="2" maxlength="300" ' +
      'placeholder="Leave blank to use the lesson\'s essential question."></textarea></label>' +

      '<div class="grid-3 screen-set-grid"><label class="field"><span>Class ends at (for "time left")</span><input type="time" id="set-bell"></label>' +
      '<label class="field"><span>Show students as</span><select id="set-names"><option value="first">First names</option>' +
      '<option value="robot">Robot names</option></select></label>' +
      '<label class="field"><span>XP</span><select id="set-xp"><option value="each">Each student and class total</option>' +
      '<option value="total">Class total only</option><option value="hide">Hide XP</option></select></label>' +
      '<label class="field"><span>Class XP goal for today</span><input type="number" id="set-goal" min="0" step="50" ' +
      'placeholder="Auto: 60 per student"><small class="muted">0 turns the goal off</small></label>' +
      '<label class="field"><span>Show progress as</span><select id="set-view"><option value="track">Race track</option>' +
      '<option value="cards">Cards</option></select></label></div>' +
      '<div class="row"><button type="button" class="btn" id="set-save">Save</button><button type="button" class="btn ghost" id="set-done">Done</button>' +
      '<span class="muted small" id="set-status"></span></div></section>' +
      '<div class="screen-grid"><div class="screen-left"><section class="card screen-roster" aria-label="Where everyone is">' +
      '<div class="screen-roster-head"><h2 id="roster-title">Where everyone is</h2><span class="muted" id="screen-counts"></span></div>' +
      '<div class="screen-students" id="screen-students"></div><div class="track-wrap" id="screen-track"></div>' +
      '<div class="track-elsewhere" id="screen-elsewhere"></div></section>' +
      '<section class="card"><h2>🎯 Standards we\'re working on</h2><ul class="screen-stds" id="screen-standards"></ul></section></div>' +
      '<aside class="screen-side">' +
      '<section class="card screen-timer" aria-label="Time"><div class="screen-clock-label" id="clock-label">Time left in class</div>' +
      '<div id="timer-big" class="timer-big" role="timer">--:--</div>' +
      '<div class="screen-now" id="clock-note"></div>' +
      '<div class="screen-bell-quick" id="bell-quick" hidden><label>Class ends at <input type="time" id="bell-quick-in"></label>' +
      '<button type="button" class="btn small" id="bell-quick-go">Count down</button></div>' +
      '</section>' +
      '<section class="card"><h2>❓ Question of the day</h2><p class="screen-big" id="screen-question"></p>' +
      '<p class="screen-bigidea" id="screen-bigidea"></p></section>' +
      '<section class="card"><h2 id="wins-title">🏆 Recent wins</h2><ul class="screen-wins" id="screen-wins"></ul></section>' +
      '</aside></div></div>';
    const $ = (id) => document.getElementById(id);
    $('screen-class').textContent = C.className || 'Class';
    const nameLen = (C.className || '').length;                  // long class names shrink instead of being cut off
    if (nameLen > 22) $('screen-class').style.fontSize = Math.max(1.05, 2.1 - (nameLen - 22) * 0.045) + 'rem';
    $('screen-exit').setAttribute('href', C.backHref || '/');
    $('set-lesson').appendChild(el('option', '', 'Automatic: the lesson most students are on')).value = '';
    (C.units || []).forEach((u) => {
      const g = $('set-lesson').appendChild(el('optgroup'));
      g.label = u.title;
      u.lessons.forEach((l) => { const o = g.appendChild(el('option', '', `${l.number}. ${l.title}`)); o.value = l.id; });
    });

    // ----- where everyone is -----
    function tile(s, showXp) {
      const t = el('div', `screen-tile ${s.status}${helpWho.has(s.who) ? ' needs-help' : ''}`);
      t.dataset.who = s.who || '';
      if (s.idle) { t.classList.add('zzz'); t.title = `No clicks or typing for ${s.idle} min`; }
      const av = t.appendChild(el('div', 'screen-avatar'));
      av.innerHTML = window.RobotAvatar.svg(s.avatar, 76);   // drawn from known parts, not typed text
      const info = t.appendChild(el('div', 'screen-who'));
      info.appendChild(el('b', '', s.name));
      if (window.RobotAvatar.card(s.avatar)) info.insertAdjacentHTML('beforeend', window.RobotAvatar.card(s.avatar, 'tiny'));
      info.appendChild(el('span', '', s.where));
      const meter = info.appendChild(el('span', 'meter'));
      meter.appendChild(el('i')).style.width = s.pct + '%';
      if (showXp) info.appendChild(el('small', '', `⚡ ${s.xp} XP · Lv ${s.level || 1}`));
      return t;
    }
    const ago = (iso) => {
      const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
    };
    // ----- race track: one stop per section of today's lesson; each robot sits where its student is -----
    const lastPos = {};
    function racer(st, moved) {
      const r = el('div', 'racer' + (moved ? ' moved' : '') + (st.status === 'waiting' ? ' idle' : '') + (helpWho.has(st.who) ? ' needs-help' : ''));
      r.dataset.who = st.who || '';
      const av = r.appendChild(el('div', 'racer-bot'));
      av.innerHTML = window.RobotAvatar.svg(st.avatar, 96);
      const nm = r.appendChild(el('b', '', st.name));
      if (st.name.length > 6) nm.style.fontSize = `calc((var(--bot) * .2 + 13px) * ${(6.5 / st.name.length).toFixed(3)})`;   // long names shrink to fit
      if (data.settings.xp === 'each') r.appendChild(el('small', '', `Lv ${st.level || 1}`));
      r.title = `${st.name}${st.avatar && st.avatar.card_text ? ' (' + st.avatar.card_text + ')' : ''}: ${st.where}`;
      if (st.idle) { r.classList.add('zzz'); r.title += ` · no clicks or typing for ${st.idle} min`; }
      return r;
    }
    // Robots are as big as they can be while the busiest stop still fits on the screen.
    function fitRacers(wrap, track, lanes) {
      const fits = (b) => {
        track.style.setProperty('--bot', b + 'px');
        track.classList.toggle('small-bots', b < 56);
        const bottom = wrap.getBoundingClientRect().bottom - 4;   // screen coordinates, so the display's scaling doesn't matter
        return lanes.every((l) => !l.lastElementChild || l.lastElementChild.getBoundingClientRect().bottom <= bottom);
      };
      let lo = 24, hi = 120;                                   // biggest size that still fits, measured on the page
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2 / 2) * 2; if (fits(mid)) lo = mid; else hi = mid - 2; }
      fits(lo);
    }
    function renderTrack() {
      const wrap = $('screen-track'), stops = data.track || [], n = stops.length;
      wrap.textContent = '';
      const cols = [{ icon: '🚦', name: 'Start' }].concat(stops, [{ icon: '🏁', name: 'Finish!' }]);
      const track = wrap.appendChild(el('div', 'track'));
      track.style.setProperty('--cols', cols.length);
      const lanes = cols.map((c, i) => {
        const col = track.appendChild(el('div', 'track-col' + (i === 0 ? ' start' : i === cols.length - 1 ? ' finish' : '')));
        const head = col.appendChild(el('div', 'track-stop'));
        head.appendChild(el('span', 'track-icon', c.icon));
        head.appendChild(el('span', 'track-name', c.name));
        return col.appendChild(el('div', 'track-lane'));
      });
      const elsewhere = [];
      data.students.forEach((st) => {
        if (st.done == null && st.elsewhere) { elsewhere.push(st); return; }
        // on stop k = working on section k; all n done = finish line
        const pos = st.done == null ? 0 : st.done >= n ? n + 1 : st.done + 1;
        const moved = lastPos[st.name] != null && pos > lastPos[st.name];
        lastPos[st.name] = pos;
        lanes[pos].appendChild(racer(st, moved));
      });
      lanes.forEach((lane) => { if (lane.children.length) lane.parentElement.classList.add('busy'); });
      // busy stops get more room, so a crowd of robots doesn't have to shrink
      track.style.gridTemplateColumns = lanes.map((l) => `minmax(112px, ${Math.max(1, Math.sqrt(l.children.length)).toFixed(2)}fr)`).join(' ');
      fitRacers(wrap, track, lanes);
      const refit = () => { if (track.isConnected) fitRacers(wrap, track, lanes); };   // again once fonts and layout settle
      requestAnimationFrame(refit);
      setTimeout(refit, 600);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
      const box = $('screen-elsewhere');
      box.textContent = '';
      if (elsewhere.length) {
        box.appendChild(el('b', '', 'On other lessons: '));
        elsewhere.forEach((st) => {
          const chip = box.appendChild(el('span', 'else-chip'));
          chip.appendChild(el('span', 'else-bot')).innerHTML = window.RobotAvatar.svg(st.avatar, 26);
          chip.appendChild(el('span', '', `${st.name} · ${st.elsewhere.split('.')[0]}`));
          chip.title = st.elsewhere;
        });
      }
    }

    function render() {
      const cards = data.settings.view === 'cards';
      const box = $('screen-students');
      box.textContent = '';
      box.hidden = !cards;
      $('screen-track').hidden = cards;
      $('screen-elsewhere').hidden = cards;
      if (!data.students.length) (cards ? box : $('screen-track')).textContent = 'No students in this class yet.';
      if (cards) data.students.forEach((s) => box.appendChild(tile(s, data.settings.xp === 'each')));
      else if (data.students.length) renderTrack();
      $('roster-title').textContent = cards ? 'Where everyone is' : `🏎️ Race to the finish: ${data.lesson.number}. ${data.lesson.title}`;
      const n = (st) => data.students.filter((s) => s.status === st).length;
      $('screen-counts').textContent = data.students.length ? `${n('working')} working · ${n('done')} done · ${n('waiting')} not started` + (data.students.some((x) => x.idle) ? ` · 💤 ${data.students.filter((x) => x.idle).length} idle` : '') : '';
      $('screen-total').hidden = data.settings.xp === 'hide';
      $('screen-total').textContent = `⚡ ${data.total_xp} class XP`;
      const g = data.goal;
      $('screen-goal').hidden = !g;
      if (g) {
        const pct = Math.min(100, Math.round(100 * g.today / g.target)), hit = g.today >= g.target;
        $('goal-num').textContent = `${g.today.toLocaleString()} / ${g.target.toLocaleString()} XP`;
        $('goal-fill').style.width = pct + '%';
        $('screen-goal').classList.toggle('hit', hit);
        $('goal-note').textContent = hit ? '🎉 Goal reached! Great work, everyone!' :
          `${(g.target - g.today).toLocaleString()} XP to go · every step, quiz and ship counts`;
      }
      $('screen-lesson').textContent = data.lesson ? `Today: ${data.lesson.number}. ${data.lesson.title}` : '';
      $('screen-question').textContent = data.question || 'Add a question in ⚙ Set up.';
      $('screen-bigidea').textContent = data.big_idea || '';
      const stds = $('screen-standards');
      stds.textContent = '';
      (data.standards || []).forEach((st) => {
        const li = stds.appendChild(el('li'));
        const top = li.appendChild(el('div', 'std-top'));
        top.appendChild(el('b', 'std-code', st.code));
        if (st.students) top.appendChild(el('span', 'std-count', `${st.students} student${st.students === 1 ? '' : 's'}`));
        li.appendChild(el('div', 'std-text', st.text));
        li.title = st.lessons.join(', ');
      });
      if (!(data.standards || []).length) stds.appendChild(el('li', 'muted', 'This lesson has no standards listed.'));
      const wins = $('screen-wins');
      wins.textContent = '';
      drawArcade();
      if (!(data.wins || []).length) wins.appendChild(el('li', 'muted', 'Badges, finished lessons and perfect quizzes show up here.'));
      (data.wins || []).slice(0, 5).forEach((w) => {
        const li = wins.appendChild(el('li'));
        li.appendChild(el('span', 'win-icon', w.icon));
        li.appendChild(el('span', 'win-text', w.text));
        li.appendChild(el('small', 'muted', ago(w.at)));
      });
      fillSetup();
      drawClock();
    }

    // ----- Robot Rush: closed unless the teacher opens it here (or on the class page) -----
    let arcadeEnd = null;
    const arcadeOpen = () => arcadeEnd && arcadeEnd > Date.now();
    function drawArcade() {
      const a = data && data.arcade;
      if (a) arcadeEnd = a.open ? Date.now() + a.seconds_left * 1000 : null;
      const btn = $('arcade-toggle');
      btn.classList.toggle('on', !!arcadeOpen());
      btn.textContent = arcadeOpen() ? '🎮 Arcade open · Close' : '🎮 Open arcade';
    }
    $('arcade-toggle').addEventListener('click', async () => {
      const btn = $('arcade-toggle');
      btn.disabled = true;
      try {
        if (arcadeOpen()) {
          if (!confirm('Close the arcade? Students keep the play time they saved.')) return;
          await C.arcade('close');
        } else {
          const bell = bellSeconds();                 // open until the bell when it's set, otherwise for an hour
          await C.arcade('open', bell ? Math.max(5, Math.ceil(bell / 60)) : 60);
        }
        await refresh();
      } catch (e) {
        alert((e && e.message) || 'Could not change the arcade.');
      } finally { btn.disabled = false; }
    });

    // ----- ✋ help requests: checked every few seconds, a doorbell for each new one -----
    let helpWho = new Set(), seenHelp = null;
    const minsAgo = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m + ' min'; };
    function drawHelp(list) {
      list = list || [];
      const keys = list.map((r) => r.who + '|' + r.at);
      if (seenHelp && keys.some((k) => !seenHelp.has(k)) && window.SFX) window.SFX.play('help');
      seenHelp = new Set(keys);
      helpWho = new Set(list.map((r) => r.who));
      document.querySelectorAll('[data-who]').forEach((n) => n.classList.toggle('needs-help', helpWho.has(n.dataset.who)));
      const pill = $('help-pill'), dock = $('help-dock'), ul = $('help-list');
      pill.hidden = dock.hidden = !list.length;
      pill.textContent = `✋ ${list.length} need${list.length === 1 ? 's' : ''} help`;
      ul.textContent = '';
      list.forEach((r) => {
        const li = ul.appendChild(el('li'));
        li.appendChild(el('span', 'else-bot')).innerHTML = window.RobotAvatar.svg(r.avatar, 40);
        const info = li.appendChild(el('div', 'help-info'));
        info.appendChild(el('b', '', r.name));
        info.appendChild(el('span', '', r.where));
        if (r.note) info.appendChild(el('q', '', r.note));
        li.appendChild(el('small', 'muted', minsAgo(r.at)));
        const ok = li.appendChild(el('button', 'btn small go', '✓ Helped'));
        ok.type = 'button';
        ok.addEventListener('click', async () => { ok.disabled = true; try { drawHelp(await C.helped(r.who)); } catch (e) { ok.disabled = false; } });
      });
    }
    async function pollHelp() {
      if (!C.help || document.hidden) return;                      // never from a background tab
      try { drawHelp(await C.help()); } catch (e) { /* try again next time */ }
    }
    $('help-pill').addEventListener('click', () => $('help-dock').scrollIntoView({ block: 'nearest' }));
    $('bell-test').addEventListener('click', () => { if (window.SFX) { if (window.SFX.muted()) window.SFX.toggle(); window.SFX.play('help'); } });
    setInterval(pollHelp, 10000);                                  // 10 s: fast enough to notice, light on the server

    async function refresh() {
      if (document.hidden) return;
      try {
        data = await C.load();
        $('screen-offline').hidden = true;
        render();
        drawHelp(data.help);
      } catch (e) {
        $('screen-offline').hidden = false;
      }
    }

    // ----- setup panel: only the teacher needs this, so it stays closed -----
    let filled = false;
    function fillSetup() {
      if (filled) return;
      filled = true;
      $('set-lesson').value = data.auto_lesson ? '' : data.lesson.id;
      $('set-question').value = data.settings.question || '';
      $('set-names').value = data.settings.names;
      $('set-xp').value = data.settings.xp;
      $('set-bell').value = data.settings.bell || '';
      $('set-view').value = data.settings.view || 'track';
      $('set-goal').value = data.settings.goal === '' || data.settings.goal == null ? '' : data.settings.goal;
    }
    async function save(extra) {
      $('set-status').textContent = 'Saving…';
      try {
        data = await C.save(Object.assign({
          lesson_id: $('set-lesson').value, question: $('set-question').value, view: $('set-view').value,
          names: $('set-names').value, xp: $('set-xp').value, bell: $('set-bell').value, goal: $('set-goal').value,
        }, extra || {}));
        $('set-status').textContent = 'Saved ✓';
        render();
      } catch (e) {
        $('set-status').textContent = 'Could not save: ' + ((e && e.message) || 'try again');
      }
    }
    const closeSetup = () => { $('screen-setup').hidden = true; };
    $('set-open').addEventListener('click', (e) => { e.stopPropagation(); $('screen-setup').hidden = !$('screen-setup').hidden; });
    $('set-close').addEventListener('click', closeSetup);
    $('set-done').addEventListener('click', closeSetup);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSetup(); });
    document.addEventListener('click', (e) => {            // a click anywhere else on the display closes it
      if (!$('screen-setup').hidden && !$('screen-setup').contains(e.target) && e.target !== $('set-open')) closeSetup();
    });
    $('set-save').addEventListener('click', async () => { await save(); setTimeout(closeSetup, 700); });
    $('set-lesson').addEventListener('change', () => save());
    $('set-view').addEventListener('change', () => save());
    $('set-full').addEventListener('click', () => {
      const d = document;
      if (d.fullscreenElement) { d.exitFullscreen(); return; }
      const go = d.documentElement.requestFullscreen && d.fullscreenEnabled !== false ? d.documentElement.requestFullscreen() : Promise.reject();
      Promise.resolve(go).catch(() => {      // Apps Script's frame doesn't allow it: say how instead
        $('screen-fullhint').hidden = false;
        setTimeout(() => { $('screen-fullhint').hidden = true; }, 6000);
      });
    });

    // ----- the clock: time left until the bell (or the time now) -----
    const fmt = (s) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') : Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    function bellSeconds() {
      const b = data && data.settings.bell;
      if (!b || !/^\d{1,2}:\d{2}$/.test(b)) return null;
      const [h, m] = b.split(':').map(Number), end = new Date();
      end.setHours(h, m, 0, 0);
      return Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }
    const clockText = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    function drawClock() {
      const bell = bellSeconds(), now = clockText(new Date());
      const big = $('timer-big');
      if (bell !== null) {
        const end = new Date(new Date().setHours(...data.settings.bell.split(':').map(Number), 0, 0));
        $('clock-label').textContent = bell > 0 ? 'Time left in class' : 'Class is over';
        big.textContent = fmt(bell);
        big.classList.remove('clock');
        big.classList.toggle('over', bell === 0);
        big.classList.toggle('soon', bell > 0 && bell <= 300);
        $('clock-note').textContent = `Now ${now}  ·  Class ends ${clockText(end)}`;
        $('bell-quick').hidden = true;
      } else {
        $('clock-label').textContent = 'Time now';
        big.textContent = now;
        big.classList.remove('over', 'soon');
        big.classList.add('clock');
        $('clock-note').textContent = '';
        $('bell-quick').hidden = !data;
      }
    }
    $('bell-quick-go').addEventListener('click', () => {
      const v = $('bell-quick-in').value;
      if (!/^\d{1,2}:\d{2}$/.test(v)) return;
      $('set-bell').value = v;
      save({ bell: v });
    });
    setInterval(drawClock, 250);
    drawClock();

    // ----- always fit the screen: lay out at 1600×900 and scale, like a slide -----
    const W = 1600, H = 900;
    function fit() {
      const k = Math.min(window.innerWidth / W, window.innerHeight / H);
      const stage = $('screen-stage');
      stage.style.transform = `scale(${k})`;
      stage.style.left = `${Math.max(0, (window.innerWidth - W * k) / 2)}px`;
      stage.style.top = `${Math.max(0, (window.innerHeight - H * k) / 2)}px`;
    }
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    fit();

    refresh();
    setInterval(refresh, C.refreshMs || 20000);
    document.addEventListener('visibilitychange', refresh);
  }

  window.ClassScreen = { start };
})();
