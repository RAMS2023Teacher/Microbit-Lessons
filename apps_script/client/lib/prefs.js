/* Display settings ("Aa" in the top bar): font, text size, spacing, contrast, motion and language.
 * Saved on this device (each student signs in to their own Chrome profile on a Chromebook) and applied as classes
 * on <html> before the page draws:  f-lexend  t-l  sp-wide  c-high  mo-less   and  lang="pt-BR".
 *   MLPrefs.get()  MLPrefs.set(key, value)  MLPrefs.open()   fires window event "ml-prefs" when something changes. */
(function () {
  'use strict';
  const KEY = 'ml-prefs';
  const DEF = { font: 'standard', size: 'm', spacing: 'normal', contrast: 'normal', motion: 'full', lang: 'en' };
  const CHOICES = {
    font: [['standard', 'Standard', 'Nunito'], ['lexend', 'Lexend', 'Easier to read'], ['atkinson', 'Atkinson', 'Clear letters'], ['system', 'Plain', 'Your computer\'s font']],
    size: [['s', 'A', 'Smaller'], ['m', 'A', 'Normal'], ['l', 'A', 'Bigger'], ['xl', 'A', 'Biggest']],
    spacing: [['normal', '≡', 'Normal'], ['wide', '☰', 'More space']],
    contrast: [['normal', '◐', 'Normal'], ['high', '◼', 'High contrast']],
    motion: [['full', '✨', 'Animations on'], ['less', '⏸', 'Less motion']],
    lang: [['en', '🇺🇸', 'English'], ['pt', '🇧🇷', 'Português (Brasil)']],
  };
  const LABELS = { font: 'Font', size: 'Text size', spacing: 'Line spacing', contrast: 'Colors', motion: 'Motion', lang: 'Language' };
  let P = Object.assign({}, DEF);
  try { P = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* no storage: defaults */ }

  function apply() {
    const h = document.documentElement;
    h.className = h.className.replace(/\b(f|t|sp|c|mo)-[a-z]+\b/g, '').trim();
    h.classList.add('f-' + P.font, 't-' + P.size, 'sp-' + P.spacing, 'c-' + P.contrast, 'mo-' + P.motion);
    h.lang = P.lang === 'pt' ? 'pt-BR' : 'en';
  }
  function set(k, v) {
    if (!CHOICES[k] || !CHOICES[k].some((c) => c[0] === v)) return;
    const was = P[k];
    P[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* not saved on this device */ }
    apply();
    window.dispatchEvent(new CustomEvent('ml-prefs', { detail: { key: k, value: v, was } }));
  }

  function open() {
    let box = document.getElementById('prefs-panel');
    if (box) { box.remove(); return; }
    box = document.createElement('div');
    box.id = 'prefs-panel';
    box.className = 'prefs-panel';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Display settings');
    const rows = Object.keys(CHOICES).map((k) => `<div class="prefs-row"><b>${LABELS[k]}</b><div class="prefs-opts" data-k="${k}"${k === 'lang' ? ' translate="no"' : ''}>` +
      CHOICES[k].map((c) => `<button type="button" class="prefs-opt${P[k] === c[0] ? ' on' : ''} opt-${k}-${c[0]}" data-v="${c[0]}" aria-pressed="${P[k] === c[0]}">` +
        `<span class="prefs-big">${c[1]}</span><small>${c[2]}</small></button>`).join('') + '</div></div>').join('');
    box.innerHTML = `<div class="prefs-head"><h2>Aa Display settings</h2><button type="button" class="setup-x" id="prefs-close" aria-label="Close">✕</button></div>` +
      rows + `<p class="prefs-sample">The quick brown fox jumps over the lazy dog. 0123456789</p>` +
      `<p class="prefs-note small muted" id="prefs-note"></p>` +
      `<div class="row"><button type="button" class="btn small ghost" id="prefs-reset">Reset</button>` +
      (window.MLBugs ? `<button type="button" class="btn small ghost" id="prefs-bug">🐞 Report a problem</button>` : '') +
      `<button type="button" class="btn small go" id="prefs-done">Done</button></div>`;
    document.body.appendChild(box);
    const note = () => { box.querySelector('#prefs-note').textContent = P.lang === 'pt' ? 'Tradução automática do Google. Os códigos e os nomes ficam como estão.' : ''; };
    note();
    box.querySelectorAll('.prefs-opts').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('.prefs-opt');
      if (!b) return;
      set(g.dataset.k, b.dataset.v);
      g.querySelectorAll('.prefs-opt').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      note();
    }));
    const close = () => box.remove();
    box.querySelector('#prefs-close').addEventListener('click', close);
    box.querySelector('#prefs-done').addEventListener('click', close);
    box.querySelector('#prefs-reset').addEventListener('click', () => { Object.keys(DEF).forEach((k) => set(k, DEF[k])); close(); open(); });
    const bug = box.querySelector('#prefs-bug');
    if (bug) bug.addEventListener('click', () => { close(); window.MLBugs.open(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  }

  apply();
  window.MLPrefs = { get: () => Object.assign({}, P), set, open, reducedMotion: () => P.motion === 'less' ||
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) };
})();
