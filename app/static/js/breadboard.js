/* Draws lesson circuits on a virtual breadboard (SVG).
 * Address scheme matches app/circuits.py — see docs/LESSON_FORMAT.md. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const P = 16;                 // hole pitch
  const BX = 175;               // breadboard left
  const BW = 40 + 29 * P;       // breadboard width
  const COLX = (c) => BX + 20 + (c - 1) * P;
  const ROWY = { a: 82, b: 98, c: 114, d: 130, e: 146, f: 186, g: 202, h: 218, i: 234, j: 250 };
  const RAILY = { 'T+': 30, 'T-': 46, 'B+': 286, 'B-': 302 };
  const MB_PINS = ['3V', 'GND', 'P0', 'P1', 'P2', 'P8', 'P12', 'P13', 'P14', 'P15', 'P16', 'P19', 'P20'];
  const MBY = (i) => 38 + i * 22;
  const OFF_X = BX + BW + 50;
  const BOARD_TERMS = {
    led: ['anode', 'cathode'], resistor: ['a', 'b'], button: ['a', 'b'], ldr: ['a', 'b'],
    diode: ['anode', 'cathode'], capacitor: ['a', 'b'], buzzer: ['plus', 'minus'],
    potentiometer: ['left', 'wiper', 'right'], transistor: ['collector', 'base', 'emitter'],
  };
  const OFF_TERMS = { servo: ['sig', 'vcc', 'gnd'], dcmotor: ['a', 'b'], battery: ['plus', 'minus'] };
  const WIRE = { red: '#e53935', black: '#263238', blue: '#1e88e5', green: '#43a047', yellow: '#fdd835',
    orange: '#fb8c00', white: '#eceff1', purple: '#8e24aa', brown: '#795548', gray: '#90a4ae' };
  const LEDC = { red: '#ff3b30', green: '#34c759', yellow: '#ffd60a', blue: '#0a84ff', white: '#f5f5f5', orange: '#ff9f0a' };

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    const t = el('text', Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }

  function holeXY(addr) {
    let m = /^([a-j])(\d{1,2})$/.exec(addr);
    if (m) return [COLX(+m[2]), ROWY[m[1]]];
    m = /^(T\+|T-|B\+|B-)(\d{1,2})$/.exec(addr);
    if (m) return [COLX(+m[2]), RAILY[m[1]]];
    return null;
  }

  function layoutOffboard(steps) {
    const boxes = {};
    let y = 20;
    steps.forEach((s) => (s.add || []).forEach((p) => {
      if (p.type in OFF_TERMS || p.type === 'module') {
        const terms = p.type === 'module' ? (p.terminals || []) : OFF_TERMS[p.type];
        const h = Math.max(56, 26 + terms.length * 20);
        boxes[p.id] = { part: p, x: OFF_X, y, h, terms };
        y += h + 18;
      }
    }));
    return { boxes, height: y };
  }

  function render(container, circuit, stepIndex) {
    const steps = circuit.steps || [];
    const { boxes, height } = layoutOffboard(steps);
    const W = Object.keys(boxes).length ? OFF_X + 190 : BX + BW + 20;
    const H = Math.max(330, height + 10);
    container.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bb-svg', role: 'img' }, container);
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '3', result: 'b' }, f);
    const fm = el('feMerge', {}, f);
    el('feMergeNode', { in: 'b' }, fm);
    el('feMergeNode', { in: 'SourceGraphic' }, fm);

    // micro:bit breakout
    const mb = el('g', { class: 'bb-mb' }, svg);
    el('rect', { x: 8, y: 14, width: 130, height: MBY(MB_PINS.length - 1) + 22, rx: 8, class: 'mb-board' }, mb);
    text(mb, 20, 30, 'micro:bit breakout', { class: 'mb-title' });
    const pinXY = {};
    MB_PINS.forEach((pin, i) => {
      const y = MBY(i) + 10;
      pinXY['mb.' + pin] = [128, y];
      el('rect', { x: 20, y: y - 7, width: 86, height: 14, rx: 3, class: 'mb-pin' + (pin === '3V' ? ' pwr' : pin === 'GND' ? ' gnd' : '') }, mb);
      text(mb, 26, y + 4, pin, { class: 'mb-pin-label' });
      el('circle', { cx: 128, cy: y, r: 4, class: 'term' }, mb);
    });

    // breadboard
    const bb = el('g', { class: 'bb-board' }, svg);
    el('rect', { x: BX, y: 10, width: BW, height: 310, rx: 8, class: 'board' }, bb);
    el('rect', { x: BX, y: 160, width: BW, height: 12, class: 'ravine' }, bb);
    [['T+', '#e53935'], ['T-', '#1e88e5'], ['B+', '#e53935'], ['B-', '#1e88e5']].forEach(([r, col]) => {
      const y = RAILY[r] + (r.endsWith('+') ? -9 : 9);
      el('line', { x1: BX + 12, y1: y, x2: BX + BW - 12, y2: y, stroke: col, 'stroke-width': 2 }, bb);
      text(bb, BX + 4, RAILY[r] + 4, r[1], { class: 'rail-label', fill: col });
    });
    for (let c = 1; c <= 30; c++) {
      if (c === 1 || c % 5 === 0) {
        text(bb, COLX(c), 70, String(c), { class: 'col-label', 'text-anchor': 'middle' });
        text(bb, COLX(c), 270, String(c), { class: 'col-label', 'text-anchor': 'middle' });
      }
      for (const r in ROWY) el('rect', { x: COLX(c) - 3, y: ROWY[r] - 3, width: 6, height: 6, rx: 1, class: 'hole' }, bb);
      for (const r in RAILY) el('rect', { x: COLX(c) - 3, y: RAILY[r] - 3, width: 6, height: 6, rx: 1, class: 'hole' }, bb);
    }
    for (const r in ROWY) {
      text(bb, BX + 8, ROWY[r] + 4, r, { class: 'row-label' });
      text(bb, BX + BW - 12, ROWY[r] + 4, r, { class: 'row-label' });
    }

    // off-board boxes
    const termXY = {};
    const offLayer = el('g', {}, svg);
    const partLayer = el('g', {}, svg);
    const wireLayer = el('g', {}, svg);
    const shown = steps.slice(0, stepIndex + 1);
    svg.classList.toggle('has-old', stepIndex > 0);
    const placed = new Set();
    shown.forEach((s) => (s.add || []).forEach((p) => { if (p.id) placed.add(p.id); }));
    for (const id in boxes) {
      const b = boxes[id];
      b.terms.forEach((t, i) => { termXY[id + '.' + t] = [b.x, b.y + 30 + i * 20]; });
    }

    function pos(addr) {
      return holeXY(addr) || pinXY[addr] || termXY[addr] || boardTermXY[addr] || null;
    }
    const boardTermXY = {};
    steps.forEach((s) => (s.add || []).forEach((p) => {
      (BOARD_TERMS[p.type] || []).forEach((t) => { const xy = holeXY(p[t] || ''); if (xy) boardTermXY[p.id + '.' + t] = xy; });
    }));

    shown.forEach((s, si) => {
      const isNew = si === stepIndex;
      (s.add || []).forEach((p) => {
        const cls = 'part' + (isNew ? ' new' : '');
        if (p.type === 'wire') {
          const a = pos(p.from), b = pos(p.to);
          if (!a || !b) return;
          const g = el('g', { class: cls }, wireLayer);
          el('title', {}, g).textContent = `${p.color || 'red'} wire: ${p.from} → ${p.to}`;
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const dist = Math.hypot(dx, dy);
          const lift = Math.min(60, 12 + dist * 0.18);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - lift;
          let d = `M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`;
          if (a[0] >= OFF_X - 1 && b[0] >= OFF_X - 1) {
            // between two off-board parts: loop out to the left of the boxes
            const k = 22 + Math.abs(dy) * 0.12;
            d = `M${a[0]},${a[1]} C${a[0] - k},${a[1]} ${b[0] - k},${b[1]} ${b[0]},${b[1]}`;
          }
          el('path', { d, class: 'wire-shadow' }, g);
          el('path', { d, class: 'wire', stroke: WIRE[p.color] || WIRE.red }, g);
          el('circle', { cx: a[0], cy: a[1], r: 3.2, class: 'wire-end' }, g);
          el('circle', { cx: b[0], cy: b[1], r: 3.2, class: 'wire-end' }, g);
        } else if (BOARD_TERMS[p.type]) {
          drawBoardPart(partLayer, p, cls);
        } else if (boxes[p.id]) {
          drawBox(offLayer, boxes[p.id], cls);
        }
      });
    });
    return svg;
  }

  function drawBoardPart(layer, p, cls) {
    const terms = BOARD_TERMS[p.type];
    const pts = terms.map((t) => holeXY(p[t] || '')).filter(Boolean);
    if (pts.length !== terms.length) return;
    const g = el('g', { class: cls + ' p-' + p.type }, layer);
    const label = {
      led: `${p.color || 'red'} LED (${p.id}): long leg ${p.anode}, short leg ${p.cathode}`,
      resistor: `${p.ohms || ''}Ω resistor (${p.id}): ${p.a} – ${p.b}`,
      potentiometer: `potentiometer (${p.id}): ${p.left} / wiper ${p.wiper} / ${p.right}`,
      transistor: `${p.label || 'transistor'} (${p.id}): C ${p.collector}, B ${p.base}, E ${p.emitter}`,
    }[p.type] || `${p.type} (${p.id}): ` + terms.map((t) => `${t} ${p[t]}`).join(', ');
    el('title', {}, g).textContent = label;
    const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
    const cy0 = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const horizontal = Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 4;
    const span = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    const lift = (p.type === 'resistor' || p.type === 'diode') && span > 30 ? 0 : 16;
    const bx = horizontal ? cx : cx - lift, by = horizontal ? cy0 - lift : cy0;
    pts.forEach((q) => el('line', { x1: q[0], y1: q[1], x2: bx, y2: by, class: 'leg' }, g));
    pts.forEach((q) => el('circle', { cx: q[0], cy: q[1], r: 2.4, class: 'leg-end' }, g));
    const ang = Math.atan2(pts[pts.length - 1][1] - pts[0][1], pts[pts.length - 1][0] - pts[0][0]) * 180 / Math.PI;
    switch (p.type) {
      case 'led': {
        el('circle', { cx: bx, cy: by, r: 9, fill: LEDC[p.color] || LEDC.red, class: 'led-body' }, g);
        el('circle', { cx: bx - 3, cy: by - 3, r: 2.5, fill: '#fff', opacity: 0.7 }, g);
        text(g, pts[0][0] - 9, pts[0][1] + 15, '+', { class: 'pol' });
        text(g, pts[1][0] + 3, pts[1][1] + 15, '–', { class: 'pol' });
        break;
      }
      case 'resistor': case 'diode': {
        const gg = el('g', { transform: `rotate(${ang} ${bx} ${by})` }, g);
        if (p.type === 'resistor') {
          el('rect', { x: bx - 14, y: by - 5, width: 28, height: 10, rx: 4, class: 'res-body' }, gg);
          ['#c62828', '#c62828', '#6d4c41'].forEach((c, i) => el('rect', { x: bx - 8 + i * 5, y: by - 5, width: 2.5, height: 10, fill: c }, gg));
        } else {
          el('rect', { x: bx - 12, y: by - 5, width: 24, height: 10, rx: 2, fill: '#212121' }, gg);
          el('rect', { x: bx + 6, y: by - 5, width: 3, height: 10, fill: '#e0e0e0' }, gg);
        }
        break;
      }
      case 'ldr':
        el('circle', { cx: bx, cy: by, r: 9, class: 'ldr-body' }, g);
        el('path', { d: `M${bx - 5},${by - 3} q2.5,-4 5,0 t5,0 M${bx - 5},${by + 3} q2.5,-4 5,0 t5,0`, class: 'ldr-squiggle' }, g);
        break;
      case 'button':
        el('rect', { x: bx - 10, y: by - 10, width: 20, height: 20, rx: 3, fill: '#37474f' }, g);
        el('circle', { cx: bx, cy: by, r: 6, fill: '#ef5350' }, g);
        break;
      case 'capacitor':
        el('rect', { x: bx - 7, y: by - 10, width: 14, height: 20, rx: 5, fill: '#1565c0' }, g);
        break;
      case 'buzzer':
        el('circle', { cx: bx, cy: by, r: 11, fill: '#212121' }, g);
        el('circle', { cx: bx, cy: by, r: 2, fill: '#888' }, g);
        text(g, pts[0][0] - 9, pts[0][1] + 15, '+', { class: 'pol' });
        break;
      case 'potentiometer':
        el('rect', { x: bx - 16, y: by - 10, width: 32, height: 20, rx: 4, fill: '#1e88e5' }, g);
        el('circle', { cx: bx, cy: by, r: 6, fill: '#eceff1' }, g);
        el('line', { x1: bx, y1: by, x2: bx, y2: by - 6, stroke: '#455a64', 'stroke-width': 2 }, g);
        break;
      case 'transistor':
        el('path', { d: `M${bx - 11},${by + 7} L${bx - 11},${by - 2} A11,11 0 0 1 ${bx + 11},${by - 2} L${bx + 11},${by + 7} Z`, fill: '#212121' }, g);
        text(g, bx, by + 4, p.label ? p.label.slice(0, 7) : 'NPN', { class: 'part-tiny', 'text-anchor': 'middle' });
        ['C', 'B', 'E'].forEach((L, i) => text(g, pts[i][0], pts[i][1] + 16, L, { class: 'pol', 'text-anchor': 'middle' }));
        break;
    }
  }

  function drawBox(layer, b, cls) {
    const p = b.part;
    const g = el('g', { class: cls + ' offboard' }, layer);
    const title = p.label || { servo: 'Servo motor', dcmotor: 'DC motor', battery: 'Battery pack' }[p.type] || p.type;
    el('title', {}, g).textContent = `${title} (${p.id})`;
    const fill = { servo: '#1565c0', dcmotor: '#ffb300', battery: '#424242', module: '#00796b' }[p.type];
    el('rect', { x: b.x, y: b.y, width: 170, height: b.h, rx: 8, fill, class: 'box' }, g);
    text(g, b.x + 12, b.y + 17, title, { class: 'box-title' });
    b.terms.forEach((t, i) => {
      const y = b.y + 30 + i * 20;
      el('circle', { cx: b.x, cy: y, r: 4.5, class: 'term' }, g);
      const nice = { sig: 'signal', vcc: '+ power', gnd: '– ground', plus: '+', minus: '–', a: 'A', b: 'B' }[t] || t;
      text(g, b.x + 12, y + 4, nice, { class: 'box-term' });
    });
  }

  window.Breadboard = { render };
})();
