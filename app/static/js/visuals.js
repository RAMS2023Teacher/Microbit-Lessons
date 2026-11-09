/* Visual aids for lesson cards, quiz questions and challenges.
 * Lesson YAML:  visual: {type: leds, image: HEART, caption: "..."}
 * Types: leds, part, circuit, flow, wave, scale, compare, bits, dial, graph
 * (validated by app/visuals.py — keep the two in sync; see docs/LESSON_FORMAT.md). */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const INK = '#17203a', MUTED = '#5d6680', TEAL = '#0fa3a3', YELLOW = '#ffd23f', RED = '#ef4444', LINE = '#c9cfdd';
  const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="${NS}">${body}</svg>`;
  // fill="..." on text becomes an inline style so it beats the .vz-* CSS colors
  const t = (x, y, s, o) => `<text x="${x}" y="${y}" ${(o || '').replace(/\bfill="([^"]+)"/, 'style="fill:$1"')}>${esc(s)}</text>`;

  // ---------------------------------------------------------------- leds
  const IMAGES = {
    HEART: '09090:99999:99999:09990:00900', HEART_SMALL: '00000:09090:09990:00900:00000',
    HAPPY: '00000:09090:00000:90009:09990', SMILE: '00000:00000:00000:90009:09990',
    SAD: '00000:09090:00000:09990:90009', YES: '00000:00009:00090:90900:09000',
    NO: '90009:09090:00900:09090:90009', SQUARE: '99999:90009:90009:90009:99999',
    DIAMOND: '00900:09090:90009:09090:00900', STICKFIGURE: '00900:99999:00900:09090:90009',
    ARROW_N: '00900:09990:90909:00900:00900', ARROW_E: '00900:00090:99999:00090:00900',
    ARROW_W: '00900:09000:99999:09000:00900', ARROW_S: '00900:00900:90909:09990:00900',
    SKULL: '09990:90909:99999:09990:09990', GHOST: '99999:90909:99999:99999:90909',
    TARGET: '00900:09990:99099:09990:00900', ALL: '99999:99999:99999:99999:99999', OFF: '00000:00000:00000:00000:00000',
  };
  function ledGrid(img, x0, y0, cell) {
    const rows = (IMAGES[img] || img).split(':');
    let o = '';
    rows.forEach((row, r) => row.split('').forEach((ch, c) => {
      const b = parseInt(ch, 10) / 9;
      o += `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell * 0.62}" height="${cell * 0.62}" rx="2" fill="${b ? RED : '#3b4366'}" opacity="${b ? 0.25 + 0.75 * b : 1}"${b > 0.5 ? ' filter="url(#ledglow)"' : ''}/>`;
    }));
    return o;
  }
  function leds(v) {
    const frames = v.frames || [v.image || 'OFF'];
    const cell = 22, W = frames.length > 1 ? 170 * Math.min(frames.length, 4) : 170, H = 170;
    let body = '<defs><filter id="ledglow"><feGaussianBlur stdDeviation="1.6"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    frames.slice(0, 4).forEach((f, i) => {
      const x = i * 170;
      body += `<rect x="${x + 10}" y="10" width="150" height="150" rx="18" fill="#1b2550"/>`;
      body += `<circle cx="${x + 26}" cy="85" r="7" fill="#2b3770"/><circle cx="${x + 144}" cy="85" r="7" fill="#2b3770"/>`;
      body += t(x + 26, 108, 'A', 'class="vz-mb" text-anchor="middle"') + t(x + 144, 108, 'B', 'class="vz-mb" text-anchor="middle"');
      body += ledGrid(f, x + 34, 34, cell);
      if (i < frames.length - 1) body += `<path d="M${x + 163} 85 l8 0" stroke="${MUTED}" stroke-width="2"/>`;
    });
    return svg(W, H, body, v.alt || `micro:bit display showing ${frames.join(', then ')}`);
  }

  // ---------------------------------------------------------------- part
  const BAND = ['#111', '#7b4a12', '#d32f2f', '#f57c00', '#fbc02d', '#2e7d32', '#1565c0', '#7b1fa2', '#9e9e9e', '#fafafa'];
  function bands(ohms) {
    const s = String(Math.round(ohms || 220));
    return [BAND[+s[0]], BAND[+(s[1] || 0)], BAND[Math.max(0, s.length - 2)]];
  }
  function callout(x1, y1, x2, y2, label, anchor) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="3 3"/>` +
      t(x2 + (anchor === 'end' ? -4 : 4), y2 + 4, label, `class="vz-label" text-anchor="${anchor || 'start'}"`);
  }
  function part(v) {
    const L = v.labels || {};
    let b = '', W = 320, H = 190;
    switch (v.part) {
      case 'led': {
        const col = { red: '#ff3b30', green: '#34c759', yellow: '#ffd60a', blue: '#0a84ff', white: '#eee' }[v.color] || '#ff3b30';
        b += `<line x1="140" y1="100" x2="140" y2="180" stroke="#9aa0a6" stroke-width="4"/><line x1="176" y1="100" x2="176" y2="160" stroke="#9aa0a6" stroke-width="4"/>`;
        b += `<path d="M124 100 v-40 a34 34 0 0 1 68 0 v40 z" fill="${col}" opacity=".9" stroke="rgba(0,0,0,.3)"/><rect x="118" y="96" width="80" height="8" rx="2" fill="${col}"/><rect x="190" y="96" width="8" height="8" fill="#fff" opacity=".9"/>`;
        b += `<ellipse cx="146" cy="58" rx="8" ry="14" fill="#fff" opacity=".45"/>`;
        b += callout(140, 170, 100, 170, L.anode || '+ long leg', 'end') + callout(176, 150, 206, 150, L.cathode || '– short leg');
        b += callout(196, 100, 212, 80, L.flat || 'flat edge = –');
        break;
      }
      case 'resistor': {
        const bs = bands(v.ohms);
        b += `<line x1="20" y1="95" x2="300" y2="95" stroke="#9aa0a6" stroke-width="4"/><rect x="100" y="76" width="120" height="38" rx="16" fill="#e8cfa0" stroke="#b39461"/>`;
        bs.forEach((c, i) => { b += `<rect x="${118 + i * 20}" y="76" width="10" height="38" fill="${c}"/>`; });
        b += `<rect x="190" y="76" width="8" height="38" fill="#c9a227"/>`;
        b += t(160, 150, L.value || `${v.ohms || 220} Ω`, `class="vz-big" text-anchor="middle"`);
        b += t(160, 172, L.note || 'no + or –: either way round works', 'class="vz-label" text-anchor="middle"');
        break;
      }
      case 'button': {
        b += `<rect x="110" y="55" width="100" height="100" rx="8" fill="#37474f"/><circle cx="160" cy="105" r="28" fill="#ef5350"/>`;
        [[110, 70], [110, 140], [210, 70], [210, 140]].forEach(([x, y]) => { b += `<line x1="${x}" y1="${y}" x2="${x + (x < 160 ? -28 : 28)}" y2="${y}" stroke="#9aa0a6" stroke-width="4"/>`; });
        b += `<path d="M80 70 v70" stroke="${TEAL}" stroke-width="3"/><path d="M240 70 v70" stroke="${TEAL}" stroke-width="3"/>`;
        b += t(74, 104, 'always', 'class="vz-label" text-anchor="end"') + t(74, 118, 'joined', 'class="vz-label" text-anchor="end"') + t(246, 104, 'always', 'class="vz-label"') + t(246, 118, 'joined', 'class="vz-label"');
        b += t(160, 180, L.press || 'press = left side connects to right side', 'class="vz-label" text-anchor="middle"');
        b += t(160, 40, L.top || 'straddle the middle gap', 'class="vz-label" text-anchor="middle"');
        break;
      }
      case 'ldr': {
        b += `<line x1="150" y1="120" x2="150" y2="180" stroke="#9aa0a6" stroke-width="4"/><line x1="170" y1="120" x2="170" y2="180" stroke="#9aa0a6" stroke-width="4"/>`;
        b += `<circle cx="160" cy="85" r="40" fill="#f3e2b5" stroke="#a1887f" stroke-width="2"/><path d="M134 72 q6-10 12 0 t12 0 t12 0 t12 0 M134 98 q6-10 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#c62828" stroke-width="2.5"/>`;
        b += `<g stroke="${YELLOW}" stroke-width="3"><path d="M60 30 l40 25"/><path d="M50 60 l40 15"/></g>` + t(40, 26, L.light || 'more light', 'class="vz-label"');
        b += t(230, 80, L.note || 'more light =', 'class="vz-label"') + t(230, 96, L.note2 || 'less resistance', 'class="vz-label"');
        break;
      }
      case 'potentiometer': {
        b += `<rect x="100" y="40" width="120" height="80" rx="10" fill="#1e88e5"/><circle cx="160" cy="80" r="26" fill="#eceff1"/><line x1="160" y1="80" x2="174" y2="60" stroke="#455a64" stroke-width="5" stroke-linecap="round"/>`;
        [[115, L.left || '3V'], [160, L.wiper || 'middle → pin'], [205, L.right || 'GND']].forEach(([x, lab], i) => {
          b += `<line x1="${x}" y1="120" x2="${x}" y2="${i === 1 ? 168 : 150}" stroke="#9aa0a6" stroke-width="4"/>` + t(x, i === 1 ? 184 : 166, lab, 'class="vz-label" text-anchor="middle"');
        });
        b += `<path d="M190 52 a34 34 0 0 1 4 38" fill="none" stroke="${YELLOW}" stroke-width="3" marker-end="url(#vzarrow)"/>`;
        break;
      }
      case 'transistor': {
        const pins = v.pins || ['E', 'B', 'C'];
        const names = { E: 'emitter → GND', B: 'base ← pin (via resistor)', C: 'collector ← load' };
        b += `<path d="M110 130 v-40 a50 50 0 0 1 100 0 v40 z" fill="#212121"/>` + t(160, 112, v.label || 'NPN', 'class="vz-chip" text-anchor="middle"');
        b += t(160, 26, L.flat || 'flat side facing you', 'class="vz-label" text-anchor="middle"');
        [125, 160, 195].forEach((x, i) => {
          b += `<line x1="${x}" y1="130" x2="${x}" y2="155" stroke="#9aa0a6" stroke-width="4"/>` + t(x, 174, pins[i], 'class="vz-big" text-anchor="middle"');
        });
        W = 320; H = 220;
        b += t(160, 200, pins.map((p) => `${p} = ${(L[p] || names[p] || p).split(' ')[0]}`).join('   '), 'class="vz-label" text-anchor="middle"');
        break;
      }
      case 'diode': {
        b += `<line x1="20" y1="95" x2="300" y2="95" stroke="#9aa0a6" stroke-width="4"/><rect x="110" y="78" width="100" height="34" rx="6" fill="#212121"/><rect x="186" y="78" width="12" height="34" fill="#e0e0e0"/>`;
        b += callout(192, 112, 210, 150, L.stripe || 'stripe = – side') + callout(120, 112, 100, 150, L.anode || '+ side', 'end');
        b += t(160, 50, L.note || 'current flows one way only →', 'class="vz-label" text-anchor="middle"');
        break;
      }
      case 'buzzer': {
        b += `<circle cx="160" cy="85" r="48" fill="#212121"/><circle cx="160" cy="85" r="7" fill="#777"/>` + t(140, 70, '+', 'class="vz-big" fill="#fff"');
        b += `<line x1="145" y1="133" x2="145" y2="180" stroke="#9aa0a6" stroke-width="4"/><line x1="175" y1="133" x2="175" y2="170" stroke="#9aa0a6" stroke-width="4"/>`;
        b += callout(145, 175, 90, 175, L.plus || '+ → pin', 'end') + callout(175, 165, 220, 165, L.minus || '– → GND');
        b += `<g fill="none" stroke="${TEAL}" stroke-width="3"><path d="M222 60 q12 25 0 50"/><path d="M238 50 q18 35 0 70"/></g>`;
        break;
      }
      case 'servo': {
        b += `<rect x="120" y="60" width="140" height="70" rx="6" fill="#1565c0"/><circle cx="160" cy="60" r="16" fill="#e3f2fd"/><rect x="152" y="18" width="16" height="44" rx="8" fill="#fff" stroke="#90a4ae" transform="rotate(30 160 60)"/>`;
        [['#795548', L.gnd || 'brown = GND'], ['#e53935', L.vcc || 'red = + battery'], ['#fb8c00', L.sig || 'orange = signal pin']].forEach(([c, lab], i) => {
          const y = 85 + i * 14;
          b += `<path d="M120 ${y} C90 ${y} 80 ${150 + i * 14} 50 ${150 + i * 14}" fill="none" stroke="${c}" stroke-width="4"/>` + t(46, 154 + i * 14, lab, 'class="vz-label" text-anchor="end"');
        });
        b = `<g transform="translate(80 0)">${b}</g>`;
        W = 360;
        break;
      }
      case 'dcmotor': {
        b += `<rect x="90" y="60" width="120" height="70" rx="30" fill="#b0bec5" stroke="#78909c" stroke-width="2"/><rect x="210" y="88" width="34" height="14" rx="3" fill="#78909c"/>`;
        b += `<line x1="90" y1="80" x2="50" y2="70" stroke="#e53935" stroke-width="4"/><line x1="90" y1="110" x2="50" y2="120" stroke="#263238" stroke-width="4"/>`;
        b += t(44, 74, 'A', 'class="vz-big" text-anchor="end"') + t(44, 126, 'B', 'class="vz-big" text-anchor="end"');
        b += t(150, 160, L.note || 'swap A and B = spins the other way', 'class="vz-label" text-anchor="middle"');
        b += `<path d="M262 70 a24 24 0 1 1 -2 50" fill="none" stroke="${TEAL}" stroke-width="3" marker-end="url(#vzarrow)"/>`;
        break;
      }
      case 'battery': {
        b += `<rect x="80" y="60" width="160" height="70" rx="8" fill="#424242"/>` + t(160, 102, v.label || '4×AA', 'class="vz-chip" text-anchor="middle"');
        b += `<path d="M240 80 C270 80 270 60 300 60" stroke="#e53935" stroke-width="4" fill="none"/><path d="M240 110 C270 110 270 130 300 130" stroke="#263238" stroke-width="4" fill="none"/>`;
        b += t(160, 40, L.plus || 'red = +    black = –', 'class="vz-label" text-anchor="middle"');
        b += t(160, 160, L.note || 'join the black wire to micro:bit GND', 'class="vz-label" text-anchor="middle"');
        break;
      }
      default:
        b += t(160, 95, v.part, 'class="vz-big" text-anchor="middle"');
    }
    const defs = `<defs><marker id="vzarrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${TEAL}"/></marker></defs>`;
    return svg(W, H, defs + b, v.alt || `${v.part} with its legs labeled`);
  }

  // ---------------------------------------------------------------- circuit (mini breadboard)
  function circuit(v, el) {
    if (!window.Breadboard) return '';
    window.Breadboard.render(el, { steps: [{ add: v.add || [] }] }, 0, { plain: true, crop: true });
    const s = el.querySelector('svg');
    if (s) { s.setAttribute('aria-label', v.alt || 'breadboard circuit'); }
    return null;
  }

  // ---------------------------------------------------------------- flow
  function flow(v) {
    const steps = v.steps || [];
    const n = steps.length, bw = 96, gap = 34, W = n * bw + (n - 1) * gap + 20, H = v.loop ? 150 : 120;
    let b = `<defs><marker id="vzflow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${MUTED}"/></marker></defs>`;
    steps.forEach((s, i) => {
      const x = 10 + i * (bw + gap);
      b += `<rect x="${x}" y="14" width="${bw}" height="86" rx="14" fill="#fff" stroke="${s.color || TEAL}" stroke-width="2.5"/>`;
      b += t(x + bw / 2, 52, s.icon || '', 'class="vz-icon" text-anchor="middle"');
      wrap(s.label, 13).forEach((line, j) => { b += t(x + bw / 2, 74 + j * 14, line, `class="vz-label" text-anchor="middle"${line.length > 13 ? ` textLength="${bw - 10}" lengthAdjust="spacingAndGlyphs"` : ''}`); });
      if (i < n - 1) b += `<line x1="${x + bw + 3}" y1="57" x2="${x + bw + gap - 5}" y2="57" stroke="${MUTED}" stroke-width="2.5" marker-end="url(#vzflow)"/>`;
    });
    if (v.loop && n > 1) {
      const x1 = 10 + (n - 1) * (bw + gap) + bw / 2, x2 = 10 + bw / 2;
      b += `<path d="M${x1} 102 V132 H${x2} V106" fill="none" stroke="${MUTED}" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#vzflow)"/>`;
      if (v.loop_label) b += t((x1 + x2) / 2, 126, v.loop_label, 'class="vz-label" text-anchor="middle"');
    }
    return svg(W, H, b, v.alt || steps.map((s) => s.label).join(' → ') + (v.loop ? ' → repeat' : ''));
  }
  function wrap(s, n) {
    const words = String(s || '').split(' '), lines = [''];
    words.forEach((w) => { if ((lines[lines.length - 1] + ' ' + w).trim().length > n && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); });
    return lines.slice(0, 2);
  }

  // ---------------------------------------------------------------- wave (PWM)
  function wave(v) {
    const duty = v.duty || [25, 50, 100];
    const H = 30 + duty.length * 60, W = 340;
    let b = '';
    duty.forEach((d, i) => {
      const y = 14 + i * 60, per = 60, hi = 28;
      let p = `M20 ${y + hi}`;
      for (let k = 0; k < 4; k++) {
        const x = 20 + k * per, on = per * d / 100;
        p += d === 0 ? ` H${x + per}` : d === 100 ? ` V${y} H${x + per}` : ` V${y} H${x + on} V${y + hi} H${x + per}`;
      }
      b += `<path d="${p}" fill="none" stroke="${TEAL}" stroke-width="3"/>`;
      b += t(256, y + 22, `${d}%`, 'class="vz-big"');
      b += `<circle cx="318" cy="${y + 15}" r="12" fill="${RED}" opacity="${0.12 + 0.88 * d / 100}"/>`;
      if (v.values) b += t(20, y + 46, `write_analog(${v.values[i]})`, 'class="vz-code"');
    });
    b += t(20, H - 4, v.axis || 'time →   (each bump = on, flat = off)', 'class="vz-label"');
    return svg(W, H, b, v.alt || `on/off signal with ${duty.join('%, ')}% on-time; more on-time looks brighter`);
  }

  // ---------------------------------------------------------------- scale (number line, zones, mapping)
  function scale(v) {
    const min = v.min ?? 0, max = v.max ?? 1023, W = 340, x0 = 26, x1 = 314;
    const X = (n) => x0 + (x1 - x0) * (n - min) / (max - min);
    let b = '', H = 90;
    (v.zones || []).forEach((z) => {
      b += `<rect x="${X(z.from)}" y="26" width="${X(z.to) - X(z.from)}" height="22" fill="${z.color || '#dff4f4'}"/>`;
      b += t((X(z.from) + X(z.to)) / 2, 41, z.label || '', 'class="vz-label" text-anchor="middle"');
    });
    b += `<line x1="${x0}" y1="48" x2="${x1}" y2="48" stroke="${INK}" stroke-width="2"/>`;
    const marks = v.marks || [{ at: min }, { at: max }];
    marks.forEach((m) => {
      const anchor = m.at <= min ? 'start' : m.at >= max ? 'end' : 'middle';
      b += `<line x1="${X(m.at)}" y1="44" x2="${X(m.at)}" y2="54" stroke="${INK}" stroke-width="2"/>` + t(X(m.at) + (anchor === 'start' ? -4 : anchor === 'end' ? 4 : 0), 68, m.label ?? m.at, `class="vz-label" text-anchor="${anchor}"`);
      if (m.pointer) b += `<path d="M${X(m.at)} 22 l-6 -10 h12 z" fill="${RED}"/>`;
    });
    if (v.map) {
      const [a, z] = v.map, Y = (n) => x0 + (x1 - x0) * (n - a) / (z - a);
      H = 150;
      b += `<line x1="${x0}" y1="118" x2="${x1}" y2="118" stroke="${TEAL}" stroke-width="2"/>`;
      for (let n = a; n <= z; n++) {
        b += `<line x1="${Y(n)}" y1="114" x2="${Y(n)}" y2="122" stroke="${TEAL}" stroke-width="2"/>` + t(Y(n), 138, n, 'class="vz-label" text-anchor="middle" fill="#0b7f7f"');
      }
      marks.forEach((m) => {
        const mapped = a + (m.at - min) * (z - a) / (max - min);
        b += `<line x1="${X(m.at)}" y1="74" x2="${Y(mapped)}" y2="112" stroke="${TEAL}" stroke-dasharray="3 3"/>`;
      });
      if (v.map_label) b += t(x1, 106, v.map_label, 'class="vz-label" text-anchor="end" fill="#0b7f7f"');
    }
    if (v.label) { b += t(W / 2, H + 4, v.label, 'class="vz-label" text-anchor="middle" fill="#5d6680"'); H += 18; }
    return svg(W, H, b, v.alt || `number line from ${min} to ${max}`);
  }

  // ---------------------------------------------------------------- compare
  function compare(v) {
    const items = (v.items || []).slice(0, 4);
    return `<div class="vz-compare" style="--n:${items.length}">` + items.map((i) =>
      `<div class="vz-col"><span class="vz-col-icon" aria-hidden="true">${esc(i.icon || '')}</span><b>${esc(i.title || '')}</b>${i.text ? `<span>${esc(i.text)}</span>` : ''}</div>`).join('') + '</div>';
  }

  // ---------------------------------------------------------------- bits
  function bits(v) {
    const n = v.bits || 8, val = v.value ?? 0, cw = Math.min(34, 320 / n), W = n * cw + 20, H = 110;
    let b = '';
    for (let i = 0; i < n; i++) {
      const place = 2 ** (n - 1 - i), on = Math.floor(val / place) % 2;
      const x = 10 + i * cw;
      b += `<rect x="${x}" y="30" width="${cw - 4}" height="34" rx="5" fill="${on ? YELLOW : '#eef1f8'}" stroke="${on ? '#c99a00' : LINE}"/>`;
      b += t(x + (cw - 4) / 2, 54, on, 'class="vz-big" text-anchor="middle"');
      b += t(x + (cw - 4) / 2, 22, place, 'class="vz-tiny" text-anchor="middle"');
    }
    b += t(W / 2, 92, v.caption_inline || `= ${val} in our normal numbers`, 'class="vz-label" text-anchor="middle"');
    return svg(W, H, b, v.alt || `${val} written in binary with ${n} bits`);
  }

  // ---------------------------------------------------------------- dial (servo angle)
  function dial(v) {
    const W = 300, H = 180, cx = 150, cy = 150, r = 115;
    let b = `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="#eef1f8" stroke="${LINE}" stroke-width="2"/>`;
    (v.marks || [{ angle: 0 }, { angle: 90 }, { angle: 180 }]).forEach((m) => {
      const a = Math.PI * (1 - m.angle / 180), x = cx + Math.cos(a) * r, y = cy - Math.sin(a) * r;
      b += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${m.pointer ? RED : LINE}" stroke-width="${m.pointer ? 5 : 1.5}" stroke-linecap="round"/>`;
      const lx = cx + Math.cos(a) * (r + 14), ly = cy - Math.sin(a) * (r + 14);
      b += t(lx, ly, m.label ?? `${m.angle}°`, `class="vz-label" text-anchor="${m.angle < 60 ? 'start' : m.angle > 120 ? 'end' : 'middle'}"`);
    });
    b += `<circle cx="${cx}" cy="${cy}" r="10" fill="${INK}"/>`;
    return svg(W, H, b, v.alt || 'servo angle dial from 0 to 180 degrees');
  }

  // ---------------------------------------------------------------- graph
  function graph(v) {
    const pts = v.points || [], W = 340, H = 180, x0 = 40, x1 = 325, y0 = 145, y1 = 15;
    const lo = v.min ?? Math.min(...pts, v.line ? v.line.y : Infinity), hi = v.max ?? Math.max(...pts, v.line ? v.line.y : -Infinity);
    const X = (i) => x0 + (x1 - x0) * i / Math.max(1, pts.length - 1), Y = (n) => y0 - (y0 - y1) * (n - lo) / Math.max(1e-9, hi - lo);
    let b = `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${INK}"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${INK}"/>`;
    b += t(x0 - 6, y0, lo, 'class="vz-tiny" text-anchor="end"') + t(x0 - 6, y1 + 8, hi, 'class="vz-tiny" text-anchor="end"');
    if (v.line) b += `<line x1="${x0}" y1="${Y(v.line.y)}" x2="${x1}" y2="${Y(v.line.y)}" stroke="${RED}" stroke-dasharray="6 4" stroke-width="2"/>` + t(x0 + 6, Y(v.line.y) - 6, v.line.label || v.line.y, 'class="vz-label" fill="#b91c1c"');
    b += `<polyline points="${pts.map((p, i) => `${X(i)},${Y(p)}`).join(' ')}" fill="none" stroke="${TEAL}" stroke-width="3" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => { b += `<circle cx="${X(i)}" cy="${Y(p)}" r="3.5" fill="${v.line && p > v.line.y ? RED : TEAL}"/>`; });
    b += t((x0 + x1) / 2, H - 6, v.x_label || 'time →', 'class="vz-label" text-anchor="middle"');
    if (v.y_label) b += t(12, (y0 + y1) / 2, v.y_label, `class="vz-label" text-anchor="middle" transform="rotate(-90 12 ${(y0 + y1) / 2})"`);
    return svg(W, H, b, v.alt || `line graph of ${pts.length} readings`);
  }


  // ---------------------------------------------------------------- board (Keyestudio KS0360 shield / KS4033 motor board)
  const KIND = { servo: ['#795548', '#e53935', '#fb8c00', '🦾'], sensor: ['#263238', '#e53935', '#fdd835', '👁️'],
    ultrasonic: ['#263238', '#e53935', '#1e88e5', '📡'], output: ['#263238', '#e53935', '#43a047', '💡'] };
  function board(v) {
    return v.board === 'motor' ? motorBoard(v) : shieldBoard(v);
  }
  function shieldBoard(v) {
    const W = 520, H = 330, X0 = 40, Y0 = 70, BW = 360, BH = 190;
    const rows = { V1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], V2: [11, 12, 13, 14, 15, 16, 19, 20] };
    const DISPLAY = [3, 4, 6, 7, 10];
    const plugs = v.plugs || [];
    const used = Object.fromEntries(plugs.map((p) => [p.pin, p]));
    let b = `<rect x="${X0}" y="${Y0}" width="${BW}" height="${BH}" rx="10" fill="#1b1b1b"/>`;
    b += `<rect x="${X0 + BW - 18}" y="${Y0 + 20}" width="34" height="${BH - 40}" rx="4" fill="#3b4366"/>` + t(X0 + BW + 26, Y0 + BH / 2, 'micro:bit', `class="vz-label" transform="rotate(90 ${X0 + BW + 26} ${Y0 + BH / 2})" text-anchor="middle"`);
    b += t(X0 + 14, Y0 + 22, 'Keyestudio sensor shield', 'class="vz-chip"');
    const header = (pin, x, y, row) => {
      const p = used[pin], dim = DISPLAY.includes(pin) && !p;
      let o = `<rect x="${x - 11}" y="${y}" width="22" height="46" rx="3" fill="${p ? '#fff3c4' : '#2a2a2a'}" stroke="${p ? '#ffd23f' : '#444'}" stroke-width="${p ? 3 : 1}" opacity="${dim ? 0.45 : 1}"/>`;
      ['G', 'V', 'S'].forEach((n, k) => { o += `<rect x="${x - 4}" y="${y + 5 + k * 13}" width="8" height="8" fill="${['#111', '#e53935', '#fdd835'][k]}" opacity="${dim ? 0.4 : 0.9}"/>`; });
      o += t(x, y + (row === 'V1' ? -6 : 60), pin, `class="vz-label" text-anchor="middle" fill="${p ? '#b77900' : '#ccc'}"`);
      return o;
    };
    rows.V1.forEach((pin, i) => { b += header(pin, X0 + 30 + i * 30, Y0 + 40, 'V1'); });
    rows.V2.forEach((pin, i) => { b += header(pin, X0 + 30 + i * 30, Y0 + 120, 'V2'); });
    b += t(X0 + 14, Y0 + 104, 'G V S', 'class="vz-tiny" fill="#aaa"');
    // jumpers
    const J = v.jumpers || {};
    [['V1', X0 + BW - 150], ['V2', X0 + BW - 92]].forEach(([n, x]) => {
      if (!J[n]) return;
      const five = /5/.test(J[n]);
      b += `<rect x="${x}" y="${Y0 + 93}" width="52" height="20" rx="4" fill="${five ? '#e53935' : '#1e88e5'}"/>` + t(x + 26, Y0 + 107, `${n}: ${J[n]}`, 'class="vz-tiny" fill="#fff" text-anchor="middle"');
    });
    // power
    if (v.power) {
      b += `<rect x="${X0 - 30}" y="${Y0 + BH - 50}" width="34" height="26" rx="4" fill="#111" stroke="#666"/>` + t(X0 - 13, Y0 + BH - 32, 'DC', 'class="vz-tiny" fill="#ccc" text-anchor="middle"');
      b += t(X0 - 30, Y0 + BH + 22, '🔋 ' + v.power, 'class="vz-label"');
    }
    // devices plugged in
    plugs.forEach((p, i) => {
      const row = rows.V1.includes(p.pin) ? 'V1' : 'V2';
      const idx = rows[row].indexOf(p.pin);
      const hx = X0 + 30 + idx * 30, hy = row === 'V1' ? Y0 + 40 : Y0 + 166;
      const dx = 20 + i * (W - 40) / Math.max(plugs.length, 1) + ((W - 40) / Math.max(plugs.length, 1)) / 2;
      const dy = row === 'V1' ? 20 : H - 26;
      const [c1, c2, c3, icon] = KIND[p.kind] || KIND.sensor;
      [c1, c2, c3].forEach((c, k) => {
        b += `<path d="M${hx - 4 + k * 4} ${hy + (row === 'V1' ? 0 : 0)} C${hx - 4 + k * 4} ${(hy + dy) / 2} ${dx - 4 + k * 4} ${(hy + dy) / 2} ${dx - 4 + k * 4} ${dy + (row === 'V1' ? 12 : -12)}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
      });
      b += `<rect x="${dx - 58}" y="${dy - 12}" width="116" height="24" rx="12" fill="#fff" stroke="${TEAL}" stroke-width="2"/>`;
      const label = `${icon} ${p.device} · P${p.pin}`;
      b += t(dx, dy + 5, label, `class="vz-label" text-anchor="middle"${label.length > 17 ? ' textLength="106" lengthAdjust="spacingAndGlyphs"' : ''}`);
    });
    return svg(W, H, b, v.alt || `sensor shield with ${plugs.map((p) => `${p.device} on pin ${p.pin}`).join(', ')}`);
  }
  function motorBoard(v) {
    const W = 520, H = 300, X0 = 150, Y0 = 56, BW = 230, BH = 170;
    let b = `<rect x="${X0}" y="${Y0}" width="${BW}" height="${BH}" rx="10" fill="#1b1b1b"/>`;
    b += `<rect x="${X0 - 16}" y="${Y0 + 20}" width="34" height="${BH - 40}" rx="4" fill="#3b4366"/>` + t(X0 - 26, Y0 + BH / 2, 'micro:bit', `class="vz-label" transform="rotate(-90 ${X0 - 26} ${Y0 + BH / 2})" text-anchor="middle"`);
    b += t(X0 + 30, Y0 + 24, 'Keyestudio motor board', 'class="vz-chip"');
    const terms = ['G', 'VM', 'A1', 'A2', 'B1', 'B2'];
    const tx = X0 + BW, ty = (i) => Y0 + 40 + i * 22;
    b += `<rect x="${tx - 6}" y="${Y0 + 30}" width="30" height="${terms.length * 22 + 4}" rx="3" fill="#1e88e5"/>`;
    terms.forEach((n, i) => { b += `<circle cx="${tx + 9}" cy="${ty(i) + 2}" r="5" fill="#cfd8dc"/>` + t(tx - 12, ty(i) + 6, n, 'class="vz-tiny" fill="#fff" text-anchor="end"'); });
    const motors = v.motors || [];
    motors.forEach((m) => {
      const a = m.port === 'B' ? 4 : 2, my = m.port === 'B' ? 190 : 40;
      b += `<rect x="440" y="${my}" width="70" height="46" rx="18" fill="#ffd54f" stroke="#c99a00"/>` + t(475, my + 28, m.device || ('motor ' + m.port), `class="vz-label" text-anchor="middle"${(m.device || '').length > 9 ? ' textLength="62" lengthAdjust="spacingAndGlyphs"' : ''}`);
      b += `<path d="M${tx + 9} ${ty(a) + 2} C420 ${ty(a)} 420 ${my + 14} 440 ${my + 14}" stroke="#e53935" stroke-width="3" fill="none"/>`;
      b += `<path d="M${tx + 9} ${ty(a + 1) + 2} C425 ${ty(a + 1)} 425 ${my + 32} 440 ${my + 32}" stroke="#263238" stroke-width="3" fill="none"/>`;
    });
    if (v.power) {
      const bx = X0 + 40, by = H - 40;
      b += `<rect x="${bx}" y="${by}" width="120" height="30" rx="5" fill="#424242"/>` + t(bx + 60, by + 20, '🔋 ' + v.power, 'class="vz-label" fill="#fff" text-anchor="middle"');
      b += `<path d="M${tx + 9} ${ty(1) + 2} C${tx + 60} ${ty(1)} ${tx + 40} ${by + 8} ${bx + 120} ${by + 8}" stroke="#e53935" stroke-width="3" fill="none"/>`;
      b += `<path d="M${tx + 9} ${ty(0) + 2} C${tx + 50} ${ty(0)} ${tx + 30} ${by + 22} ${bx + 120} ${by + 22}" stroke="#263238" stroke-width="3" fill="none"/>`;
    }
    b += t(10, 26, 'Motor A = P12 + P13', 'class="vz-label"') + t(10, 44, 'Motor B = P15 + P16', 'class="vz-label"');
    return svg(W, H, b, v.alt || 'motor driver board with motors and battery');
  }

  // ---------------------------------------------------------------- try (interactive: tap or slide)
  // Builds its own controls, so it returns null. Kinds: pin, pwm, button, sensor, loop, servo.
  function bulb(level, label) {
    const glow = Math.max(0, Math.min(1, level));
    let b = `<defs><radialGradient id="bulbglow"><stop offset="0" stop-color="${RED}" stop-opacity="${0.75 * glow}"/><stop offset="1" stop-color="${RED}" stop-opacity="0"/></radialGradient></defs>`;
    b += `<circle cx="80" cy="62" r="56" fill="url(#bulbglow)"/>`;
    b += `<path d="M58 70 v-22 a22 22 0 0 1 44 0 v22 z" fill="${glow > 0.02 ? RED : '#e7c9c9'}" opacity="${0.35 + 0.65 * glow}" stroke="#b91c1c" stroke-width="2"/>`;
    b += `<rect x="54" y="70" width="52" height="7" rx="2" fill="#b91c1c" opacity=".7"/>`;
    b += `<line x1="70" y1="77" x2="70" y2="110" stroke="${MUTED}" stroke-width="3"/><line x1="90" y1="77" x2="90" y2="100" stroke="${MUTED}" stroke-width="3"/>`;
    return svg(160, 118, b, label || 'an LED');
  }
  function fan(level) {   // a motor with a spinning fan blade; faster spin = more power
    const secs = level > 0.02 ? (0.25 / level).toFixed(2) : 0;
    let b = `<rect x="40" y="58" width="80" height="44" rx="10" fill="#9aa3b8" stroke="${INK}" stroke-width="2"/>` + t(80, 86, 'MOTOR', 'class="vz-tiny" text-anchor="middle" fill="#fff"');
    b += `<line x1="120" y1="80" x2="138" y2="80" stroke="${INK}" stroke-width="4"/>`;
    b += `<g transform="translate(138 80)"><g>${secs ? `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${secs}s" repeatCount="indefinite"/>` : ''}` +
      `<ellipse cx="0" cy="-26" rx="7" ry="24" fill="${TEAL}"/><ellipse cx="0" cy="26" rx="7" ry="24" fill="${TEAL}"/></g><circle r="5" fill="${INK}"/></g>`;
    return svg(180, 160, b, level > 0.02 ? `motor spinning at ${Math.round(100 * level)}% power` : 'motor stopped');
  }
  function tryIt(v, box) {
    const k = v.kind;
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    const art = el('div', 'try-art'), controls = el('div', 'try-controls'), code = el('div', 'try-code'), out = el('div', 'try-out');
    box.append(art, controls, code, out);
    const btn = (label, on) => { const b = el('button', on ? 'on' : ''); b.type = 'button'; b.textContent = label; controls.appendChild(b); return b; };
    const slider = (min, max, val, label) => {
      const r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.value = val; r.setAttribute('aria-label', label);
      controls.appendChild(r); return r;
    };
    const fill = (tpl, value) => String(tpl).replace('{value}', value);
    if (k === 'pin') {
      const pin = v.pin ?? 0;
      const on = btn(v.on_label || `pin${pin}.write_digital(1)`), off = btn(v.off_label || `pin${pin}.write_digital(0)`, true);
      const set = (high) => {
        on.classList.toggle('on', high); off.classList.toggle('on', !high);
        art.innerHTML = bulb(high ? 1 : 0, high ? 'LED on' : 'LED off');
        code.textContent = high ? on.textContent : off.textContent;
        out.textContent = high ? `Pin ${pin} is ON (3 volts): the LED lights.` : `Pin ${pin} is OFF (0 volts): the LED is dark.`;
      };
      on.addEventListener('click', () => set(true)); off.addEventListener('click', () => set(false));
      set(false);
    } else if (k === 'pwm' || k === 'servo') {
      const servo = k === 'servo', max = servo ? 180 : (v.max || 1023);
      const r = slider(0, max, v.start ?? (servo ? 90 : 512), servo ? 'angle' : 'brightness');
      const set = () => {
        const n = +r.value;
        if (servo) {
          art.innerHTML = dial({ marks: [{ angle: 0 }, { angle: 90 }, { angle: 180 }, { angle: n, pointer: true, label: '' }] });
          code.textContent = fill(v.code || 'set_angle({value})', v.map ? Math.round(v.map[0] + (v.map[1] - v.map[0]) * n / 180) : n);
          out.textContent = `The servo arm turns to ${n}°.`;
        } else {
          const pct = Math.round(100 * n / max);
          art.innerHTML = v.show === 'motor' ? fan(n / max) : bulb(n / max, `LED at ${pct}% brightness`);
          code.textContent = fill(v.code || 'pin0.write_analog({value})', n);
          out.textContent = `${n} out of ${max}: on about ${pct}% of the time` + (v.show === 'motor' ? `, so the motor runs at about ${pct}% speed.` : '.');
        }
      };
      r.addEventListener('input', set);
      set();
    } else if (k === 'button') {
      const label = v.button || 'A', b = btn(`Hold button ${label}`);
      const set = (down) => {
        b.classList.toggle('on', down);
        art.innerHTML = leds({ image: down ? (v.pressed || 'HAPPY') : (v.released || 'OFF') });
        code.textContent = `button_${label.toLowerCase()}.is_pressed()  →  ${down ? 'True' : 'False'}`;
        out.textContent = down ? (v.then || 'True: the if block runs.') : (v.else || 'False: the if block is skipped.');
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
      ['pointerup', 'pointerleave', 'blur'].forEach((ev) => b.addEventListener(ev, () => set(false)));
      b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(true); } });
      b.addEventListener('keyup', () => set(false));
      set(false);
    } else if (k === 'sensor') {
      const op = v.op || '<', r = slider(v.min, v.max, v.start ?? Math.round((v.min + v.max) / 2), v.label || 'reading');
      const set = () => {
        const n = +r.value, T = v.threshold;
        const yes = op === '<' ? n < T : op === '<=' ? n <= T : op === '>=' ? n >= T : n > T;
        const low = op[0] === '<';
        art.innerHTML = scale({ min: v.min, max: v.max, label: v.label || '',
          zones: [{ from: low ? v.min : T, to: low ? T : v.max, label: `if ${op} ${T}: True`, color: '#dff4e4' }],
          marks: [{ at: T, label: `${T}` }, { at: n, label: `${n}${v.unit || ''}`, pointer: true }] });
        code.textContent = `reading = ${v.read}   # ${n}\nif reading ${op} ${v.threshold}:   # ${yes ? 'True' : 'False'}`;
        out.textContent = yes ? v.then : v.else;
      };
      r.addEventListener('input', set);
      set();
    } else if (k === 'loop') {
      const steps = v.steps || ['P0', 'resistor', 'LED', 'GND'];
      const close = btn('Close the gap', true), open = btn('Make a gap');
      const set = (closed) => {
        close.classList.toggle('on', closed); open.classList.toggle('on', !closed);
        art.innerHTML = flow({ loop: true, loop_label: closed ? 'back to the start' : 'GAP: no path back', steps: steps.map((label, i) => ({ label: !closed && i === steps.length - 1 ? `✂ ${label}` : label })) }) + bulb(closed ? 1 : 0, closed ? 'LED on' : 'LED off');
        code.hidden = true;
        out.textContent = closed ? 'Electricity can flow all the way around: the LED lights.' : 'One gap anywhere stops the flow: no light.';
      };
      close.addEventListener('click', () => set(true)); open.addEventListener('click', () => set(false));
      set(true);
    }
    if (v.hint !== false) box.appendChild(el('div', 'try-hint', k === 'button' ? 'Press and hold the button.' : k === 'pin' || k === 'loop' ? 'Tap the buttons.' : 'Drag the slider.'));
    return null;
  }

  const R = { leds, part, circuit, flow, wave, scale, compare, bits, dial, graph, board, try: tryIt };

  function render(el, v) {
    const fn = R[v.type];
    if (!fn) return;
    const box = document.createElement('div');
    box.className = 'vz-art vz-' + v.type;
    el.appendChild(box);
    const html = fn(v, box);
    if (html !== null && html !== undefined) box.innerHTML = html;
    if (v.caption) {
      const c = document.createElement('div');
      c.className = 'vz-caption';
      c.textContent = v.caption;
      el.appendChild(c);
    }
  }

  function renderAll(root) {
    (root || document).querySelectorAll('[data-visual]').forEach((el) => {
      if (el.dataset.rendered) return;
      el.dataset.rendered = '1';
      try { render(el, JSON.parse(el.dataset.visual)); } catch (e) { console.warn('visual failed', e); }
    });
  }

  window.Visuals = { render, renderAll, IMAGES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => renderAll());
  else renderAll();
})();
