/* MakeCode Blocks, drawn from text (6th grade lessons). The format is in docs/LESSONS.md:
 *   one block per line, 2 spaces per level, a line ending in ":" holds the lines under it,
 *   [x] = a value you type or pick, (x) = a block that snaps into a slot, {cat} = the drawer (color).
 *   MLBlocks.render(text, newLines) -> HTML string. Everything is escaped. */
(function () {
  'use strict';
  const COLORS = { basic: '#1e90ff', input: '#c724b1', music: '#e63022', led: '#5c2d91', radio: '#e3008c', loops: '#00a00a',
                   logic: '#00a4a6', variables: '#dc143c', math: '#9400d3', game: '#007a4b', functions: '#3455db', ml: '#2f6fbf', text: '#b8860b' };
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

  function guess(text) {
    const t = text.toLowerCase().replace(/[[\]()]/g, '').replace(/\s+/g, ' ').trim();
    if (/^(on start|forever)\b/.test(t)) return 'basic';
    if (/\bml\b|machine learning/.test(t)) return 'ml';
    if (/radio/.test(t)) return 'radio';
    if (/sprite|game over|score|countdown|on edge|is touching|\blife\b/.test(t)) return 'game';
    if (/^on (button|shake|gesture|logo|pin|loud|quiet|tilt|screen)|acceleration|light level|temperature|compass|is pressed|sound level|running time/.test(t)) return 'input';
    if (/^(play|ring tone|rest|set volume|set tempo|start melody|stop all sounds|beat)\b/.test(t)) return 'music';
    if (/^(plot|unplot|toggle|point|led)\b/.test(t)) return 'led';
    if (/^(repeat|while|for |every)/.test(t)) return 'loops';
    if (/^(if|else)\b|^(not|and|or)\b|^(true|false)$|[<>=≤≥≠]/.test(t)) return 'logic';
    if (/^(set|change)\b/.test(t)) return 'variables';
    if (/pick random|^(abs|round|min|max|remainder)/.test(t)) return 'math';
    if (/^(call|function)\b/.test(t)) return 'functions';
    if (/^[a-z_][\w ]{0,18}$/i.test(t) && !/^(show|pause|clear)/.test(t)) return 'variables';     // a lone name: a variable
    return 'basic';
  }

  /** "show number (pick random [1] to [6])" -> HTML with slots and snapped-in blocks. */
  function inline(text) {
    let out = '', i = 0;
    const read = (close) => {
      let s = '';
      while (i < text.length) {
        const ch = text[i];
        if (ch === close) { i++; return s; }
        if (ch === '[') { i++; s += `<span class="bk-slot">${esc(readPlain(']'))}</span>`; continue; }
        if (ch === '(') {
          i++;
          const start = i, inner = read(')'), raw = text.slice(start, i - 1);
          if (/^(ms|mg|°c|cm|lx|degrees|seconds|%)$/i.test(raw.trim())) s += esc('(' + raw + ')');   // a unit label, like pause (ms)
          else s += `<span class="bk-in" style="--c:${COLORS[guess(raw.replace(/\[[^\]]*\]/g, 'x'))]}">${inner}</span>`;
          continue;
        }
        s += esc(ch); i++;
      }
      return s;
    };
    const readPlain = (close) => { let s = ''; while (i < text.length && text[i] !== close) s += text[i++]; i++; return s; };
    out = read(null);
    return out;
  }

  function parse(src) {
    const root = { kids: [] }, stack = [{ node: root, level: -1 }];
    String(src || '').replace(/\s+$/, '').split('\n').forEach((line, n) => {
      if (!line.trim()) return;
      const level = Math.floor((line.length - line.replace(/^ +/, '').length) / 2);
      let text = line.trim(), cat = null;
      const m = /^\{(\w+)\}\s*/.exec(text);
      if (m) { cat = m[1]; text = text.slice(m[0].length); }
      const opens = /:\s*$/.test(text);
      text = text.replace(/:\s*$/, '');
      const node = { text, cat: COLORS[cat] ? cat : guess(text), opens, line: n + 1, kids: [] };
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      stack[stack.length - 1].node.kids.push(node);
      if (opens) stack.push({ node, level });
    });
    return root.kids;
  }

  function list(nodes, fresh, top) {
    let html = '';
    for (let k = 0; k < nodes.length; k++) {
      const nd = nodes[k], color = COLORS[nd.cat], isNew = fresh.has(nd.line) ? ' new' : '';
      if (!nd.opens) { html += `<div class="bk${isNew}" style="--c:${color}">${inline(nd.text)}</div>`; continue; }
      const hat = top && /^(on |forever|every)/i.test(nd.text);
      let parts = `<div class="bk-head${isNew}">${inline(nd.text)}</div><div class="bk-body">${list(nd.kids, fresh, false) || '<div class="bk-empty"></div>'}</div>`;
      while (nodes[k + 1] && /^else\b/i.test(nodes[k + 1].text)) {           // else / else if joins the if above it
        const e = nodes[++k];
        parts += `<div class="bk-head bk-mid${fresh.has(e.line) ? ' new' : ''}">${inline(e.text)}</div><div class="bk-body">${list(e.kids, fresh, false) || '<div class="bk-empty"></div>'}</div>`;
      }
      html += `<div class="bk-c${hat ? ' bk-hat' : ''}" style="--c:${color}">${parts}<div class="bk-foot"></div></div>`;
    }
    return html;
  }

  function render(text, newLines) {
    const fresh = new Set(newLines || []);
    return `<div class="bk-canvas">${list(parse(text), fresh, true)}</div>`;
  }

  window.MLBlocks = { render, guess, colors: COLORS };
})();
