/* Classroom Screen: student progress, question and standard of the day, and a class timer. */
(function () {
  'use strict';
  const C = window.SCREEN;
  const $ = (id) => document.getElementById(id);
  let data = null;

  // ----- progress and the day's prompts -----
  function tile(s, showXp) {
    const el = document.createElement('div');
    el.className = `screen-tile ${s.status}`;
    const av = el.appendChild(document.createElement('div'));
    av.className = 'screen-avatar';
    av.innerHTML = window.RobotAvatar.svg(s.avatar, 46);   // drawn from known parts, not typed text
    const info = el.appendChild(document.createElement('div'));
    info.className = 'screen-who';
    info.appendChild(document.createElement('b')).textContent = s.name;
    const where = info.appendChild(document.createElement('span'));
    where.textContent = s.where;
    const meter = info.appendChild(document.createElement('span'));
    meter.className = 'meter';
    meter.appendChild(document.createElement('i')).style.width = s.pct + '%';
    if (showXp) {
      const xp = info.appendChild(document.createElement('small'));
      xp.textContent = `⚡ ${s.xp} XP`;
    }
    return el;
  }

  function render() {
    const box = $('screen-students');
    box.textContent = '';
    if (!data.students.length) {
      box.textContent = 'No students have joined this class yet.';
    }
    data.students.forEach((s) => box.appendChild(tile(s, data.settings.xp === 'each')));
    $('screen-total').hidden = data.settings.xp === 'hide';
    $('screen-total').textContent = `⚡ ${data.total_xp} class XP`;
    $('screen-lesson').textContent = data.lesson ? `${data.lesson.number}. ${data.lesson.title}` : '';
    $('screen-question').textContent = data.question;
    $('screen-standard-code').textContent = data.standard ? data.standard.code : '';
    $('screen-standard').textContent = data.standard ? data.standard.text : 'This lesson has no standard listed.';
    fillSetup();
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const r = await fetch(C.dataUrl, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
      $('screen-offline').hidden = true;
      render();
    } catch (e) {
      $('screen-offline').hidden = false;
    }
  }

  // ----- setup panel: only the teacher needs this, so it stays closed -----
  let filled = false;
  function fillSetup() {
    const std = $('set-standard');
    const keep = data.settings.standard || (data.standard && data.standard.code) || '';
    std.textContent = '';
    data.standards.forEach((s) => {
      const o = std.appendChild(document.createElement('option'));
      o.value = s.code;
      o.textContent = `${s.code}: ${s.text.slice(0, 70)}`;
    });
    std.value = keep;
    if (filled) return;
    filled = true;
    $('set-lesson').value = data.lesson ? data.lesson.id : '';
    $('set-question').value = data.settings.question || '';
    $('set-names').value = data.settings.names;
    $('set-xp').value = data.settings.xp;
  }

  async function save(extra) {
    $('set-status').textContent = 'Saving…';
    const body = {
      lesson_id: $('set-lesson').value, question: $('set-question').value, standard: $('set-standard').value,
      names: $('set-names').value, xp: $('set-xp').value, ...extra,
    };
    const r = await fetch(C.settingsUrl, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': C.csrf },
      body: JSON.stringify(body),
    });
    $('set-status').textContent = r.ok ? 'Saved ✓' : 'Could not save.';
    if (r.ok) { data = await r.json(); render(); }
  }

  $('set-open').addEventListener('click', () => { $('screen-setup').hidden = !$('screen-setup').hidden; });
  $('set-save').addEventListener('click', () => save());
  // A new lesson brings its own standards, so don't send the old lesson's standard.
  $('set-lesson').addEventListener('change', () => save({ standard: '' }));
  $('set-full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });

  // ----- timer: it lives on this screen, so it keeps counting between refreshes -----
  const KEY = 'screen-timer-' + C.classId;
  const clock = $('timer-big');
  let t = { seconds: 35 * 60, left: 35 * 60, endAt: null };
  try { t = Object.assign(t, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }

  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* ignore */ } };
  const remaining = () => (t.endAt ? Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) : t.left);
  function drawTimer() {
    const s = remaining();
    clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    clock.classList.toggle('over', s === 0);
    $('timer-go').textContent = t.endAt ? 'Pause' : 'Start';
    if (t.endAt && s === 0) { t.endAt = null; t.left = 0; keep(); }
  }
  $('timer-go').addEventListener('click', () => {
    if (t.endAt) { t.left = remaining(); t.endAt = null; }
    else {
      if (t.left === 0) t.left = t.seconds;
      t.endAt = Date.now() + t.left * 1000;
    }
    keep();
    drawTimer();
  });
  $('timer-reset').addEventListener('click', () => { t.endAt = null; t.left = t.seconds; keep(); drawTimer(); });
  $('timer-mins').value = Math.round(t.seconds / 60);
  $('timer-mins').addEventListener('change', () => {
    const m = Math.max(1, Math.min(180, parseInt($('timer-mins').value, 10) || 35));
    $('timer-mins').value = m;
    t = { seconds: m * 60, left: m * 60, endAt: null };
    keep();
    drawTimer();
  });
  setInterval(drawTimer, 250);
  drawTimer();

  refresh();
  setInterval(refresh, C.refreshMs);
  document.addEventListener('visibilitychange', refresh);
})();
