/* Gentle "what do I do next?" hints. When a student hasn't touched the Chromebook for a while (or comes back to this
 * tab from MakeCode), the next thing to do glows and a small pointing bubble says what it is. After a longer wait the
 * ✋ help button glows too. Nothing is clicked or sent for the student; any click or key press clears the hint.
 *   MLNudge.times({ first, second, back })   change the waits (milliseconds); used by the tests
 *   MLNudge.next()                           what the hint would point at right now: { el, text } or null
 * The next thing is worked out from what is on the page, so new lesson steps need no extra code. Any element can
 * also opt in with data-nudge="what to do". */
(function () {
  'use strict';
  const ML = window.ML || {};
  if (ML.teacher && !ML.preview) return;                       // teachers get hints only in student view
  const T = { first: 45000, second: 120000, back: 2500, away: 20000 };
  const $ = (id) => document.getElementById(id);
  const shown = (el) => !!el && el.getClientRects().length > 0 && !el.disabled;
  const empty = (el) => !String(el.value || '').trim();
  let stage = 0, glowing = [], bubble = null, idleTimer = null, fadeTimer = null, hiddenAt = 0;

  /** The one thing this student should do next on this page. */
  function next() {
    if (document.querySelector('#prefs-panel, #bug-panel, .badge-spot, .game-stage, #help-note')) return null;   // busy with something else
    const media = document.querySelector('video');
    if (media && !media.paused) return null;
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') return null;      // watching the lesson video
    const pick = (el, text) => (shown(el) ? { el, text } : null);
    let el;
    // joining a class
    if ($('j-go')) {
      if (empty($('j-code'))) return pick($('j-code'), 'Type the class code from the board here.');
      if (empty($('j-name'))) return pick($('j-name'), 'Type your first name and last initial.');
      return pick($('j-go'), 'Press Join.');
    }
    // lesson: Mission
    if ($('mission-go')) {
      if ($('talk') && $('talk').value.trim().length < 3) return pick($('talk').closest('.ask-box') || $('talk'), 'Talk it over with your partner, then type a few words here.');
      return pick($('mission-go'), 'Ready? Press this to start building.');
    }
    // lesson: Build
    if ($('step-next')) {
      const box = $('stage-view') || document;
      const tests = [...box.querySelectorAll('[data-test]')], open = tests.filter((t) => !t.checked);
      if (open.length) {
        const list = box.querySelector('.do-list');
        if (open.length === tests.length && shown(list)) return { el: list, text: 'Start here: do these steps, one at a time. Then tick the ✅ Test it boxes.' };
        return pick(open[0].closest('label'), 'Does this part work? Try it, then tick the box.');
      }
      el = [...box.querySelectorAll('[data-field]')].find(empty);
      if (el) return pick(el, 'Fill in this blank.');
      if ($('step-ask') && empty($('step-ask'))) return pick($('step-ask').closest('.ask-box'), 'Answer this question in your own words.');
      return pick($('step-next'), 'This step is done. Press Next!');
    }
    // lesson: Quiz
    if ($('quiz-go')) {
      if ($('stage-view') && $('stage-view').dataset.graded) return null;
      el = [...document.querySelectorAll('.quiz-q')].find((q) => !q.querySelector('.quiz-choice.picked'));
      if (el) return pick(el, 'Pick an answer for this question.');
      return pick($('quiz-go'), 'All answered. Press this to check your answers.');
    }
    // lesson: Ship it
    if ($('ship-go')) {
      if (document.getElementById('shipped')) return null;
      el = [...document.querySelectorAll('[data-reflect]')].find(empty);
      if (el) return pick(el.closest('.ask-box'), 'Answer this reflection question.');
      if ($('share') && empty($('share'))) return pick($('share'), 'Paste your MakeCode share link here.');
      return pick($('ship-go'), 'Everything is ready. Ship it!');
    }
    // home and the skill tree
    el = document.querySelector('.mission-banner .btn');
    if (el) return pick(el, 'Press GO to open your next mission.');
    el = document.querySelector('#map-detail a.btn:not(.ghost)');
    if (el) return pick(el, 'Press this to open the lesson.');
    el = [...document.querySelectorAll('[data-nudge]')].find(shown);
    return el ? { el, text: el.getAttribute('data-nudge') } : null;
  }

  function clear() {
    clearTimeout(fadeTimer); fadeTimer = null;
    glowing.forEach((el) => el.classList.remove('nudge-glow', 'nudge-strong'));
    glowing = [];
    if (bubble) { bubble.remove(); bubble = null; }
    stage = 0;
  }
  function glow(el, strong) { el.classList.add('nudge-glow'); if (strong) el.classList.add('nudge-strong'); glowing.push(el); }

  function show(level, hello) {
    const n = next();
    clear();
    if (!n) return;
    stage = level;
    glow(n.el, level > 1);
    const help = level > 1 ? $('help-ask') : null;
    if (shown(help)) glow(help, false);
    const r = n.el.getBoundingClientRect(), vh = window.innerHeight, off = r.bottom < 60 ? 'up' : r.top > vh - 40 ? 'down' : '';
    bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.id = 'nudge-bubble';
    bubble.className = 'nudge-bubble' + (off ? ' docked' : '') + (level > 1 ? ' strong' : '');
    bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = `<span class="nudge-hand" aria-hidden="true">${off === 'up' ? '👆' : off === 'down' ? '👇' : '👉'}</span><span>` +
      (hello ? '<b>Welcome back!</b> ' : level > 1 ? '<b>Next step:</b> ' : '') + `<span class="nudge-text"></span>` +
      (shown(help) ? ' <span class="nudge-more">Still stuck? Press ✋ and your teacher will come over.</span>' : '') + '</span>';
    bubble.querySelector('.nudge-text').textContent = n.text;
    document.body.appendChild(bubble);
    if (!off) {
      const b = bubble.getBoundingClientRect(), above = r.top - b.height - 12;
      let top, left;
      if (r.height > 90 && r.width > 500) {                   // a big box: hang off its bottom-right corner, clear of its heading
        top = Math.min(r.bottom - b.height / 2, vh - b.height - 8); left = r.right - b.width - 18;
      } else {                                                // a button or a blank: just above it (or below, near the top of the page)
        top = above > 70 ? above : r.bottom + 12; left = Math.min(r.left, window.innerWidth - b.width - 8);
      }
      bubble.style.top = Math.round(window.scrollY + top) + 'px';
      bubble.style.left = Math.round(window.scrollX + Math.max(8, left)) + 'px';
    }
    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = n.el;
      clear();
      el.scrollIntoView({ block: 'center', behavior: window.MLPrefs && window.MLPrefs.reducedMotion() ? 'auto' : 'smooth' });
      glow(el, true);
      fadeTimer = setTimeout(clear, 6000);
      const f = el.matches('input, textarea, button, a') ? el : el.querySelector('input, textarea');
      if (f && f.focus) f.focus({ preventScroll: true });
    });
  }

  function arm() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function tick() {
      if (document.hidden) return;
      if (stage === 0) { show(1); idleTimer = setTimeout(tick, Math.max(1000, T.second - T.first)); }
      else if (stage === 1) show(2);
    }, T.first);
  }
  // Really doing something (a click, a key) clears the hint at once; just moving the mouse lets it fade a little later.
  function acted(e) {
    if (bubble && e && e.target && bubble.contains(e.target)) return;
    if (stage) clear();
    arm();
  }
  let lastMove = 0;
  function moved() {
    const now = Date.now();
    if (now - lastMove < 400) return;
    lastMove = now;
    if (stage && !fadeTimer) fadeTimer = setTimeout(clear, 7000);
    arm();
  }
  ['pointerdown', 'keydown', 'input', 'change'].forEach((ev) => document.addEventListener(ev, acted, true));
  ['pointermove', 'wheel', 'touchmove'].forEach((ev) => document.addEventListener(ev, moved, { capture: true, passive: true }));
  document.addEventListener('scroll', moved, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); clearTimeout(idleTimer); return; }
    const away = hiddenAt && Date.now() - hiddenAt >= T.away;   // back from MakeCode: point at what's next straight away
    clear();
    arm();
    if (away) { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!document.hidden && !stage) { show(1, true); idleTimer = setTimeout(() => { if (stage === 1) show(2); }, T.second); } }, T.back); }
  });
  arm();

  window.MLNudge = { next, show, clear, times: (t) => { Object.assign(T, t || {}); arm(); return Object.assign({}, T); } };
})();
