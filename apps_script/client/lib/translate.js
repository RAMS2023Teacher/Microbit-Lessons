/* Translates the page into Brazilian Portuguese when a student picks it in Aa display settings.
 * It finds each "sentence" on the page (an element whose children are only text and inline tags like <b>, <code>),
 * swaps code, numbers and anything marked translate="no" (names) for placeholders, and asks the server
 * (server/70_translate.js) for the ones it hasn't seen before. Translations are kept on this device too, so pages
 * open translated straight away after the first time. New things on the page (the next step, a toast) are
 * translated as they appear. Picking English again reloads the page in English. */
(function () {
  'use strict';
  const ML = window.ML;
  if (!ML || !window.MLPrefs) return;
  const LANG = () => window.MLPrefs.get().lang;
  const KEY = (lang) => 'ml-tr-' + lang;
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'CODE', 'KBD', 'SPAN', 'MARK', 'SMALL', 'BR', 'Q', 'A', 'SUP', 'SUB', 'U', 'S']);
  const SKIP = 'script, style, textarea, input, select, option, svg, canvas, pre, .code-box, .bk-canvas, .blocks-box, [translate="no"], .notranslate, #ml-code, .prefs-big';
  const PROTECT = 'code, kbd, [translate="no"], .notranslate';
  const done = new WeakMap();                      // element -> the HTML we put there (to notice when the page changes it)
  let mem = {}, saveTimer = null, pending = new Map(), busy = false, observer = null;

  function load(lang) { try { mem = JSON.parse(localStorage.getItem(KEY(lang)) || '{}'); } catch (e) { mem = {}; } }
  function save(lang) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY(lang), JSON.stringify(mem)); } catch (e) {     // full: start over with what's on this page
        mem = {}; try { localStorage.removeItem(KEY(lang)); } catch (e2) { /* no storage */ }
      }
    }, 800);
  }
  function hash(s) {                                // same as trHash_ on the server
    let h1 = 0x811c9dc5, h2 = 5381;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = ((h2 * 33) ^ c) >>> 0; }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  }
  const hasWords = (s) => /[A-Za-z]{2,}/.test(s);

  /** element HTML -> { tpl: HTML with §n placeholders, keep: [original pieces] } */
  function template(el) {
    const clone = el.cloneNode(true), keep = [];
    clone.querySelectorAll(PROTECT).forEach((x) => { const i = keep.push(x.outerHTML) - 1; x.replaceWith(document.createRange().createContextualFragment(`<span translate="no">§${i}</span>`)); });
    let html = clone.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/(^|>)([^<]*)/g, (m, a, text) => a + text.replace(/(?<![§\d])\d+(?:[.,:]\d+)*/g, (n) => {   // numbers too, so "4:10 left" is one sentence
      const i = keep.push(n) - 1; return `<span translate="no">§${i}</span>`;
    }));
    return { tpl: html.trim(), keep };
  }
  function textTemplate(text) {
    const keep = [], esc = text.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { tpl: esc.replace(/\d+(?:[.,:]\d+)*/g, (n) => `<span translate="no">§${keep.push(n) - 1}</span>`), keep };
  }
  function fill(out, keep) {
    let ok = true;
    const html = out.replace(/<span[^>]*>\s*§\s*(\d+)\s*<\/span>/g, (m, i) => (keep[+i] != null ? keep[+i] : (ok = false, m)));
    const used = (out.match(/§\s*\d+/g) || []).length;
    return ok && used === keep.length ? html : null;     // a placeholder got lost: keep the English
  }
  // A child with an id is something the page updates by itself (a score, a "Saved ✓"): it's translated on its own,
  // so the sentence around it isn't translated again every time it changes.
  function isUnit(el) {
    for (const c of el.children) if (!INLINE.has(c.tagName) || c.id || c.querySelector('[id], button, input, select, textarea, div, p, ul, ol, table, img, svg, canvas')) return false;
    return hasWords(el.textContent);
  }
  function units(root) {
    const out = [];
    const walk = (el) => {
      if (el.nodeType !== 1 || el.matches(SKIP)) return;
      if (isUnit(el)) { out.push(el); return; }
      for (const n of el.childNodes) if (n.nodeType === 3 && hasWords(n.nodeValue)) out.push(n);    // loose text next to other things
      for (const c of el.children) walk(c);
    };
    walk(root);
    return out;
  }
  function attrs(root) {
    const out = [];
    root.querySelectorAll('[placeholder], [title], [aria-label]').forEach((el) => {
      if (el.closest(SKIP.replace('input, ', '').replace('textarea, ', ''))) return;
      ['placeholder', 'title', 'aria-label'].forEach((a) => { const v = el.getAttribute(a); if (v && hasWords(v) && el.getAttribute('data-tr-' + a) !== v) out.push([el, a, v]); });
    });
    return out;
  }

  function apply(el, tpl, keep) {
    const out = mem[hash(tpl)];
    if (out == null) return false;
    const html = fill(out, keep);
    if (html == null) return true;
    observer && observer.disconnect();
    if (el.nodeType === 3) {                                    // a loose bit of text: keep its spaces, set plain text
      const lead = el.nodeValue.match(/^\s*/)[0], tail = el.nodeValue.match(/\s*$/)[0], tmp = document.createElement('span');
      tmp.innerHTML = html;
      el.nodeValue = lead + tmp.textContent.trim() + tail;
      done.set(el, el.nodeValue);
    } else {
      el.innerHTML = html;
      done.set(el, el.innerHTML);
    }
    watch();
    return true;
  }
  function scan(root) {
    const lang = LANG();
    if (lang === 'en') return;
    units(root || document.body).forEach((el) => {
      if (done.get(el) === (el.nodeType === 3 ? el.nodeValue : el.innerHTML)) return;          // already ours
      const { tpl, keep } = el.nodeType === 3 ? textTemplate(el.nodeValue) : template(el);
      if (!hasWords(tpl)) return;
      if (!apply(el, tpl, keep)) pending.set(el, { tpl, keep });
    });
    attrs(root || document.body).forEach(([el, a, v]) => {
      const out = mem[hash(v)];
      if (out != null) { el.setAttribute(a, out); el.setAttribute('data-tr-' + a, out); } else pending.set(el, { attr: a, tpl: v });
    });
    if (pending.size) ask(lang);
  }
  async function ask(lang) {
    if (busy) return;
    busy = true;
    note(true);
    try {
      for (let round = 0; round < 12 && pending.size; round++) {
        const tpls = [...new Set([...pending.values()].map((p) => p.tpl))].filter((t) => mem[hash(t)] == null).slice(0, 80);
        if (tpls.length) {
          const r = await ML.run('translate', lang, tpls);
          Object.keys(r.done || {}).forEach((h) => { mem[h] = r.done[h]; });
          save(lang);
        }
        for (const [el, p] of [...pending]) {
          if (mem[hash(p.tpl)] == null) continue;
          pending.delete(el);
          if (!el.isConnected && !(el.nodeType === 3 && el.parentNode && el.parentNode.isConnected)) continue;
          if (p.attr) { el.setAttribute(p.attr, mem[hash(p.tpl)]); el.setAttribute('data-tr-' + p.attr, mem[hash(p.tpl)]); }
          else apply(el, p.tpl, p.keep);
        }
        if (!tpls.length || tpls.every((t) => mem[hash(t)] == null)) break;      // no progress: stop, the rest stays English
      }
    } catch (e) { /* the page stays in English */ }
    busy = false;
    note(false);
    pending.clear();
  }
  function note(on) {
    let n = document.getElementById('tr-note');
    if (!n && on) { n = document.createElement('div'); n.id = 'tr-note'; n.className = 'tr-note'; n.setAttribute('translate', 'no'); n.textContent = '🌐 Traduzindo…'; document.body.appendChild(n); }
    if (n) n.hidden = !on;
  }

  let timer = null;
  function watch() {
    if (LANG() === 'en') return;
    if (!observer) observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => scan(document.body), 150); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function start() {
    const lang = LANG();
    if (lang === 'en') return;
    load(lang);
    scan(document.body);
    watch();
  }
  window.addEventListener('ml-prefs', (e) => {
    if (e.detail.key !== 'lang') return;
    if (e.detail.value === 'en') { try { sessionStorage.setItem('ml-reopen-prefs', '1'); } catch (er) { /* fine */ } ML.reload(); }
    else start();
  });
  window.MLTranslate = { start, scan: () => scan(document.body) };
})();
