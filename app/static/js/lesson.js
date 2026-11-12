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
    if (data.rewards && window.showRewards) showRewards(data.rewards);
    if (typeof data.lesson_xp === 'number' && $('lesson-xp')) $('lesson-xp').textContent = data.lesson_xp;
    if (typeof data.stars === 'number' && $('lesson-stars')) $('lesson-stars').textContent = '★'.repeat(data.stars) + '☆'.repeat(3 - data.stars);
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
    const bar = $('lesson-meter').parentElement;
    bar.style.setProperty('--parts', KEYS.length);
    bar.setAttribute('aria-label', `${done} of ${KEYS.length} parts done`);
    if ($('lesson-parts')) $('lesson-parts').textContent = `${done} of ${KEYS.length} parts done`;
    lessonComplete = pct === 100;
    syncLessonDone();
    try { syncNextButton(); } catch (e) { /* the section stepper isn't set up yet */ }
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

  // ----- read to me (the browser's built-in voice) -----
  const voice = window.speechSynthesis;
  let reading = null;
  function stopReading() {
    if (voice) voice.cancel();
    if (reading) { reading.textContent = '🔊 Read to me'; reading.classList.remove('on'); }
    reading = null;
  }
  function textToRead(btn) {
    const box = btn.closest('.learn-card, .remember-box');
    if (!box) return '';
    const copy = box.cloneNode(true);
    copy.querySelectorAll('button, .lc-feedback[hidden], details:not([open]), figure, .vz, svg').forEach((x) => x.remove());
    copy.querySelectorAll('.learn-check-choices').forEach((x) => {
      x.textContent = ' The choices are: ' + [...box.querySelectorAll('.lc-choice')].map((b) => b.textContent).join(', or ') + '.';
    });
    return copy.textContent.replace(/[⚡💡🔊]/g, '').replace(/\s+/g, ' ').trim();
  }
  document.querySelectorAll('[data-read]').forEach((btn) => {
    if (!voice) { btn.hidden = true; return; }
    btn.addEventListener('click', () => {
      if (reading === btn) { stopReading(); return; }
      stopReading();
      const u = new SpeechSynthesisUtterance(textToRead(btn));
      u.rate = 0.95;
      u.onend = () => { if (reading === btn) stopReading(); };
      reading = btn;
      btn.textContent = '⏹ Stop';
      btn.classList.add('on');
      voice.speak(u);
    });
  });

  // The teacher teaches Learn live for this class: leave it out (the server already counted it done).
  if (S.skip_learn && $('learn')) {
    $('learn').remove();
    const li = document.querySelector('#agenda li[data-key="learn"]');
    if (li) li.remove();
  }

  // ----- warm-up & learn -----
  if ($('warmup-answer')) autosave($('warmup-answer'), 'warmup_answer', $('warmup-status'));
  (function learnStepper() {
    if (!$('learn-cards')) return;
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
      b.addEventListener('click', () => {
        for (let j = 0; j < i; j++) if (!passed(j)) { show(j, true); return; }     // answer the earlier checks first
        show(i, true);
      });
      li.appendChild(b);
      dots.appendChild(li);
    });
    // Quick checks: answer each card's question (graded on the server) before moving on.
    const checks = S.learn_checks || {};
    const passed = (i) => !cards[i].querySelector('.learn-check') || !!(checks[i] && checks[i].ok);
    function showPassed(card, row) {
      const box = card.querySelector('.learn-check');
      if (!box) return;
      box.classList.add('passed');
      box.querySelectorAll('.lc-choice').forEach((b) => {
        b.disabled = true;
        if (row && +b.dataset.choice === row.pick) b.classList.add('right');
      });
    }
    cards.forEach((card, i) => {
      const box = card.querySelector('.learn-check');
      if (!box) return;
      if (passed(i)) {
        showPassed(card, checks[i]);
        const fb = box.querySelector('.lc-feedback');
        fb.hidden = false;
        fb.className = 'lc-feedback good';
        fb.textContent = '✓ You got this one.';
      }
      box.querySelectorAll('.lc-choice').forEach((b) => b.addEventListener('click', async () => {
        if (passed(i)) return;
        box.querySelectorAll('.lc-choice').forEach((x) => { x.disabled = true; });
        const d = await api('/learn-check', { card: i, choice: +b.dataset.choice });
        const fb = box.querySelector('.lc-feedback');
        fb.hidden = false;
        if (!d.check) {
          fb.className = 'lc-feedback bad';
          fb.textContent = d.error || 'Could not check that. Try again.';
          box.querySelectorAll('.lc-choice:not(.wrong)').forEach((x) => { x.disabled = false; });
          return;
        }
        if (d.learn_checks) Object.assign(checks, d.learn_checks);
        if (d.check.correct) {
          checks[i] = checks[i] || { ok: true, pick: +b.dataset.choice };
          showPassed(card, checks[i]);
          b.classList.add('right');
          fb.className = 'lc-feedback good';
          fb.textContent = '✓ ' + d.check.why;
        } else {
          b.classList.add('wrong');
          fb.className = 'lc-feedback bad';
          fb.textContent = 'Not quite. ' + d.check.hint + ' Try again.';
          box.querySelectorAll('.lc-choice:not(.wrong)').forEach((x) => { x.disabled = false; });
        }
        show(cur, false);
      }));
    });
    function show(i, moved) {
      if (i !== cur) stopReading();
      cur = i;
      seen.add(i);
      cards.forEach((card, j) => { card.hidden = j !== i; });
      const last = i === cards.length - 1, ok = passed(i);
      $('learn-count').textContent = `Card ${i + 1} of ${cards.length}`;
      $('learn-prev').hidden = i === 0;
      $('learn-next').hidden = last || !ok;
      $('learn-done').hidden = !last || !ok;
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
  if ($('code-done')) $('code-done').addEventListener('click', () => api('/save', { mark: { code: true } }));

  // ----- editors -----
  const saveCode = (field) => (code) => api('/save', { [field]: code });
  const mount = (id, field, opts) => {   // lab lessons have no Python editors
    if (!$(id)) return null;
    const ed = MakerEditor.mount($(id), opts);
    ed.onChange(saveCode(field));
    return ed;
  };
  // Running the Code it program counts, on the micro:bit or in the simulator (simulator runs aren't "sends").
  const edCode = mount('ed-code', 'code', { onSend: () => api('/sent', { section: 'code' }),
                                            onSim: () => { if (!(S.sections || {}).code) api('/save', { mark: { code: true } }); } });
  const edPractice = mount('ed-practice', 'practice_code', { onSend: () => api('/sent', {}) });
  const edDebug = mount('ed-debug', 'debug_code', { onSend: () => api('/sent', {}) });
  const edChal = mount('ed-challenge', 'challenge_code', { onSend: () => api('/sent', {}) });

  // ----- code: "How does it work?" and "Try a change", one item at a time -----
  (function codePanels() {
    let marks = [];
    function clearMarks() { marks.forEach((h) => edCode.cm.removeLineClass(h, 'background', 'cm-explain-line')); marks = []; }
    function highlight(range) {
      clearMarks();
      if (!range) return;
      const [a, b] = String(range).split('-').map((n) => parseInt(n, 10));
      for (let ln = a; ln <= (b || a); ln++) {
        if (ln >= 1 && ln <= edCode.cm.lineCount()) marks.push(edCode.cm.addLineClass(ln - 1, 'background', 'cm-explain-line'));
      }
    }
    function stepper(panel) {
      const cards = [...panel.querySelectorAll('.mini-card')];
      let cur = 0;
      const show = (i) => {
        cur = Math.max(0, Math.min(cards.length - 1, i));
        cards.forEach((c, j) => { c.hidden = j !== cur; });
        panel.querySelector('[data-mini=count]').textContent = `${cur + 1} of ${cards.length}`;
        panel.querySelector('[data-mini=prev]').disabled = cur === 0;
        panel.querySelector('[data-mini=next]').disabled = cur === cards.length - 1;
        highlight(cards[cur].dataset.lines);
      };
      panel.querySelector('[data-mini=prev]').addEventListener('click', () => show(cur - 1));
      panel.querySelector('[data-mini=next]').addEventListener('click', () => show(cur + 1));
      return show;
    }
    const shows = {};
    document.querySelectorAll('.code-tools .pill').forEach((btn) => {
      const panel = $('panel-' + btn.dataset.panel);
      shows[btn.dataset.panel] = stepper(panel);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        document.querySelectorAll('.code-tools .pill').forEach((b) => {
          b.setAttribute('aria-expanded', 'false');
          $('panel-' + b.dataset.panel).hidden = true;
        });
        clearMarks();
        if (open) { btn.setAttribute('aria-expanded', 'true'); panel.hidden = false; shows[btn.dataset.panel](0); }
      });
    });
  })();

  // ----- challenge: pick one level at a time -----
  document.querySelectorAll('.level-tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.level-tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('.levels .level, .hint-set').forEach((p) => { p.hidden = p.dataset.level !== tab.dataset.level; });
  }));

  // ----- challenge hints: open one at a time -----
  document.querySelectorAll('.hint-set').forEach((set) => {
    const items = [...set.querySelectorAll('.hints li')];
    const btn = set.querySelector('.hint-next');
    btn.addEventListener('click', () => {
      const next = items.find((li) => li.hidden);
      if (next) next.hidden = false;
      const left = items.filter((li) => li.hidden).length;
      btn.hidden = left === 0;
      btn.textContent = `Show another hint (${left} left)`;
    });
  });

  // ----- code library and hints panels beside the editor -----
  document.querySelectorAll('.workspace').forEach((space) => {
    const holder = space.querySelector('.helper-panels');
    space.querySelectorAll('.helper-toggle').forEach((btn) => btn.addEventListener('click', () => {
      const panel = $(btn.getAttribute('aria-controls'));
      panel.hidden = !panel.hidden;
      btn.setAttribute('aria-expanded', String(!panel.hidden));
      holder.hidden = !holder.querySelector('.helper-panel:not([hidden])');
      space.classList.toggle('has-helpers', !holder.hidden);
      // The editor just changed width.
      MakerEditor.all.forEach((ed) => { if (space.contains(ed.root)) ed.cm.refresh(); });
      if (!panel.hidden) panel.scrollIntoView({ block: 'nearest' });
    }));
    holder.addEventListener('click', async (e) => {
      const btn = e.target.closest('.lib-copy');
      if (!btn) return;
      const pre = btn.closest('.lib-entry').querySelector('pre');
      try {
        await navigator.clipboard.writeText(pre.textContent);
        btn.textContent = 'Copied ✓';
      } catch (err) {   // no clipboard access: select the text so Ctrl+C works
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Press Ctrl+C';
      }
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
  });

  // ----- circuit: "get ready" screen before step 1 -----
  if ($('circuit-ready')) {
    const start = () => { $('circuit-ready').hidden = true; $('builder').hidden = false; };
    $('circuit-start').addEventListener('click', start);
    if ((S.circuit_steps || []).length) start();
  }

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
      if ($('bb-legend')) $('bb-legend').hidden = !!s.visual;
      if (s.visual) { $('breadboard').innerHTML = ''; Visuals.render($('breadboard'), s.visual); }
      else Breadboard.render($('breadboard'), L.circuit, i);
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

  // ----- AI lab: one step at a time, in an outside tool -----
  if (L.lab) {
    const steps = L.lab.steps;
    const checked = new Set(S.circuit_steps || []);
    let cur = Math.min(checked.size, steps.length - 1);
    const dots = $('lab-dots');
    const md = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
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
    function show(i) {
      cur = i;
      const s = steps[i];
      $('lab-count').textContent = `Step ${i + 1} of ${steps.length}`;
      $('lab-title').textContent = s.title;
      $('lab-text').innerHTML = md(s.instruction);
      $('lab-tip').hidden = !s.tip;
      $('lab-tip').innerHTML = s.tip ? '💡 ' + md(s.tip) : '';
      $('lab-check-label').textContent = s.check;
      $('lab-check').checked = checked.has(i);
      $('lab-prev').disabled = i === 0;
      $('lab-next').textContent = i === steps.length - 1 ? 'Finish ✓' : 'Next step →';
      [...dots.children].forEach((li, j) => {
        li.classList.toggle('current', j === i);
        li.classList.toggle('checked', checked.has(j));
      });
    }
    const save = () => api('/save', { circuit_steps: [...checked] });
    $('lab-check').addEventListener('change', (e) => {
      if (e.target.checked) checked.add(cur); else checked.delete(cur);
      save();
      show(cur);
    });
    $('lab-prev').addEventListener('click', () => cur > 0 && show(cur - 1));
    $('lab-next').addEventListener('click', () => {
      if (cur < steps.length - 1) show(cur + 1);
      else goToNextSection();
    });
    show(cur);
  }

  // ----- predict: commit to an answer before running the code -----
  document.querySelectorAll('.predict-choice').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.predict-choice').forEach((x) => { x.disabled = true; x.classList.toggle('right', x.dataset.right === 'yes'); });
    if (b.dataset.right !== 'yes') b.classList.add('wrong');
    $('predict-explain').hidden = false;
  }));

  // ----- your turn: students write the code -----
  if (L.practice && $('practice-check')) {
    const message = (kind, text) => { $('practice-result').className = 'debug-result ' + kind; $('practice-result').textContent = text; };
    if (S.practice_solved) message('ok', '✅ You did it!');
    const tips = L.practice.hints || [];
    let shown = 0;
    $('practice-hint').disabled = !tips.length;
    $('practice-hint').addEventListener('click', () => {
      if (shown < tips.length) $('practice-hints').appendChild(document.createElement('li')).textContent = '💡 ' + tips[shown++];
      $('practice-hint').disabled = shown >= tips.length;
      if (shown >= tips.length) $('practice-hint').textContent = 'No more hints';
    });
    $('practice-check').addEventListener('click', async () => {
      message('busy', 'Checking…');
      const d = await api('/practice', { code: edPractice.getCode() });
      if (d.error) return message('bad', d.error);
      if (d.solved) message('ok', '✅ It looks right! Try it in the simulator or on your micro:bit.');
      else message('bad', `Not yet (${d.passed}/${d.total}). ${(d.messages && d.messages[0]) || 'Keep going.'}`);
    });
  }

  // ----- debug -----
  if (L.debug) {
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
  }

  // ----- quiz -----
  const form = $('quiz-form');
  const qs = [...form.querySelectorAll('fieldset.q')];
  let qCur = 0;
  const qDots = $('quiz-dots');
  qs.forEach((_, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = i + 1;
    b.setAttribute('aria-label', `Question ${i + 1}`);
    b.addEventListener('click', () => showQ(i));
    li.appendChild(b); qDots.appendChild(li);
  });
  function showQ(i) {
    qCur = Math.max(0, Math.min(qs.length - 1, i));
    qs.forEach((q, j) => { q.hidden = j !== qCur; });
    $('quiz-prev').disabled = qCur === 0;
    $('quiz-next').hidden = qCur === qs.length - 1;
    $('quiz-submit').hidden = qCur !== qs.length - 1;
    [...qDots.children].forEach((li, j) => {
      li.classList.toggle('current', j === qCur);
      li.classList.toggle('checked', !!qs[j].querySelector('input:checked'));
      li.classList.toggle('right', qs[j].classList.contains('right'));
      li.classList.toggle('wrong', qs[j].classList.contains('wrong'));
    });
  }
  $('quiz-prev').addEventListener('click', () => showQ(qCur - 1));
  $('quiz-next').addEventListener('click', () => showQ(qCur + 1));
  form.addEventListener('change', () => { showQ(qCur); });
  showQ(0);
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
    $('quiz-score').textContent = `${score} / ${res.total}` + (score === res.total ? ' 🌟' : ' — tap the red numbers to see what to fix, then submit again!');
    if (typeof showQ === 'function') showQ(res.results.findIndex((r) => !r.correct) >= 0 ? res.results.findIndex((r) => !r.correct) : 0);
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
  if ($('challenge-submit')) $('challenge-submit').addEventListener('click', async () => {
    $('challenge-status').textContent = 'Submitting…';
    const d = await api('/challenge', { code: edChal ? edChal.getCode() : '', response: $('challenge-response').value });
    $('challenge-status').textContent = d.ok
      ? (d.partner ? `Submitted ✓ for you and ${d.partner}.` : 'Submitted ✓ Your teacher can see it now.')
      : (d.error || 'Could not submit.');
  });

  // ----- partner: two classmates on one Chromebook. Pick your partner; everything then saves for both. -----
  const reloadLesson = () => { if (window.ML && ML.go && ML.path) ML.go(ML.path); else window.location.reload(); };
  if ($('partner-box')) {
    const box = $('partner-box');
    const partnerApi = async (body) => {
      const r = await fetch(base + '/partner', {
        method: body ? 'POST' : 'GET', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: body ? JSON.stringify(body) : undefined,
      });
      return r.json().catch(() => ({ status: 'none', classmates: [], error: 'Could not reach Maker Lab.' }));
    };
    const add = (parent, tag, text, cls) => {
      const el = parent.appendChild(document.createElement(tag));
      if (text) el.textContent = text;
      if (cls) el.className = cls;
      return el;
    };
    function draw(p) {
      box.textContent = '';
      box.classList.toggle('paired', p.status === 'paired');
      if ($('challenge-submit')) $('challenge-submit').textContent = p.status === 'paired' ? '📤 Submit for both of us' : '📤 Submit my challenge';
      if (p.status === 'paired') {
        add(box, 'span', '👥');
        const t = add(box, 'span', '', 'partner-text');
        t.append('You and ');
        add(t, 'b', p.name);
        t.append(' are partners. Everything you do saves for both of you.');
        const stop = add(box, 'button', 'Stop working together', 'linklike small');
        stop.type = 'button';
        stop.addEventListener('click', async () => {
          if (!confirm(`Stop working with ${p.name}? The work you already did stays with both of you.`)) return;
          draw(await partnerApi({ action: 'leave' }));
        });
      } else if ((p.classmates || []).length) {
        add(box, 'span', '👥');
        add(box, 'label', 'Sharing this Chromebook with a partner?', 'partner-label').htmlFor = 'partner-pick';
        const pick = add(box, 'select');
        pick.id = 'partner-pick';
        add(pick, 'option', 'Pick your partner…').value = '';
        p.classmates.forEach((m) => { add(pick, 'option', m.name).value = m.id; });
        const go = add(box, 'button', 'Add partner', 'btn small');
        go.type = 'button';
        go.addEventListener('click', async () => {
          if (!pick.value) { pick.focus(); return; }
          const name = pick.options[pick.selectedIndex].textContent;
          if (!confirm(`Work with ${name}? Your work on this lesson will save for both of you.`)) return;
          go.disabled = true;
          const r = await partnerApi({ action: 'pair', partner_id: /^\d+$/.test(pick.value) ? +pick.value : pick.value });
          if (r.status === 'paired') reloadLesson();      // show the combined work
          else { go.disabled = false; draw(r); }
        });
      }
      if (p.error) add(box, 'span', p.error, 'bad small');
    }
    partnerApi().then(draw);
  }

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
  const HAS_OWN_NEXT = new Set(['learn', 'circuit', 'lab']);
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
    syncNextButton();
    syncLessonDone();
    MakerEditor.all.forEach((ed) => { if (!el.contains(ed.root)) MakerEditor.closeSim(ed); });   // no sound from hidden parts
    // CodeMirror can't measure itself while hidden.
    MakerEditor.all.forEach((ed) => { if (el.contains(ed.root)) ed.cm.refresh(); });
    if (moved) {
      el.focus({ preventScroll: true });
      const top = lessonEl.getBoundingClientRect().top + window.scrollY - document.querySelector('.topbar').offsetHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
  }
  // The Next button says what's next, and turns green once this part is done.
  function syncNextButton() {
    const el = stepEls[curStep], next = stepEls[curStep + 1], btn = $('section-next');
    if (!next || !el) return;
    const done = !!(S.sections || {})[el.id];
    btn.classList.toggle('ready', done);
    btn.textContent = el.id === 'overview' ? '▶ Start the lesson' : `${done ? '✓ Done! ' : ''}Next: ${stepName(next)} →`;
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

  // ----- first visit: a short tour of how a lesson works (replay it from "How does this work?") -----
  const TOUR_KEY = 'ml-lesson-tour-1';
  function tour() {
    const stops = [
      { el: $('agenda'), text: '👋 A lesson is a few short parts. This list shows them. A part turns <b>green</b> when you finish it.' },
      { el: $('partner-box') && $('partner-box').children.length ? $('partner-box') : null,
        text: '👥 Sharing this Chromebook? Pick your partner here, so you <b>both</b> get the work and the XP.' },
      { el: null, text: '👉 Every part starts with a yellow <b>What to do</b> box. Just do what it says.', demo: true },
      { el: $('section-next'), text: '➡️ When you finish a part, press <b>Next</b>. It turns green when that part is done.' },
    ].filter((t) => t.el || t.demo);
    let i = 0;
    const veil = document.body.appendChild(document.createElement('div'));
    veil.className = 'tour-veil';
    const bubble = document.body.appendChild(document.createElement('div'));
    bubble.className = 'tour-bubble';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-label', 'How lessons work');
    const done = () => {
      document.querySelectorAll('.tour-spot').forEach((e) => e.classList.remove('tour-spot'));
      veil.remove(); bubble.remove();
      try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* no storage */ }
    };
    function show() {
      document.querySelectorAll('.tour-spot').forEach((e) => e.classList.remove('tour-spot'));
      const t = stops[i], last = i === stops.length - 1;
      if (t.el) { t.el.classList.add('tour-spot'); t.el.scrollIntoView({ block: 'center', behavior: 'instant' }); }
      bubble.innerHTML = `<p>${t.text}</p>` +
        (t.demo ? '<div class="do-now"><span class="do-now-tag">What to do</span><span>Read the question. Type your idea in the box.</span></div>' : '') +
        `<div class="tour-row"><span class="tour-count">${i + 1} of ${stops.length}</span>` +
        `<button type="button" class="linklike small" data-skip>Skip</button>` +
        `<button type="button" class="btn" data-go>${last ? "Got it! Let's go" : 'Next →'}</button></div>`;
      bubble.querySelector('[data-go]').addEventListener('click', () => { if (last) done(); else { i++; show(); } });
      bubble.querySelector('[data-skip]').addEventListener('click', done);
      bubble.querySelector('[data-go]').focus();
    }
    show();
  }
  if ($('tour-again')) $('tour-again').addEventListener('click', (e) => { e.preventDefault(); tour(); });
  let toured = false;
  try { toured = !!localStorage.getItem(TOUR_KEY); } catch (e) { toured = true; }
  if (!toured && !lessonEl.dataset.teacher) setTimeout(tour, 600);
})();
