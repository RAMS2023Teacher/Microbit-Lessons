/* Circuit diagrams (schematics) for the wiring pictures: the third "My kit" view in a step's 🔌 Wire it box.
 * Drawn from the same parts list as the breadboard picture (see lib/breadboard.js and docs/LESSONS.md), so the two
 * can't disagree. It works out what is joined to what (rows of the breadboard, rails, wires), then draws:
 *   - the micro:bit on the left, with only the pins this circuit uses
 *   - parts with two legs (resistor, LED, button...) in a line from their pin, looping back to GND along the bottom
 *   - parts with named pins (sensor, servo, battery...) as boxes on the right, each pin wired to what it joins
 *   Schematic.render(container, { steps: [{ add: [...] }] })   parts added in the last step are drawn in teal */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', INK = '#1d2a5c', NEW = '#0f9f9f';
  const TWO = { led: ['anode', 'cathode'], resistor: ['a', 'b'], button: ['a', 'b'], ldr: ['a', 'b'], diode: ['anode', 'cathode'], capacitor: ['a', 'b'], buzzer: ['plus', 'minus'] };
  const BOXED = { potentiometer: ['left', 'wiper', 'right'], transistor: ['collector', 'base', 'emitter'], hcsr04: ['vcc', 'trig', 'echo', 'gnd'],
                  servo: ['sig', 'vcc', 'gnd'], dcmotor: ['a', 'b'], battery: ['plus', 'minus'] };
  const ON_BOARD = { potentiometer: 1, transistor: 1, hcsr04: 1 };
  const NICE = { vcc: 'VCC', trig: 'Trig', echo: 'Echo', gnd: 'GND', sig: 'signal', plus: '+', minus: '–' };
  const SERVO = { sig: 'signal', vcc: '+ power', gnd: '– ground' };
  const TITLE = { hcsr04: 'Distance sensor', servo: 'Servo', battery: 'Battery pack', dcmotor: 'Motor', potentiometer: 'Dial', transistor: 'Transistor' };
  const LEDC = { red: '#ff3b30', green: '#34c759', yellow: '#ffd60a', blue: '#0a84ff', white: '#f5f5f5', orange: '#ff9f0a' };

  function el(name, attrs, parent) { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function text(parent, x, y, str, attrs) { const t = el('text', Object.assign({ x, y, 'font-family': 'system-ui, sans-serif', 'font-size': 13, fill: INK }, attrs || {}), parent); t.textContent = str; return t; }
  // which strip of metal a breadboard hole is on; anything else (mb.P0, servo1.sig) is its own point
  function node(addr) {
    addr = String(addr || '');
    let m = /^([a-j])(\d{1,2})$/.exec(addr);
    if (m) return (m[1] <= 'e' ? 'top' : 'bot') + m[2];
    m = /^(T\+|T-|B\+|B-)\d{1,2}$/.exec(addr);
    return m ? 'rail' + m[1] : addr;
  }

  function render(container, circuit) {
    const steps = circuit.steps || [], up = {};
    const find = (x) => { if (up[x] == null) up[x] = x; while (up[x] !== x) { up[x] = up[up[x]]; x = up[x]; } return x; };
    const join = (a, b) => { up[find(a)] = find(b); };
    const parts = [];
    steps.forEach((st, si) => (st.add || []).forEach((p) => {
      if (p.type === 'wire') join(node(p.from), node(p.to));
      else parts.push({ p, isNew: steps.length > 1 && si === steps.length - 1 });
    }));
    const termNet = (p, t) => find(TWO[p.type] || ON_BOARD[p.type] ? node(p[t]) : p.id + '.' + t);
    const two = parts.filter((x) => TWO[x.p.type]), boxes = parts.filter((x) => !TWO[x.p.type]);
    boxes.forEach((b) => { b.terms = b.p.type === 'module' ? (b.p.terminals || []) : (BOXED[b.p.type] || []); });
    // the micro:bit pins this circuit touches
    const touched = new Set();
    two.forEach((x) => TWO[x.p.type].forEach((t) => touched.add(termNet(x.p, t))));
    boxes.forEach((b) => b.terms.forEach((t) => touched.add(termNet(b.p, t))));
    const ALL = ['P0', 'P1', 'P2', 'P8', 'P12', 'P13', 'P14', 'P15', 'P16', 'P19', 'P20', '3V', 'GND'];
    const pins = ALL.filter((pin) => up['mb.' + pin] != null && touched.has(find('mb.' + pin)));
    const pinOfNet = {};
    pins.forEach((pin) => { const n = find('mb.' + pin); if (!pinOfNet[n]) pinOfNet[n] = pin; });

    // parts with two legs, in a line from each pin until the line reaches another pin (usually GND)
    const chains = [];
    pins.filter((x) => x !== 'GND').forEach((pin) => {
      let cur = find('mb.' + pin);
      const items = [];
      for (;;) {
        const nx = two.find((x) => !x.used && TWO[x.p.type].some((t) => termNet(x.p, t) === cur));
        if (!nx) break;
        nx.used = true;
        const [t0, t1] = TWO[nx.p.type], forward = termNet(nx.p, t0) === cur;
        items.push({ part: nx, forward });
        cur = termNet(nx.p, forward ? t1 : t0);
        if (pinOfNet[cur]) break;
      }
      if (items.length) chains.push({ pin, items, end: cur });
    });

    // ---- where everything goes
    const X0 = 150, GAP = chains.length ? 78 : 58, STEP = 104, TS = 38, pinY = {};
    // Boxes only (a sensor, servos...): put each micro:bit pin level with the first box pin it joins, so most wires
    // run straight across instead of crossing.
    const level = boxes.length && !chains.length;
    if (level) {
      let yy = 36;
      const firstY = {};
      boxes.forEach((b) => { b.terms.forEach((t, i) => { const pin = pinOfNet[termNet(b.p, t)]; if (pin && firstY[pin] == null) firstY[pin] = yy + 48 + i * TS; }); yy += 40 + b.terms.length * TS + 22; });
      pins.sort((a, b) => (firstY[a] ?? 1e9) - (firstY[b] ?? 1e9));
      let prev = -1e9;
      pins.forEach((pin) => { pinY[pin] = Math.max(firstY[pin] ?? prev + GAP, prev + 32); prev = pinY[pin]; });
    } else pins.forEach((pin, i) => { pinY[pin] = 78 + i * GAP; });
    chains.forEach((c) => { c.y = pinY[c.pin]; c.endX = X0 + STEP * c.items.length + 16; });
    const points = {};                                       // net -> the places that must be joined
    const add = (net, pt) => { (points[net] = points[net] || []).push(pt); };
    chains.forEach((c) => add(c.end, { x: c.endX, y: c.y, side: 'left' }));
    const baseX = Math.max(X0 + 40, ...chains.map((c) => c.endX)) + 26;
    const netsWithBoxes = [];
    boxes.forEach((b) => b.terms.forEach((t) => { const n = termNet(b.p, t); if (!netsWithBoxes.includes(n)) netsWithBoxes.push(n); }));
    const chanNets = Object.keys(points).concat(netsWithBoxes.filter((n) => !points[n]));
    // GND goes in the channel furthest right so its return line wraps around the others
    chanNets.sort((a, b) => (pinOfNet[a] === 'GND') - (pinOfNet[b] === 'GND'));
    const chan = {};
    chanNets.forEach((n, i) => { chan[n] = baseX + i * 22; });
    const modX = baseX + chanNets.length * 22 + 36;
    let by = 36;
    boxes.forEach((b) => {
      b.x = modX; b.y = by; b.h = 40 + b.terms.length * TS;
      b.terms.forEach((t, i) => add(termNet(b.p, t), { x: modX, y: b.y + 48 + i * TS, side: 'right' }));
      by += b.h + 22;
    });
    const lastPinY = pins.length ? pinY[pins[pins.length - 1]] : 78, firstPinY = pins.length ? pinY[pins[0]] : 78;
    const W = (boxes.length ? modX + 190 : baseX + chanNets.length * 22 + 30), H = Math.max(lastPinY + 60, by + 10);

    container.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bb-svg schematic', role: 'img' }, container);
    const wires = el('g', { fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const dots = el('g', { fill: INK }, svg), top = el('g', {}, svg);
    const line = (pts, color) => el('polyline', { points: pts.map((q) => q.join(',')).join(' '), stroke: color || INK }, wires);
    const dot = (x, y) => el('circle', { cx: x, cy: y, r: 4 }, dots);

    // the micro:bit
    if (pins.length) {
      const topY = Math.max(6, firstPinY - 46);
      el('rect', { x: 18, y: topY, width: 112, height: lastPinY - topY + 32, rx: 12, fill: '#1b2550' }, top);
      text(top, 74, topY + 22, 'micro:bit', { 'text-anchor': 'middle', fill: '#cfd8dc', 'font-weight': 800, 'font-size': 14 });
      pins.forEach((pin) => {
        const y = pinY[pin];
        el('rect', { x: 62, y: y - 13, width: 60, height: 26, rx: 6, fill: pin === '3V' ? '#e57373' : pin === 'GND' ? '#78909c' : '#d9b36a' }, top);
        text(top, 92, y + 5, pin, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 });
        line([[130, y], [X0, y]]);
        el('circle', { cx: 130, cy: y, r: 4, fill: '#fff', stroke: INK, 'stroke-width': 2 }, top);
      });
    }

    // lines of two-leg parts
    chains.forEach((c) => {
      let x = X0;
      c.items.forEach((it, i) => {
        const cx = X0 + STEP * i + STEP / 2 + 4, col = it.part.isNew ? NEW : INK;
        line([[x, c.y], [cx - 28, c.y]]);
        symbol(top, it.part.p, cx, c.y, it.forward, col);
        x = cx + 28;
      });
      line([[x, c.y], [c.endX, c.y]]);
    });

    // join up each net: everything runs sideways to that net's own up-and-down line
    Object.keys(points).forEach((n) => {
      const pts = points[n].slice(), pin = pinOfNet[n], startsChain = pin && chains.some((c) => c.pin === pin);
      if (pin && !startsChain) pts.push({ x: X0, y: pinY[pin], side: 'left' });
      if (pts.length < 2) return;
      const cx = chan[n], ys = pts.map((q) => q.y), lo = Math.min(...ys), hi = Math.max(...ys);
      if (hi - lo < 1) { line([[Math.min(...pts.map((q) => q.x)), lo], [Math.max(...pts.map((q) => q.x)), lo]]); return; }
      line([[cx, lo], [cx, hi]]);
      pts.forEach((q) => {
        line([[q.x, q.y], [cx, q.y]]);
        const sameLevel = pts.filter((o) => Math.abs(o.y - q.y) < 1).length;         // a dot wherever three or more lines meet
        if ((q.y > lo && q.y < hi) || sameLevel > 1) dot(cx, q.y);
      });
    });

    // boxes for parts with named pins
    boxes.forEach((b) => {
      const p = b.p, col = b.isNew ? NEW : INK;
      el('rect', { x: b.x, y: b.y, width: 170, height: b.h, rx: 10, fill: '#fff', stroke: col, 'stroke-width': 2.5 }, top);
      text(top, b.x + 85, b.y + 22, p.label || TITLE[p.type] || p.type, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 });
      b.terms.forEach((t, i) => {
        const y = b.y + 48 + i * TS;
        el('circle', { cx: b.x, cy: y, r: 4.5, fill: '#fff', stroke: col, 'stroke-width': 2 }, top);
        text(top, b.x + 12, y + 5, (p.type === 'servo' ? SERVO[t] : NICE[t]) || t, { 'font-size': 13 });
      });
    });
    return svg;
  }

  // the drawing for one two-leg part, centred on (cx, y), legs reaching 28 to each side
  function symbol(g, p, cx, y, forward, col) {
    const s = el('g', { fill: 'none', stroke: col, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    const label = (str) => text(g, cx, y - 22, str, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 });
    if (p.type === 'resistor') {
      el('path', { d: `M${cx - 28},${y} l4,-8 l8,16 l8,-16 l8,16 l8,-16 l8,16 l8,-16 l4,8` }, s);
      label((p.ohms ? p.ohms + ' Ω ' : '') + 'resistor');
    } else if (p.type === 'led' || p.type === 'diode') {
      const d = forward ? 1 : -1;                                   // the triangle points the way the current goes: + to –
      el('path', { d: `M${cx - 28},${y} H${cx - 12} M${cx + 12},${y} H${cx + 28}` }, s);
      el('path', { d: `M${cx - 12 * d},${y - 12} V${y + 12} L${cx + 12 * d},${y} Z`, fill: p.type === 'led' ? (LEDC[p.color] || LEDC.red) : '#fff' }, s);
      el('path', { d: `M${cx + 12 * d},${y - 12} V${y + 12}` }, s);
      if (p.type === 'led') el('path', { d: `M${cx + 2},${y - 16} l8,-9 m-5,0 h5 v5 M${cx + 12},${y - 14} l8,-9 m-5,0 h5 v5`, 'stroke-width': 1.6 }, s);
      text(g, cx - 22 * d, y + 20, '+', { 'text-anchor': 'middle', 'font-weight': 800 });
      text(g, cx + 22 * d, y + 20, '–', { 'text-anchor': 'middle', 'font-weight': 800 });
      text(g, cx - 4, y - 30, p.type === 'led' ? (p.color || 'red') + ' LED' : 'diode', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 });
    } else if (p.type === 'button') {
      el('path', { d: `M${cx - 28},${y} H${cx - 14} M${cx + 14},${y} H${cx + 28} M${cx - 16},${y - 11} H${cx + 16} M${cx},${y - 11} V${y - 19}` }, s);
      [cx - 14, cx + 14].forEach((x) => el('circle', { cx: x, cy: y, r: 3.5, fill: '#fff' }, s));
      text(g, cx, y - 26, 'button', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 });
    } else {
      el('rect', { x: cx - 28, y: y - 12, width: 56, height: 24, rx: 4, fill: '#fff' }, s);
      label({ ldr: 'light sensor', capacitor: 'capacitor', buzzer: 'buzzer' }[p.type] || p.type);
    }
  }

  window.Schematic = { render };
})();
