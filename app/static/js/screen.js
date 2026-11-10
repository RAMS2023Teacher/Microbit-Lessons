/* Class display for the projector: time left in class, an activity timer, the question of the day (the lesson's
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
    root.innerHTML =
      '<header class="screen-head"><div><h1 id="screen-class"></h1><p id="screen-lesson"></p></div>' +
      '<b id="screen-total" class="screen-total"></b><div class="screen-tools">' +
      '<button type="button" class="btn small ghost" id="set-open">⚙ Set up</button>' +
      '<button type="button" class="btn small ghost" id="set-full">⛶ Full screen</button>' +
      '<a class="btn small ghost" id="screen-exit">Exit</a></div></header>' +
      '<p class="screen-offline" id="screen-offline" hidden>Can\'t reach Maker Lab. Retrying…</p>' +
      '<p class="screen-offline" id="screen-fullhint" hidden>Press your keyboard\'s full-screen key (or F11) to fill the screen.</p>' +
      '<section class="card screen-setup" id="screen-setup" hidden>' +
      '<label class="field"><span>Today\'s lesson</span><select id="set-lesson"></select></label>' +
      '<label class="field"><span>Question of the day</span><textarea id="set-question" rows="2" maxlength="300" ' +
      'placeholder="Leave blank to use the lesson\'s essential question."></textarea></label>' +

      '<div class="grid-3"><label class="field"><span>Class ends at (for "time left")</span><input type="time" id="set-bell"></label>' +
      '<label class="field"><span>Show students as</span><select id="set-names"><option value="first">First names</option>' +
      '<option value="robot">Robot names</option></select></label>' +
      '<label class="field"><span>XP</span><select id="set-xp"><option value="each">Each student and class total</option>' +
      '<option value="total">Class total only</option><option value="hide">Hide XP</option></select></label>' +
      '<label class="field"><span>Show progress as</span><select id="set-view"><option value="track">Race track</option>' +
      '<option value="cards">Cards</option></select></label></div>' +
      '<div class="row"><button type="button" class="btn" id="set-save">Save</button><span class="muted small" id="set-status"></span></div></section>' +
      '<div class="screen-grid"><div class="screen-left"><section class="card screen-roster" aria-label="Where everyone is">' +
      '<div class="screen-roster-head"><h2 id="roster-title">Where everyone is</h2><span class="muted" id="screen-counts"></span></div>' +
      '<div class="screen-students" id="screen-students"></div><div class="track-wrap" id="screen-track"></div>' +
      '<div class="track-elsewhere" id="screen-elsewhere"></div></section>' +
      '<section class="card"><h2>🎯 Standards we\'re working on</h2><ul class="screen-stds" id="screen-standards"></ul></section></div>' +
      '<aside class="screen-side">' +
      '<section class="card screen-timer" aria-label="Time"><div class="screen-clock-label" id="clock-label">Time left in class</div>' +
      '<div id="timer-big" class="timer-big" role="timer">--:--</div><div class="muted small" id="clock-note"></div>' +
      '<div class="screen-activity"><b>Activity timer</b> <span id="act-clock" class="act-clock">5:00</span>' +
      '<button type="button" class="btn small" id="act-go">Start</button><button type="button" class="btn small ghost" id="act-reset">Reset</button>' +
      '<label class="small">min <input type="number" id="act-mins" min="1" max="120" value="5"></label></div></section>' +
      '<section class="card"><h2>❓ Question of the day</h2><p class="screen-big" id="screen-question"></p>' +
      '<p class="screen-bigidea" id="screen-bigidea"></p></section>' +
      '<section class="card"><h2>🏆 Recent wins</h2><ul class="screen-wins" id="screen-wins"></ul></section>' +
      '</aside></div>';
    const $ = (id) => document.getElementById(id);
    $('screen-class').textContent = C.className || 'Class';
    $('screen-exit').setAttribute('href', C.backHref || '/');
    $('set-lesson').appendChild(el('option', '', 'Automatic: the lesson most students are on')).value = '';
    (C.units || []).forEach((u) => {
      const g = $('set-lesson').appendChild(el('optgroup'));
      g.label = u.title;
      u.lessons.forEach((l) => { const o = g.appendChild(el('option', '', `${l.number}. ${l.title}`)); o.value = l.id; });
    });

    // ----- where everyone is -----
    function tile(s, showXp) {
      const t = el('div', `screen-tile ${s.status}`);
      const av = t.appendChild(el('div', 'screen-avatar'));
      av.innerHTML = window.RobotAvatar.svg(s.avatar, 52);   // drawn from known parts, not typed text
      const info = t.appendChild(el('div', 'screen-who'));
      info.appendChild(el('b', '', s.name));
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
      const r = el('div', 'racer' + (moved ? ' moved' : '') + (st.status === 'waiting' ? ' idle' : ''));
      const av = r.appendChild(el('div', 'racer-bot'));
      av.innerHTML = window.RobotAvatar.svg(st.avatar, 42);
      r.appendChild(el('b', '', st.name));
      if (data.settings.xp === 'each') r.appendChild(el('small', '', `Lv ${st.level || 1}`));
      r.title = `${st.name}: ${st.where}`;
      return r;
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
      lanes.forEach((lane, i) => { if (lane.children.length) lane.parentElement.classList.add('busy'); });
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
      $('screen-counts').textContent = data.students.length ? `${n('working')} working · ${n('done')} done · ${n('waiting')} not started` : '';
      $('screen-total').hidden = data.settings.xp === 'hide';
      $('screen-total').textContent = `⚡ ${data.total_xp} class XP`;
      $('screen-lesson').textContent = data.lesson ? `Today: ${data.lesson.number}. ${data.lesson.title}` : '';
      $('screen-question').textContent = data.question || 'Add a question in ⚙ Set up.';
      $('screen-bigidea').textContent = data.big_idea ? `Big idea: ${data.big_idea}` : '';
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
      if (!(data.wins || []).length) wins.appendChild(el('li', 'muted', 'Badges, finished lessons and perfect quizzes show up here.'));
      (data.wins || []).forEach((w) => {
        const li = wins.appendChild(el('li'));
        li.appendChild(el('span', 'win-icon', w.icon));
        li.appendChild(el('span', 'win-text', w.text));
        li.appendChild(el('small', 'muted', ago(w.at)));
      });
      fillSetup();
      drawClock();
    }

    async function refresh() {
      if (document.hidden) return;
      try {
        data = await C.load();
        $('screen-offline').hidden = true;
        render();
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
    }
    async function save(extra) {
      $('set-status').textContent = 'Saving…';
      try {
        data = await C.save(Object.assign({
          lesson_id: $('set-lesson').value, question: $('set-question').value, view: $('set-view').value,
          names: $('set-names').value, xp: $('set-xp').value, bell: $('set-bell').value,
        }, extra || {}));
        $('set-status').textContent = 'Saved ✓';
        render();
      } catch (e) {
        $('set-status').textContent = 'Could not save: ' + ((e && e.message) || 'try again');
      }
    }
    $('set-open').addEventListener('click', () => { $('screen-setup').hidden = !$('screen-setup').hidden; });
    $('set-save').addEventListener('click', () => save());
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

    // ----- clocks: time left until the bell, and an activity timer kept in this browser -----
    const fmt = (s) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') : Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    function bellSeconds() {
      const b = data && data.settings.bell;
      if (!b || !/^\d{1,2}:\d{2}$/.test(b)) return null;
      const [h, m] = b.split(':').map(Number), end = new Date();
      end.setHours(h, m, 0, 0);
      return Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }
    const KEY = 'screen-activity-' + C.classId;
    let act = { seconds: 300, left: 300, endAt: null };
    try { act = Object.assign(act, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* no storage */ }
    const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(act)); } catch (e) { /* no storage */ } };
    const actLeft = () => (act.endAt ? Math.max(0, Math.ceil((act.endAt - Date.now()) / 1000)) : act.left);
    function drawClock() {
      const bell = bellSeconds(), a = actLeft();
      if (bell !== null) {
        $('clock-label').textContent = bell > 0 ? 'Time left in class' : 'Class is over';
        $('timer-big').textContent = fmt(bell);
        $('timer-big').classList.toggle('long', bell >= 3600);
        $('timer-big').classList.toggle('over', bell === 0);
        $('timer-big').classList.toggle('soon', bell > 0 && bell <= 300);
        $('clock-note').textContent = `Class ends at ${new Date(new Date().setHours(...data.settings.bell.split(':').map(Number), 0, 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      } else {
        $('clock-label').textContent = 'Time now';
        $('timer-big').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        $('timer-big').classList.remove('over', 'soon', 'long');
        $('clock-note').textContent = data ? 'Set "Class ends at" in ⚙ Set up to count down to the bell.' : '';
      }
      $('act-clock').textContent = fmt(a);
      $('act-clock').classList.toggle('over', a === 0 && !!act.ran);
      $('act-go').textContent = act.endAt ? 'Pause' : 'Start';
      if (act.endAt && a === 0) { act.endAt = null; act.left = 0; act.ran = true; keep(); }
    }
    $('act-go').addEventListener('click', () => {
      if (act.endAt) { act.left = actLeft(); act.endAt = null; }
      else { if (act.left === 0) act.left = act.seconds; act.endAt = Date.now() + act.left * 1000; act.ran = false; }
      keep(); drawClock();
    });
    $('act-reset').addEventListener('click', () => { act.endAt = null; act.left = act.seconds; act.ran = false; keep(); drawClock(); });
    $('act-mins').value = Math.round(act.seconds / 60);
    $('act-mins').addEventListener('change', () => {
      const m = Math.max(1, Math.min(120, parseInt($('act-mins').value, 10) || 5));
      $('act-mins').value = m;
      act = { seconds: m * 60, left: m * 60, endAt: null };
      keep(); drawClock();
    });
    setInterval(drawClock, 250);
    drawClock();

    refresh();
    setInterval(refresh, C.refreshMs || 20000);
    document.addEventListener('visibilitychange', refresh);
  }

  window.ClassScreen = { start };
})();
