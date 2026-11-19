/* Circuit Driver: a timed top-down race around a circuit board, with the student's own robot in a little kart.
 *   CircuitDriver.play(canvas, { avatar, seconds, powerups, controls(fn) }) -> Promise<{ score, laps, leds, electrons, smashed }>
 * ← → steer (the kart drives by itself), Space uses a boost. Stay on the copper trace: the bare board is slow.
 * The parts on the board do what they do in a real circuit:
 *   LEDs light as the current (you) reaches them; light all 8 and cross the start line for a lap
 *   resistors slow the current down, capacitors store charge and give a burst, batteries hold a boost,
 *   short-circuit sparks knock you into a spin.
 * Power-ups: turbo (faster), shield (blocks a spark), magnet (pulls electrons), dash (start with boosts), grip (faster off the trace). */
(function () {
  'use strict';
  const W = 960, H = 540, HALF = 34, NLED = 8;
  const PTS = [[150, 140], [400, 140], [460, 200], [460, 270], [520, 330], [640, 330], [700, 270], [700, 200], [760, 140], [850, 140],
               [890, 180], [890, 440], [850, 480], [620, 480], [560, 420], [430, 420], [370, 480], [150, 480], [110, 440], [110, 180]];
  // the trace as straight pieces, with how far along the lap each one starts
  const SEG = PTS.map((p, i) => {
    const q = PTS[(i + 1) % PTS.length], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    return { x: p[0], y: p[1], dx: dx / len, dy: dy / len, len, at: 0 };
  });
  let LAP = 0;
  SEG.forEach((s) => { s.at = LAP; LAP += s.len; });
  /** The spot `s` pixels along the lap, `off` pixels to the right of the centre line. */
  function at(s, off) {
    s = ((s % LAP) + LAP) % LAP;
    let g = SEG[SEG.length - 1];
    for (let i = 0; i < SEG.length; i++) if (s < SEG[i].at + SEG[i].len) { g = SEG[i]; break; }
    const t = s - g.at, o = off || 0;
    return { x: g.x + g.dx * t - g.dy * o, y: g.y + g.dy * t + g.dx * o, a: Math.atan2(g.dy, g.dx) };
  }
  /** How far a point is from the centre line, and how far along the lap that is. */
  function nearest(x, y) {
    let best = { d: 1e9, s: 0 };
    SEG.forEach((g) => {
      const t = Math.max(0, Math.min(g.len, (x - g.x) * g.dx + (y - g.y) * g.dy)), d = Math.hypot(x - (g.x + g.dx * t), y - (g.y + g.dy * t));
      if (d < best.d) best = { d, s: g.at + t };
    });
    return best;
  }
  const START_S = 60;                                      // the start line, on the top straight

  function play(canvas, opts) {
    return new Promise((resolve) => {
      const g = canvas.getContext('2d');
      canvas.width = W;
      canvas.height = H;
      const pw = Object.assign({ turbo: 0, shield: 0, magnet: 0, dash: 0, grip: 0 }, opts.powerups || {});
      const robot = new Image();
      robot.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.RobotAvatar.svg(opts.avatar || {}, 96, { noBg: true }));
      const total = opts.seconds || 45, vmax = 225 * (1 + 0.1 * pw.turbo), magnet = 26 + 30 * pw.magnet, offMul = 0.42 + 0.12 * pw.grip;
      const p0 = at(START_S - 26, 0);
      const S = { x: p0.x, y: p0.y, a: p0.a, v: 0, t: 0, dist: 0, laps: 0, leds: 0, next: 0, lit: [], electrons: 0, smashed: 0,
                  boosts: pw.dash, shields: pw.shield, boostT: 0, capT: 0, stunT: 0, invT: 0, spin: 0, slow: false, off: false,
                  left: false, right: false, brake: false, pops: [], parts: [], trail: [], shake: 0, phase: 'count', countT: 3.4, flash: 0 };
      // what's on the board
      const LED = [];
      for (let i = 0; i < NLED; i++) LED.push({ s: (START_S + LAP * (i + 0.7) / NLED) % LAP });
      const RES = [[0.115, 1], [0.33, -1], [0.56, 1], [0.86, -1]].map(([f, side]) => ({ s: START_S + LAP * f, side }));     // which half of the trace they block
      const CAP = [0.47, 0.955].map((f) => ({ s: START_S + LAP * f, t: 0 }));
      const SPARK = [0.235, 0.66, 0.79].map((f, i) => ({ s: START_S + LAP * f, ph: i * 2, from: [10, 0, 22][i] }));       // joins the race after `from` seconds
      let dots = [], cells = [];
      function restock() {
        dots = [];
        for (let i = 0; i < 26; i++) {
          const s = START_S + 40 + (LAP - 80) * i / 26, off = Math.sin(i * 1.9 + S.laps) * 18;
          if (!RES.some((r) => Math.abs(((s - r.s) % LAP + LAP) % LAP) < 26 || Math.abs(((r.s - s) % LAP + LAP) % LAP) < 26)) dots.push({ s, off });
        }
        cells = [0.2 + Math.random() * 0.2, 0.6 + Math.random() * 0.25].map((f) => ({ s: START_S + LAP * f, off: (Math.random() - 0.5) * 30 }));
      }
      restock();

      const boost = () => {
        if (S.phase !== 'race') return;
        if (S.boosts > 0 && S.boostT <= 0) { S.boosts -= 1; S.boostT = 1.5; pop('🔋 BOOST!', '#fb923c'); }
        else if (S.boosts <= 0) pop('Grab a 🔋 battery for a boost', '#cbd5e1');
      };
      const key = (down) => (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { S.left = down; e.preventDefault(); }
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') { S.right = down; e.preventDefault(); }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { S.brake = down; e.preventDefault(); }
        else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { if (down && !e.repeat) boost(); e.preventDefault(); }
      };
      const kd = key(true), ku = key(false);
      const pd = (e) => { const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; S.left = x < 0.4; S.right = x > 0.6; if (x >= 0.4 && x <= 0.6) boost(); };
      const pu = () => { S.left = S.right = false; };
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
      canvas.addEventListener('pointerdown', pd); window.addEventListener('pointerup', pu);
      if (opts.controls) opts.controls({ left: (on) => { S.left = on; }, right: (on) => { S.right = on; }, boost });

      function pop(text, color) { S.pops.push({ text, color, t: 1.2, x: Math.max(120, Math.min(W - 120, S.x)), y: Math.max(90, S.y - 40) }); }
      function burst(x, y, color, n) {
        for (let i = 0; i < (n || 10); i++) { const a = Math.random() * 6.283, v = 60 + Math.random() * 180; S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.5, color }); }
      }
      const score = () => S.laps * 300 + S.leds * 40 + S.electrons * 20 + S.smashed * 50 + Math.round(S.dist / 20);

      function update(dt) {
        S.pops.forEach((p) => { p.t -= dt; p.y -= 34 * dt; });
        S.pops = S.pops.filter((p) => p.t > 0);
        S.parts.forEach((p) => { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; });
        S.parts = S.parts.filter((p) => p.t > 0);
        S.shake = Math.max(0, S.shake - dt * 30); S.flash = Math.max(0, S.flash - dt);
        if (S.phase === 'count') { S.countT -= dt; if (S.countT <= 0) S.phase = 'race'; return; }
        if (S.phase !== 'race') return;
        S.t += dt;
        if (S.t >= total) { S.t = total; end(); return; }
        S.boostT -= dt; S.capT -= dt; S.stunT -= dt; S.invT -= dt;
        const n = nearest(S.x, S.y);
        S.off = n.d > HALF + 4;
        // resistors: the half of the trace they sit on is slow
        S.slow = false;
        RES.forEach((r) => {
          const c = at(r.s, r.side * HALF / 2), dx = S.x - c.x, dy = S.y - c.y, along = dx * Math.cos(c.a) + dy * Math.sin(c.a), across = -dx * Math.sin(c.a) + dy * Math.cos(c.a);
          if (Math.abs(along) < 22 && Math.abs(across) < HALF / 2 + 4) S.slow = true;
        });
        const fast = S.boostT > 0 || S.capT > 0;
        let top = vmax * (1 + 0.04 * Math.min(S.laps, 6)) * (fast ? 1.6 : 1);
        if (S.off) top *= offMul;
        if (S.slow && !fast) top *= 0.45;
        if (S.brake) top *= 0.5;
        if (S.stunT > 0) { top *= 0.25; S.spin += dt * 14; } else S.spin = 0;
        S.v += (top - S.v) * Math.min(1, dt * (top > S.v ? 2.2 : 5));
        const turn = (S.right ? 1 : 0) - (S.left ? 1 : 0);
        if (S.stunT <= 0) S.a += turn * dt * (2.5 + (S.v < 120 ? 0.8 : 0));
        S.x += Math.cos(S.a) * S.v * dt; S.y += Math.sin(S.a) * S.v * dt;
        if (S.x < 22 || S.x > W - 22 || S.y < 76 || S.y > H - 22) { S.x = Math.max(22, Math.min(W - 22, S.x)); S.y = Math.max(76, Math.min(H - 22, S.y)); S.v *= 0.9; }
        S.dist += S.v * dt;
        if (fast || S.off) S.trail.push({ x: S.x, y: S.y, t: 0.4, c: fast ? '#fb923c' : '#065f46' });
        S.trail.forEach((q) => { q.t -= dt; });
        S.trail = S.trail.filter((q) => q.t > 0);
        // LEDs light as you drive past them on the trace
        LED.forEach((l, i) => {
          if (S.lit[i]) return;
          const q = at(l.s, 0);
          if (Math.hypot(S.x - q.x, S.y - q.y) > HALF + 8) return;
          S.lit[i] = true; S.leds += 1; S.next = S.lit.filter(Boolean).length;
          const o = at(l.s, -HALF - 18); burst(o.x, o.y, '#4ade80', 8);
          if (window.SFX) window.SFX.play('tick');
          if (S.next === NLED) pop('All 8 LEDs lit! Cross the line 🏁', '#4ade80');
        });
        // a lap: every LED lit, then across the start line going the right way
        const sl = at(START_S, 0), near = Math.hypot(S.x - sl.x, S.y - sl.y) < HALF + 8;
        if (S.next === NLED && near && Math.cos(S.a - sl.a) > 0.2) {
          S.laps += 1; S.next = 0; S.lit = []; S.flash = 0.6; pop('🏁 LAP ' + S.laps + '!  +300', '#facc15'); restock();
          if (window.SFX) window.SFX.play('pass');
        }
        // electrons and batteries
        dots.forEach((d) => {
          const q = at(d.s, d.off);
          if (d.x == null) { d.x = q.x; d.y = q.y; }
          const dx = S.x - d.x, dy = S.y - d.y, dd = Math.hypot(dx, dy);
          if (dd < magnet + 30 && dd > 1) { d.x += dx / dd * Math.min(dd, 260 * dt); d.y += dy / dd * Math.min(dd, 260 * dt); }
          if (dd < 22) { d.gone = true; S.electrons += 1; burst(d.x, d.y, '#67e8f9', 4); }
        });
        dots = dots.filter((d) => !d.gone);
        cells.forEach((c) => { const q = at(c.s, c.off); if (Math.hypot(S.x - q.x, S.y - q.y) < 30) { c.gone = true; S.boosts = Math.min(3, S.boosts + 1); pop('🔋 +1 boost (Space)', '#4ade80'); burst(q.x, q.y, '#4ade80', 10); if (window.SFX) window.SFX.play('coin'); } });
        cells = cells.filter((c) => !c.gone);
        // capacitors: drive across the plates for a burst
        CAP.forEach((c) => {
          c.t -= dt;
          const q = at(c.s, 0);
          if (c.t <= 0 && Math.hypot(S.x - q.x, S.y - q.y) < HALF) { c.t = 4; S.capT = 0.9; pop('Capacitor: ZAP!', '#60a5fa'); burst(q.x, q.y, '#60a5fa', 12); }
        });
        // short-circuit sparks slide across the trace
        SPARK.forEach((k) => {
          if (S.t < k.from) return;
          const q = at(k.s, Math.sin(S.t * 2.2 + k.ph) * (HALF - 8));
          k.x = q.x; k.y = q.y;
          if (Math.hypot(S.x - q.x, S.y - q.y) < 26 && S.invT <= 0) {
            if (fast) { S.smashed += 1; S.invT = 0.8; burst(q.x, q.y, '#fb923c', 14); pop('SMASH! +50', '#fb923c'); }
            else if (S.shields > 0) { S.shields -= 1; S.invT = 1.3; burst(q.x, q.y, '#38bdf8', 12); pop('🛡️ Blocked!', '#38bdf8'); }
            else { S.stunT = 0.9; S.invT = 1.8; S.shake = 12; pop('Short circuit!', '#f87171'); if (window.SFX) window.SFX.play('nope'); }
          }
        });
      }

      function tracePath() { g.beginPath(); PTS.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); }
      function drawBoard() {
        g.fillStyle = '#0b5a3c'; g.fillRect(-20, -20, W + 40, H + 40);
        g.fillStyle = 'rgba(255,255,255,.06)';
        for (let x = 18; x < W; x += 24) for (let y = 70; y < H; y += 24) g.fillRect(x, y, 2, 2);
        // thin decoration traces and chips, like a real board
        g.strokeStyle = '#0e7a52'; g.lineWidth = 3; g.lineJoin = 'miter';
        [[[20, 90], [70, 90], [90, 110]], [[930, 100], [930, 60]], [[560, 250], [620, 250], [640, 230], [640, 190]], [[200, 250], [330, 250], [350, 270], [350, 360]], [[760, 420], [800, 380], [800, 260]], [[40, 520], [300, 520]]]
          .forEach((l) => { g.beginPath(); l.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.fillStyle = '#d9b36a'; g.beginPath(); g.arc(l[l.length - 1][0], l[l.length - 1][1], 5, 0, 6.3); g.fill(); });
        [[230, 285, 90, 60, 'micro:bit'], [760, 260, 80, 110, 'CPU']].forEach(([x, y, w, h, label]) => {
          g.fillStyle = '#c0c8cf'; for (let i = 0; i < w; i += 12) { g.fillRect(x + i + 3, y - 6, 5, 6); g.fillRect(x + i + 3, y + h, 5, 6); }
          g.fillStyle = '#16191e'; g.fillRect(x, y, w, h);
          g.fillStyle = '#9aa6b2'; g.font = '700 12px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2);
        });
        g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '700 11px monospace'; g.textAlign = 'left';
        g.fillText('MAKER LAB · CIRCUIT DRIVER · REV 1.0', 24, H - 14);
        // the copper trace
        g.lineJoin = 'round'; g.lineCap = 'round';
        tracePath(); g.strokeStyle = '#063d29'; g.lineWidth = HALF * 2 + 12; g.stroke();
        tracePath(); g.strokeStyle = '#b87333'; g.lineWidth = HALF * 2; g.stroke();
        tracePath(); g.strokeStyle = '#d99a52'; g.lineWidth = HALF * 2 - 14; g.stroke();
        tracePath(); g.strokeStyle = 'rgba(255,240,200,.35)'; g.lineWidth = 3; g.setLineDash([14, 18]); g.stroke(); g.setLineDash([]);
        // start line
        const st = at(START_S, 0);
        g.save(); g.translate(st.x, st.y); g.rotate(st.a);
        for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111827'; g.fillRect(-8 + j * 8, -HALF + i * (HALF / 4), 8, HALF / 4); }
        g.restore();
      }
      function part(s, off, fn) { const q = at(s, off); g.save(); g.translate(q.x, q.y); g.rotate(q.a); fn(); g.restore(); }
      function drawParts() {
        RES.forEach((r) => part(r.s, r.side * HALF / 2, () => {                     // resistor: body across half the trace, with colour bands
          g.fillStyle = '#9ca3af'; g.fillRect(-3, -HALF / 2 - 8, 6, HALF + 16);
          g.fillStyle = '#e7c9a1'; g.strokeStyle = '#7c5a2e'; g.lineWidth = 2;
          g.beginPath(); g.roundRect(-13, -HALF / 2, 26, HALF, 7); g.fill(); g.stroke();
          ['#b91c1c', '#111827', '#f59e0b'].forEach((c, i) => { g.fillStyle = c; g.fillRect(-11, -HALF / 2 + 5 + i * 9, 22, 4); });
        }));
        CAP.forEach((c) => part(c.s, 0, () => {                                    // capacitor: two plates across the trace
          const ready = c.t <= 0;
          g.fillStyle = ready ? '#60a5fa' : '#475569';
          g.fillRect(-9, -HALF + 3, 6, HALF * 2 - 6); g.fillRect(3, -HALF + 3, 6, HALF * 2 - 6);
          if (ready) { g.fillStyle = 'rgba(96,165,250,' + (0.25 + 0.2 * Math.sin(S.t * 8)) + ')'; g.fillRect(-16, -HALF, 32, HALF * 2); }
        }));
        LED.forEach((l, i) => part(l.s, -HALF - 18, () => {                         // LEDs sit beside the trace, on the outside
          const on = !!S.lit[i], nextUp = !on && S.phase === 'race' && S.lit.slice(0, i).every(Boolean) && (i === 0 || S.lit[i - 1]);
          if (on || nextUp) { g.fillStyle = on ? 'rgba(74,222,128,.35)' : 'rgba(250,204,21,' + (0.2 + 0.2 * Math.sin(S.t * 9)) + ')'; g.beginPath(); g.arc(0, 0, 17, 0, 6.3); g.fill(); }
          g.fillStyle = on ? '#4ade80' : '#7f1d1d'; g.strokeStyle = '#0b1229'; g.lineWidth = 2;
          g.beginPath(); g.arc(0, 0, 9, 0, 6.3); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(-3, -3, 2.5, 0, 6.3); g.fill();
        }));
        dots.forEach((d) => {
          const q = d.x == null ? at(d.s, d.off) : d;
          g.fillStyle = 'rgba(103,232,249,.35)'; g.beginPath(); g.arc(q.x, q.y, 9, 0, 6.3); g.fill();
          g.fillStyle = '#ecfeff'; g.beginPath(); g.arc(q.x, q.y, 4.5, 0, 6.3); g.fill();
        });
        g.textAlign = 'center'; g.textBaseline = 'middle';
        cells.forEach((c) => { const q = at(c.s, c.off); g.font = '30px sans-serif'; g.fillText('🔋', q.x, q.y + Math.sin(S.t * 6) * 3); });
        SPARK.forEach((k) => {
          if (S.t < k.from || k.x == null) return;
          g.fillStyle = 'rgba(248,113,113,.35)'; g.beginPath(); g.arc(k.x, k.y, 18 + Math.sin(S.t * 20) * 3, 0, 6.3); g.fill();
          g.font = '30px sans-serif'; g.fillText('⚡', k.x, k.y);
        });
      }
      function drawKart() {
        S.trail.forEach((q) => { g.globalAlpha = q.t / 0.4 * 0.7; g.fillStyle = q.c; g.beginPath(); g.arc(q.x, q.y, 7, 0, 6.3); g.fill(); });
        g.globalAlpha = 1;
        if (S.invT > 0 && Math.floor(S.invT * 10) % 2) return;
        g.save(); g.translate(S.x, S.y); g.rotate(S.a + S.spin);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(2, 4, 22, 15, 0, 0, 6.3); g.fill();
        g.fillStyle = '#111827'; [[-12, -15], [8, -15], [-12, 10], [8, 10]].forEach(([x, y]) => g.fillRect(x, y, 9, 5));    // wheels
        g.fillStyle = S.boostT > 0 || S.capT > 0 ? '#fb923c' : '#facc15'; g.strokeStyle = '#1d2a5c'; g.lineWidth = 2.5;
        g.beginPath(); g.roundRect(-18, -11, 36, 22, 7); g.fill(); g.stroke();
        g.fillStyle = '#1d2a5c'; g.beginPath(); g.moveTo(18, -6); g.lineTo(25, 0); g.lineTo(18, 6); g.fill();              // nose shows which way it points
        g.restore();
        if (robot.complete) g.drawImage(robot, S.x - 21, S.y - 30, 42, 42);
        if (S.shields > 0) { g.strokeStyle = 'rgba(56,189,248,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(S.x, S.y - 4, 30, 0, 6.3); g.stroke(); }
        if (S.stunT > 0) { g.font = '22px sans-serif'; g.textAlign = 'center'; g.fillText('💫', S.x, S.y - 36); }
      }
      function draw() {
        g.save();
        if (S.shake) g.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
        drawBoard(); drawParts(); drawKart();
        S.parts.forEach((p) => { g.globalAlpha = Math.max(0, p.t / 0.5); g.fillStyle = p.color; g.fillRect(p.x - 3, p.y - 3, 6, 6); });
        g.globalAlpha = 1;
        if (S.flash > 0) { g.fillStyle = 'rgba(250,204,21,' + S.flash * 0.4 + ')'; g.fillRect(0, 54, W, H); }
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 22px Nunito, sans-serif'; g.lineWidth = 4; g.strokeStyle = '#0b1229';
        S.pops.forEach((p) => { g.globalAlpha = Math.min(1, p.t * 2); g.strokeText(p.text, p.x, p.y); g.fillStyle = p.color; g.fillText(p.text, p.x, p.y); });
        g.globalAlpha = 1;
        if (S.phase === 'race' && (S.off || S.slow)) {
          g.font = '800 20px Nunito, sans-serif'; g.strokeText(S.off ? 'Off the trace: slow!' : 'Resistor: slowed down', W / 2, 78); g.fillStyle = '#fecaca'; g.fillText(S.off ? 'Off the trace: slow!' : 'Resistor: slowed down', W / 2, 78);
        }
        // HUD
        g.fillStyle = 'rgba(15,23,42,.85)'; g.fillRect(0, 0, W, 54);
        g.textAlign = 'left'; g.font = '800 26px Nunito, sans-serif';
        const left = Math.max(0, Math.ceil(total - S.t));
        g.fillStyle = left <= 5 && S.phase === 'race' ? '#f87171' : '#fff'; g.fillText('⏱ ' + left + 's', 18, 28);
        g.fillStyle = '#facc15'; g.fillText('⭐ ' + score(), 140, 28);
        g.fillStyle = '#fff'; g.fillText('🏁 ' + S.laps, 310, 28); g.fillText('💡 ' + S.next + '/' + NLED, 400, 28);
        g.fillText('🔋 ' + S.boosts, 530, 28); g.fillText('🛡️ ' + S.shields, 620, 28);
        g.textAlign = 'right'; g.font = '700 18px Nunito, sans-serif'; g.fillStyle = '#cbd5e1'; g.fillText('← → steer · Space boost', W - 16, 28);
        if (S.phase === 'count') {
          g.fillStyle = 'rgba(15,23,42,.6)'; g.fillRect(0, 54, W, H - 54);
          const n = Math.ceil(S.countT - 0.3);
          g.textAlign = 'center'; g.font = '400 130px "Lilita One", Nunito, sans-serif'; g.fillStyle = '#facc15'; g.fillText(n > 0 ? String(n) : 'GO!', W / 2, 210);
          g.font = '800 22px Nunito, sans-serif'; g.fillStyle = '#fff';
          ['← → steer. Stay on the copper trace: the bare board is slow.', '💡 Drive past all 8 LEDs to light them, then cross the line for a lap.',
            '🔋 Battery = a boost (Space) · blue capacitor = free ZAP', 'Drive around the resistors · dodge the ⚡ short circuits'].forEach((line, i) => g.fillText(line, W / 2, 330 + i * 38));
        }
        g.restore();
      }

      let last = performance.now(), done = false;
      function end() {
        S.phase = 'done'; done = true;
        window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
        canvas.removeEventListener('pointerdown', pd); window.removeEventListener('pointerup', pu);
        draw();
        resolve({ score: score(), laps: S.laps, leds: S.leds, electrons: S.electrons, smashed: S.smashed });
      }
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        if (opts.spy) opts.spy(S);                              // the browser test steers with this
        if (!done) { draw(); requestAnimationFrame(frame); }
      }
      requestAnimationFrame(frame);
    });
  }

  window.CircuitDriver = { play, lap: LAP, at, nearest };
})();
