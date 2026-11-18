/* 🐞 Report a problem: a small form that also sends where the student was (page, lesson, stage, step), the
 * browser, the screen size and the page's last errors. Page errors are also reported on their own, at most 3 per
 * visit (server/75_bugs.js drops repeats). MLBugs.open() opens the form. */
(function () {
  'use strict';
  const errors = [];
  let autoSent = 0;
  const IGNORE = /Script error\.?$|ResizeObserver|fonts\.g|chrome-extension|Load failed|NetworkError|Failed to fetch/i;
  function context() {
    const ML = window.ML || {}, c = ML.ctx || {};
    return { lesson: c.lesson || '', stage: c.stage || '', step: c.step == null ? null : c.step,
             lang: window.MLPrefs ? window.MLPrefs.get().lang : 'en' };
  }
  function payload(kind, text) {
    return { kind, text, page: (window.ML && window.ML.path) || location.search, ctx: context(), errors: errors.slice(-5),
             browser: navigator.userAgent, screen: window.innerWidth + '×' + window.innerHeight };
  }
  function autoReport(msg) {
    if (!msg || IGNORE.test(msg)) return;
    errors.push(msg);
    if (autoSent >= 3 || !window.ML || !window.ML.run) return;
    autoSent++;
    window.ML.run('reportBug', payload('auto', msg)).catch(() => { /* never make things worse */ });
  }
  window.addEventListener('error', (e) => autoReport((e.message || 'error') + (e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : '')));
  window.addEventListener('unhandledrejection', (e) => autoReport('Promise: ' + ((e.reason && (e.reason.message || e.reason)) || 'rejected')));

  const KINDS = [['broken', "🐞 Something didn't work"], ['words', '😵 Words are wrong or confusing'], ['find', "🔎 I can't find something"], ['other', '💬 Something else']];
  function open() {
    let box = document.getElementById('bug-panel');
    if (box) { box.remove(); return; }
    box = document.createElement('div');
    box.id = 'bug-panel';
    box.className = 'prefs-panel bug-panel';
    box.setAttribute('role', 'dialog');
    box.innerHTML = `<div class="prefs-head"><h2>🐞 Report a problem</h2><button type="button" class="setup-x" id="bug-x" aria-label="Close">✕</button></div>` +
      `<p class="small muted">Your teacher sees this, with the page you're on. Thank you for helping make Maker Lab better!</p>` +
      `<div class="flag-reasons" id="bug-kinds">${KINDS.map(([k, l]) => `<button type="button" class="flag-reason" data-k="${k}">${l}</button>`).join('')}</div>` +
      `<label class="ask-box"><b>What happened?</b><textarea id="bug-text" rows="4" maxlength="1500" placeholder="e.g. I pressed Next and nothing happened"></textarea></label>` +
      `<div class="row"><button type="button" class="btn go" id="bug-send">Send report</button><span class="saved" id="bug-msg"></span></div>`;
    document.body.appendChild(box);
    let kind = '';
    box.querySelectorAll('#bug-kinds .flag-reason').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.k; box.querySelectorAll('#bug-kinds .flag-reason').forEach((x) => x.classList.toggle('on', x === b));
    }));
    box.querySelector('#bug-x').addEventListener('click', () => box.remove());
    box.querySelector('#bug-text').focus();
    box.querySelector('#bug-send').addEventListener('click', async () => {
      const text = box.querySelector('#bug-text').value.trim(), msg = box.querySelector('#bug-msg'), go = box.querySelector('#bug-send');
      if (!kind || text.length < 3) {
        msg.textContent = !kind ? 'Pick what kind of problem.' : 'Tell us a little about what happened.';
        if (window.Celebrate) window.Celebrate.nope(go, msg);
        return;
      }
      go.disabled = true;
      try {
        await window.ML.run('reportBug', payload(kind, text));
        box.innerHTML = '<div class="prefs-head"><h2>✅ Thanks!</h2><button type="button" class="setup-x" id="bug-x" aria-label="Close">✕</button></div>' +
          '<p>Your report was sent to your teacher.</p>';
        box.querySelector('#bug-x').addEventListener('click', () => box.remove());
        setTimeout(() => box.remove(), 3500);
      } catch (e) { go.disabled = false; msg.textContent = (e && e.message) || 'Could not send. Try again.'; }
    });
  }
  window.MLBugs = { open, errors };
})();
