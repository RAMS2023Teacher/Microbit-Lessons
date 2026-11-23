/* 📨 The teacher's review, as a pop-up the next time the student opens any page (server: 62_review.js).
 *   Sent back: the teacher's feedback and rubric, and "Fix it now", which opens the lesson's Ship it stage.
 *   Approved:  confetti, the score, the feedback, and the XP and badges that finishing the lesson earned.
 * Closing it tells the server it was seen (/api/review {action: 'seen'}), so it shows once. The lesson's Ship it stage
 * and the home page keep showing the feedback after that. */
(function () {
  'use strict';
  const ML = window.ML || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = () => window.Celebrate || { confetti() {}, sound() {} };

  function rows(r) {
    const list = (r.rows || []).filter((x) => x.score);
    if (!list.length) return '';
    return '<ul class="plain rb-rows">' + list.map((x) =>
      `<li><span class="rb-dots" aria-label="${x.score} of 4">${'●'.repeat(x.score)}${'○'.repeat(4 - x.score)}</span> <b>${esc(x.label)}</b>: ${esc(x.level)}</li>`).join('') + '</ul>';
  }

  function card(r) {
    const fb = r.feedback ? `<blockquote class="teacher-fb">${esc(r.feedback).replace(/\n/g, '<br>')}</blockquote>` : '';
    if (r.status === 'returned') {
      return `<div class="review-pop-card returned" role="dialog" aria-modal="true" aria-labelledby="rp-title">` +
        `<div class="rp-icon" aria-hidden="true">🔧</div><small>${esc(r.icon)} ${esc(r.title)}</small>` +
        `<h2 id="rp-title">Your teacher asked for changes</h2>${fb}${rows(r)}` +
        `<p class="small">Fix it in MakeCode, click <b>Share</b> again for a new link, and ship it again.</p>` +
        `<div class="rp-actions"><a class="btn go" id="rp-fix" href="/lessons/${encodeURIComponent(r.lesson_id)}">Fix it now ▶</a>` +
        `<button type="button" class="btn ghost" id="rp-close">Later</button></div></div>`;
    }
    const won = (r.xp ? `<p class="rp-won">⭐ +${r.xp} XP</p>` : '') +
      ((r.badges || []).length ? `<p class="rp-won">${r.badges.map((b) => `${esc(b.icon)} ${esc(b.name)}`).join(' · ')}</p>` : '');
    return `<div class="review-pop-card approved" role="dialog" aria-modal="true" aria-labelledby="rp-title">` +
      `<div class="rp-icon" aria-hidden="true">✅</div><small>${esc(r.icon)} ${esc(r.title)}</small>` +
      `<h2 id="rp-title">Approved! Lesson complete</h2>` + (r.max ? `<p class="rb-score">Score <b>${r.total} of ${r.max}</b></p>` : '') +
      fb + rows(r) + won +
      `<div class="rp-actions"><button type="button" class="btn go" id="rp-close">Awesome!</button>` +
      `<a class="btn ghost" id="rp-map" href="/map">See the skill tree</a></div></div>`;
  }

  function show(list) {
    const r = list.shift();
    if (!r) return;
    const back = document.activeElement;
    const box = document.createElement('div');
    box.className = 'review-pop';
    box.innerHTML = card(r);
    document.body.appendChild(box);
    if (ML.fixLinks) ML.fixLinks(box);
    let closed = false;
    const done = (andThen) => {
      if (closed) return;
      closed = true;
      if (ML.api) ML.api('/api/review', { action: 'seen', lesson: r.lesson_id }).catch(() => {});
      box.remove();
      document.removeEventListener('keydown', key, true);
      if (andThen) andThen();
      else if (list.length) show(list);
      else if (back && back.focus) back.focus();
    };
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(); }
      if (e.key === 'Tab') {                                     // keep the keyboard inside the pop-up
        const f = [...box.querySelectorAll('a, button')];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    box.addEventListener('click', (e) => { if (e.target === box) done(); });
    box.querySelector('#rp-close').addEventListener('click', () => done());
    const fix = box.querySelector('#rp-fix');
    if (fix) {
      fix.addEventListener('click', (e) => {
        const here = ML.page === 'lesson' && ML.data && ML.data.lesson && ML.data.lesson.id === r.lesson_id;
        if (!here) { done(() => {}); return; }                 // the link opens the lesson
        e.preventDefault();
        done(() => { const b = document.querySelector('.stage[data-stage="ship"]'); if (b) b.click(); });
      });
    }
    const map = box.querySelector('#rp-map');
    if (map) map.addEventListener('click', () => done(() => {}));
    (fix || box.querySelector('#rp-close')).focus();
    if (r.status === 'approved') { C().sound('fanfare'); C().confetti(); }
    else C().sound('badge');
  }

  window.MLReview = {
    start() {
      if (ML.teacher || ML.preview) return;
      const news = ((ML.data || {}).review_news || []).slice();
      news.sort((a, b) => (a.status === b.status ? 0 : a.status === 'returned' ? -1 : 1));   // things to fix first
      if (news.length) setTimeout(() => show(news), 400);
    },
    show,
  };
})();
