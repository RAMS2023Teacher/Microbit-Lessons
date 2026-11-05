/* Lesson page: progress saving, circuit stepper, debug checker, quiz, challenge, timer. */
(function () {
  'use strict';
  const L = window.LESSON, S = window.STATE, KEYS = window.SECTION_KEYS;
  const base = '/api/lessons/' + encodeURIComponent(L.id);
  const csrf = document.querySelector('meta[name=csrf-token]').content;
  const $ = (id) => document.getElementById(id);

  async function api(path, body) {
    const r = await fetch(base + path, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (data.sections) updateProgress(data.sections);
    if (!r.ok && !data.error) data.error = 'Could not save (are you still logged in?)';
    return data;
  }

  function updateProgress(sections) {
    S.sections = sections;
    let done = 0;
    KEYS.forEach((k) => {
      const ok = !!sections[k];
      if (ok) done++;
      const li = document.querySelector(`#agenda li[data-key="${k}"]`);
      if (li) li.classList.toggle('done', ok);
      const sec = $(k);
      if (sec) sec.classList.toggle('done', ok);
    });
    const pct = Math.round((100 * done) / KEYS.length);
    $('lesson-meter').style.width = pct + '%';
    $('lesson-pct').textContent = pct + '%';
    lessonComplete = pct === 100;
    syncLessonDone();
  }

  function autosave(el, field, statusEl) {
    let t = null;
    el.addEventListener('input', () => {
      clearTimeout(t);
      if (statusEl) statusEl.textContent = 'Saving…';
      t = setTimeout(async () => {
        const d = await api('/save', { [field]: el.value });
        if (statusEl) statusEl.textContent = d.error ? d.error : 'Saved ✓';
      }, 700);
    });
  }

  // ----- warm-up & learn -----
  autosave($('warmup-answer'), 'warmup_answer', $('warmup-status'));
  (function learnStepper() {
    const cards = [...$('learn-cards').children];
    const dots = $('learn-dots');
    const seen = new Set();
    let cur = 0;
    cards.forEach((card, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i + 1;
      b.setAttribute('aria-label', `Card ${i + 1} of ${cards.length}`);
      b.addEventListener('click', () => show(i, true));
      li.appendChild(b);
      dots.appendChild(li);
    });
    function show(i, moved) {
      cur = i;
      seen.add(i);
      cards.forEach((card, j) => { card.hidden = j !== i; });
      const last = i === cards.length - 1;
      $('learn-count').textContent = `Card ${i + 1} of ${cards.length}`;
      $('learn-prev').hidden = i === 0;
      $('learn-next').hidden = last;
      $('learn-done').hidden = !last;
      [...dots.children].forEach((li, j) => {
        li.classList.toggle('current', j === i);
        li.classList.toggle('checked', seen.has(j) && j !== i);
      });
      if (moved) {
        cards[i].focus({ preventScroll: true });
        // Cards differ in height: keep the top of the new card below the sticky header.
        const limit = document.querySelector('.topbar').offsetHeight + 12;
        const top = $('learn-count').getBoundingClientRect().top;
        if (top < limit) window.scrollBy({ top: top - limit, behavior: 'smooth' });
      }
    }
    $('learn-prev').addEventListener('click', () => show(cur - 1, true));
    $('learn-next').addEventListener('click', () => show(cur + 1, true));
    $('learn-done').addEventListener('click', () => {
      api('/save', { mark: { learn: true } });
      goToNextSection();
    });
    show(0, false);
  })();
  $('code-done').addEventListener('click', () => api('/save', { mark: { code: true } }));

  // ----- editors -----
  const saveCode = (field) => (code) => api('/save', { [field]: code });
  const edCode = MakerEditor.mount($('ed-code'), { onSend: () => api('/sent', { section: 'code' }) });
  edCode.onChange(saveCode('code'));
  const edDebug = MakerEditor.mount($('ed-debug'), { onSend: () => api('/sent', {}) });
  edDebug.onChange(saveCode('debug_code'));
  const edChal = MakerEditor.mount($('ed-challenge'), { onSend: () => api('/sent', {}) });
  edChal.onChange(saveCode('challenge_code'));

  // ----- circuit stepper -----
  if (L.circuit && $('breadboard')) {
    const steps = L.circuit.steps;
    const checked = new Set(S.circuit_steps || []);
    let cur = Math.min(checked.size, steps.length - 1);
    const dots = $('step-dots');
    steps.forEach((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i + 1;
      b.title = s.title;
      b.addEventListener('click', () => show(i));
      li.appendChild(b);
      dots.appendChild(li);
    });
    function md(s) { // tiny inline markdown for step text: **bold**, `code`
      const esc = String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n\n/g, '<br><br>');
    }
    function show(i) {
      cur = i;
      const s = steps[i];
      Breadboard.render($('breadboard'), L.circuit, i);
      $('step-count').textContent = `Step ${i + 1} of ${steps.length}`;
      $('step-title').textContent = s.title;
      $('step-text').innerHTML = md(s.instruction);
      $('step-tip').hidden = !s.tip;
      $('step-tip').innerHTML = s.tip ? '💡 ' + md(s.tip) : '';
      $('step-check-label').textContent = s.check || 'I did this step';
      $('step-check').checked = checked.has(i);
      $('step-prev').disabled = i === 0;
      $('step-next').textContent = i === steps.length - 1 ? 'Finish ✓' : 'Next step →';
      [...dots.children].forEach((li, j) => {
        li.classList.toggle('current', j === i);
        li.classList.toggle('checked', checked.has(j));
      });
    }
    function saveSteps() { api('/save', { circuit_steps: [...checked] }); }
    $('step-check').addEventListener('change', (e) => {
      if (e.target.checked) checked.add(cur); else checked.delete(cur);
      saveSteps();
      show(cur);
    });
    $('step-prev').addEventListener('click', () => cur > 0 && show(cur - 1));
    $('step-next').addEventListener('click', () => {
      if (!checked.has(cur)) { checked.add(cur); saveSteps(); }
      if (cur < steps.length - 1) show(cur + 1);
      else { show(cur); goToNextSection(); }
    });
    show(cur);
  }

  // ----- debug -----
  const hints = L.debug.hints || [];
  let hintsShown = 0;
  function showHints(n) {
    const ul = $('hints');
    while (hintsShown < Math.min(n, hints.length)) {
      const li = document.createElement('li');
      li.textContent = '💡 ' + hints[hintsShown++];
      ul.appendChild(li);
    }
    $('debug-hint').disabled = hintsShown >= hints.length;
    $('debug-hint').textContent = hintsShown >= hints.length ? 'No more hints' : `💡 Hint (${hints.length - hintsShown} left)`;
  }
  showHints(S.debug_hints_used || 0);
  $('debug-hint').addEventListener('click', () => {
    showHints(hintsShown + 1);
    api('/save', { debug_hints_used: hintsShown });
  });
  function debugMessage(kind, html) {
    $('debug-result').className = 'debug-result ' + kind;
    $('debug-result').innerHTML = html;
  }
  if (S.debug_solved) debugMessage('ok', '✅ You fixed it!');
  $('debug-check').addEventListener('click', async () => {
    debugMessage('busy', 'Checking…');
    const d = await api('/debug', { code: edDebug.getCode() });
    if (d.error) return debugMessage('bad', d.error);
    if (d.solved) {
      debugMessage('ok', '✅ Bug squashed! Now test it on your micro:bit, then answer the question below.');
      $('reflection').hidden = false;
    } else {
      const msg = (d.messages && d.messages[0]) || 'Not quite yet.';
      debugMessage('bad', `🐞 Not fixed yet (${d.passed}/${d.total} checks pass). ` +
        msg.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])));
    }
  });
  autosave($('debug-reflection'), 'debug_reflection', $('reflection-status'));

  // ----- quiz -----
  const form = $('quiz-form');
  function showQuiz(res, answers) {
    let score = 0;
    res.results.forEach((r, i) => {
      const fs = form.querySelector(`[data-q="${i}"]`);
      fs.classList.toggle('right', r.correct);
      fs.classList.toggle('wrong', !r.correct);
      if (r.correct) score++;
      const ex = fs.querySelector('.explain');
      ex.hidden = false;
      ex.textContent = (r.correct ? '✓ ' : '✗ ') + r.explain;
      if (answers && answers[i] !== null && answers[i] !== undefined) {
        const inp = fs.querySelector(`input[value="${answers[i]}"]`);
        if (inp) inp.checked = true;
      }
    });
    $('quiz-score').textContent = `${score} / ${res.total}` + (score === res.total ? ' 🌟' : ' — change your answers and try again!');
  }
  if (S.quiz_results) showQuiz(S.quiz_results, S.quiz_answers);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = L.quiz.map((_, i) => {
      const c = form.querySelector(`input[name="q${i}"]:checked`);
      return c ? parseInt(c.value, 10) : null;
    });
    if (answers.some((a) => a === null) && !confirm('You skipped a question. Submit anyway?')) return;
    const d = await api('/quiz', { answers });
    if (d.quiz) showQuiz(d.quiz, null);
  });

  // ----- challenge -----
  $('challenge-submit').addEventListener('click', async () => {
    $('challenge-status').textContent = 'Submitting…';
    const d = await api('/challenge', { code: edChal.getCode(), response: $('challenge-response').value });
    $('challenge-status').textContent = d.ok ? 'Submitted ✓ Your teacher can see it now.' : (d.error || 'Could not submit.');
  });

  // ----- 35-minute class timer -----
  const TKEY = 'timer-' + L.id;
  const total = L.agenda.reduce((s, a) => s + a.minutes, 0) * 60;
  let timerStart = null, tick = null;
  try { timerStart = parseInt(localStorage.getItem(TKEY), 10) || null; } catch (e) { /* ignore */ }
  function fmt(s) { const m = Math.floor(Math.abs(s) / 60), r = Math.abs(s) % 60; return (s < 0 ? '+' : '') + m + ':' + String(r).padStart(2, '0'); }
  function updateTimer() {
    const lis = document.querySelectorAll('#agenda li[data-minutes]');
    lis.forEach((li) => li.classList.remove('now'));
    if (!timerStart) {
      $('timer-clock').textContent = fmt(total);
      $('timer-label').textContent = `${total / 60}-minute lesson`;
      $('timer-fill').style.width = '0';
      $('timer-btn').textContent = 'Start class timer';
      return;
    }
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const left = total - elapsed;
    $('timer-clock').textContent = fmt(left);
    $('timer-fill').style.width = Math.min(100, (100 * elapsed) / total) + '%';
    $('timer').classList.toggle('over', left < 0);
    let acc = 0, label = 'Time\'s up — wrap up and clean up!';
    for (let i = 0; i < L.agenda.length; i++) {
      acc += L.agenda[i].minutes * 60;
      if (elapsed < acc) {
        label = `Now: ${L.agenda[i].name} (${Math.ceil((acc - elapsed) / 60)} min left)`;
        lis[i] && lis[i].classList.add('now');
        break;
      }
    }
    $('timer-label').textContent = label;
    $('timer-btn').textContent = 'Reset timer';
  }
  $('timer-btn').addEventListener('click', () => {
    timerStart = timerStart ? null : Date.now();
    try { timerStart ? localStorage.setItem(TKEY, String(timerStart)) : localStorage.removeItem(TKEY); } catch (e) { /* ignore */ }
    updateTimer();
  });
  if (timerStart && Date.now() - timerStart > 3 * 3600 * 1000) timerStart = null;   // stale
  updateTimer();
  tick = setInterval(updateTimer, 1000);

  // ----- one section at a time -----
  const lessonEl = $('lesson');
  const stepEls = [...lessonEl.querySelectorAll('[data-step]')];
  const stepName = (el) => document.querySelector(`#agenda li[data-key="${el.id}"] .grow`).textContent;
  // These sections have their own Next button, so a second one here would let students skip them by accident.
  const HAS_OWN_NEXT = new Set(['learn', 'circuit']);
  let curStep = 0;
  let lessonComplete = false;

  function syncLessonDone() {
    $('lesson-done').hidden = !lessonComplete || curStep !== stepEls.length - 1;
  }
  function showStep(i, moved) {
    curStep = i;
    const el = stepEls[i], prev = stepEls[i - 1], next = stepEls[i + 1];
    stepEls.forEach((s, j) => { s.hidden = j !== i; });
    lessonEl.classList.toggle('compact', i > 0);
    document.querySelectorAll('#agenda li').forEach((li) => {
      const on = li.dataset.key === el.id;
      li.classList.toggle('current', on);
      if (on) li.querySelector('a').setAttribute('aria-current', 'step');
      else li.querySelector('a').removeAttribute('aria-current');
    });
    $('section-count').textContent = `Part ${i + 1} of ${stepEls.length}`;
    $('section-prev').hidden = !prev;
    if (prev) $('section-prev').textContent = `← Back to ${stepName(prev)}`;
    $('section-next').hidden = !next || HAS_OWN_NEXT.has(el.id);
    if (next) $('section-next').textContent = `Next: ${stepName(next)} →`;
    syncLessonDone();
    // CodeMirror can't measure itself while hidden.
    MakerEditor.all.forEach((ed) => { if (el.contains(ed.root)) ed.cm.refresh(); });
    if (moved) {
      el.focus({ preventScroll: true });
      const top = lessonEl.getBoundingClientRect().top + window.scrollY - document.querySelector('.topbar').offsetHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
  }
  function goToNextSection() {
    const next = stepEls[curStep + 1];
    if (next) location.hash = next.id;
  }
  stepEls.forEach((el) => { el.tabIndex = -1; });
  $('section-next').addEventListener('click', goToNextSection);
  $('section-prev').addEventListener('click', () => { location.hash = stepEls[curStep - 1].id; });
  window.addEventListener('hashchange', () => {
    const i = stepEls.findIndex((el) => '#' + el.id === location.hash);
    if (i >= 0) showStep(i, true);
  });

  // Open the section in the link, or pick up where the student left off.
  (function firstStep() {
    const sections = S.sections || {};
    let i = stepEls.findIndex((el) => '#' + el.id === location.hash);
    if (i < 0 && KEYS.some((k) => sections[k])) {
      i = stepEls.findIndex((el) => KEYS.includes(el.id) && !sections[el.id]);
      if (i < 0) i = stepEls.length - 1;
    }
    if (i < 0) i = 0;
    history.replaceState(null, '', '#' + stepEls[i].id);
    showStep(i, false);
  })();

  updateProgress(S.sections || {});
})();
