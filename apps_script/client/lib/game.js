/* Robot Rush: a timed three-lane race with the student's own robot.
 *   RobotRush.play(canvas, { avatar, seconds, powerups, controls(fn) }) -> Promise<{ score, bolts, meters, smashed }>
 * Arrow keys / W S switch lanes, Space dashes. Bugs and glitches slow you down; bolts add points.
 * Power-ups: turbo (faster), shield (blocks hits), magnet (pulls bolts), dash (one burst per level). */
(function () {
  'use strict';
  const W = 960, H = 540, LANES = [205, 320, 435], PX = 170, ROAD_TOP = 140, ROAD_BOT = 500;

  function play(canvas, opts) {
    return new Promise((resolve) => {
      const g = canvas.getContext('2d');
      canvas.width = W;
      canvas.height = H;
      const pw = Object.assign({ turbo: 0, shield: 0, magnet: 0, dash: 0 }, opts.powerups || {});
      const robot = new Image();
      robot.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.RobotAvatar.svg(opts.avatar || {}, 160, { noBg: true }));
      const total = opts.seconds || 45, base = 330 * (1 + 0.12 * pw.turbo), magnet = 30 + 55 * pw.magnet;
      const S = { lane: 1, y: LANES[1], t: 0, dist: 0, bolts: 0, smashed: 0, shields: pw.shield, dashes: pw.dash,
                  dashT: 0, stunT: 0, invT: 0, items: [], spawnT: 1, boltT: 0.3, pops: [], parts: [], shake: 0,
                  phase: 'count', countT: 3.2 };

      const move = (d) => { if (S.phase === 'race') S.lane = Math.max(0, Math.min(2, S.lane + d)); };
      const dash = () => {
        if (S.phase !== 'race') return;
        if (S.dashes > 0 && S.dashT <= 0) { S.dashes -= 1; S.dashT = 1.4; pop('🚀 DASH!', '#fb923c'); }
        else if (!pw.dash) pop('Buy Rocket dash in the shop!', '#cbd5e1');
      };
      const keys = (e) => {
        if (S.phase !== 'race') return;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { move(-1); e.preventDefault(); }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { move(1); e.preventDefault(); }
        else if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'KeyD') { dash(); e.preventDefault(); }
      };
      const tap = (e) => {
        const r = canvas.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * H;
        if (y < S.y - 45) move(-1); else if (y > S.y + 45) move(1); else dash();
      };
      window.addEventListener('keydown', keys);
      canvas.addEventListener('pointerdown', tap);
      if (opts.controls) opts.controls({ up: () => move(-1), down: () => move(1), dash });

      function pop(text, color) { S.pops.push({ text, color, t: 1.1, x: PX + 30, y: S.y - 80 }); }
      function burst(x, y, color, n) {
        for (let i = 0; i < (n || 10); i++) {
          const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
          S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.6, color });
        }
      }
      function spawnEnemy() {
        const kinds = [{ e: '🐛', name: 'bug' }, { e: '👾', name: 'glitch', moves: true }, { e: '🧱', name: 'wall' }];
        const unlocked = S.t < 12 ? 1 : S.t < 26 ? 2 : 3;               // glitches join at 12 s, walls at 26 s
        const k = kinds[Math.floor(Math.random() * unlocked)], lane = Math.floor(Math.random() * 3);
        S.items.push({ type: 'enemy', e: k.e, moves: !!k.moves, x: W + 50, y: LANES[lane], target: lane, wait: 0.8 + Math.random(), bob: Math.random() * 6 });
      }
      function spawnBolts() {
        const lane = Math.floor(Math.random() * 3), n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) S.items.push({ type: 'bolt', x: W + 40 + i * 58, y: LANES[lane], bob: i });
      }
      const speed = () => (base + S.t * 5) * (S.dashT > 0 ? 1.9 : 1) * (S.stunT > 0 ? 0.45 : 1);
      const score = () => Math.round(S.dist / 10) + S.bolts * 25 + S.smashed * 50;

      function update(dt) {
        S.pops.forEach((p) => { p.t -= dt; p.y -= 40 * dt; });
        S.pops = S.pops.filter((p) => p.t > 0);
        S.parts.forEach((p) => { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; });
        S.parts = S.parts.filter((p) => p.t > 0);
        S.shake = Math.max(0, S.shake - dt * 30);
        if (S.phase === 'count') { S.countT -= dt; if (S.countT <= 0) S.phase = 'race'; return; }
        if (S.phase !== 'race') return;
        S.t += dt;
        if (S.t >= total) { S.t = total; end(); return; }
        const v = speed();
        S.dist += v * dt;
        S.dashT -= dt; S.stunT -= dt; S.invT -= dt;
        S.y += (LANES[S.lane] - S.y) * Math.min(1, dt * 14);
        if ((S.spawnT -= dt) <= 0) { spawnEnemy(); S.spawnT = Math.max(0.42, 1.2 - S.t * 0.016) * (0.7 + Math.random() * 0.6); }
        if ((S.boltT -= dt) <= 0) { spawnBolts(); S.boltT = 1.3 + Math.random() * 1.1; }
        S.items.forEach((it) => {
          it.x -= v * dt;
          if (it.type === 'bolt') {
            const dx = it.x - PX, dy = it.y - S.y;
            if (dx > -30 && dx < magnet + 60 && Math.abs(dy) < magnet + 10) { it.x -= dx * Math.min(1, dt * 9); it.y -= dy * Math.min(1, dt * 9); }
            if (Math.hypot(it.x - PX, it.y - S.y) < 42) { it.gone = true; S.bolts += 1; burst(it.x, it.y, '#facc15', 6); }
            return;
          }
          if (it.moves && (it.wait -= dt) <= 0) {
            it.target = Math.max(0, Math.min(2, it.target + (Math.random() < 0.5 ? -1 : 1)));
            it.wait = 1 + Math.random();
          }
          it.y += (LANES[it.target] - it.y) * Math.min(1, dt * 3);
          if (!it.hit && Math.abs(it.x - PX) < 46 && Math.abs(it.y - S.y) < 44) {
            it.hit = true;
            if (S.dashT > 0) { it.gone = true; S.smashed += 1; burst(it.x, it.y, '#fb923c', 16); pop('SMASH! +50', '#fb923c'); }
            else if (S.invT > 0) { /* still blinking from the last hit */ }
            else if (S.shields > 0) { S.shields -= 1; S.invT = 1.2; it.gone = true; burst(it.x, it.y, '#38bdf8', 14); pop('🛡️ Blocked!', '#38bdf8'); }
            else { S.stunT = 1.1; S.invT = 1.7; S.shake = 12; pop('Ouch! Slowed down', '#f87171'); }
          }
        });
        S.items = S.items.filter((it) => !it.gone && it.x > -80);
      }

      function draw() {
        g.save();
        if (S.shake) g.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
        const sky = g.createLinearGradient(0, 0, 0, ROAD_TOP);
        sky.addColorStop(0, '#1e1b4b'); sky.addColorStop(1, '#3b3486');
        g.fillStyle = sky; g.fillRect(-20, -20, W + 40, ROAD_TOP + 20);
        g.fillStyle = '#4c4699';                                    // skyline, slow parallax
        for (let i = 0; i < 14; i++) {
          const x = ((i * 90 - S.dist * 0.15) % (14 * 90) + 14 * 90) % (14 * 90) - 90, h = 30 + ((i * 37) % 60);
          g.fillRect(x, ROAD_TOP - h, 70, h);
        }
        g.fillStyle = '#facc15';
        for (let i = 0; i < 14; i++) {
          const x = ((i * 90 - S.dist * 0.15) % (14 * 90) + 14 * 90) % (14 * 90) - 90;
          if (i % 2) g.fillRect(x + 14, ROAD_TOP - 22, 8, 8);
        }
        g.fillStyle = '#1f2937'; g.fillRect(-20, ROAD_TOP, W + 40, ROAD_BOT - ROAD_TOP);
        g.fillStyle = '#111827'; g.fillRect(-20, ROAD_BOT, W + 40, H - ROAD_BOT + 20);
        g.fillStyle = '#facc15';
        g.fillRect(-20, ROAD_TOP, W + 40, 6); g.fillRect(-20, ROAD_BOT - 6, W + 40, 6);
        g.fillStyle = 'rgba(255,255,255,.55)';
        const off = S.dist % 80;
        [262, 378].forEach((y) => { for (let x = -off; x < W; x += 80) g.fillRect(x, y - 2, 44, 4); });
        if (S.dashT > 0) {                                          // speed lines
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
          for (let i = 0; i < 12; i++) { const y = ROAD_TOP + 20 + ((i * 53 + S.dist) % (ROAD_BOT - ROAD_TOP - 40)); g.beginPath(); g.moveTo(W - ((i * 97 + S.dist * 2) % W), y); g.lineTo(W - ((i * 97 + S.dist * 2) % W) + 90, y); g.stroke(); }
        }
        g.textAlign = 'center'; g.textBaseline = 'middle';
        S.items.forEach((it) => {
          const b = Math.sin(S.t * 8 + it.bob) * 4;
          g.font = it.type === 'bolt' ? '34px sans-serif' : '58px sans-serif';
          g.fillText(it.type === 'bolt' ? '🔩' : it.e, it.x, it.y + b);
        });
        // the robot
        const blink = S.invT > 0 && Math.floor(S.invT * 10) % 2;
        if (!blink) {
          const bob = Math.sin(S.t * 14) * 4;
          if (S.dashT > 0) {
            g.fillStyle = '#fb923c'; g.beginPath(); g.moveTo(PX - 50, S.y - 20); g.lineTo(PX - 110 - Math.random() * 30, S.y); g.lineTo(PX - 50, S.y + 20); g.fill();
            g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(PX - 50, S.y - 10); g.lineTo(PX - 85 - Math.random() * 20, S.y); g.lineTo(PX - 50, S.y + 10); g.fill();
          }
          g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(PX, S.y + 44, 38, 8, 0, 0, Math.PI * 2); g.fill();   // shadow on the road
          if (robot.complete) g.drawImage(robot, PX - 66, S.y - 84 + bob, 132, 132);
          if (S.shields > 0) { g.strokeStyle = 'rgba(56,189,248,.8)'; g.lineWidth = 4; g.beginPath(); g.arc(PX, S.y - 8, 64, 0, Math.PI * 2); g.stroke(); }
          if (S.stunT > 0) { g.font = '28px sans-serif'; g.fillText('💫', PX, S.y - 78); }
        }
        S.parts.forEach((p) => { g.globalAlpha = Math.max(0, p.t / 0.6); g.fillStyle = p.color; g.fillRect(p.x - 4, p.y - 4, 8, 8); });
        g.globalAlpha = 1;
        g.font = '800 26px Nunito, sans-serif';
        S.pops.forEach((p) => { g.globalAlpha = Math.min(1, p.t * 2); g.fillStyle = p.color; g.fillText(p.text, p.x + 60, p.y); });
        g.globalAlpha = 1;
        // HUD
        g.fillStyle = 'rgba(15,23,42,.75)'; g.fillRect(0, 0, W, 54);
        g.textAlign = 'left'; g.font = '800 26px Nunito, sans-serif';
        const left = Math.max(0, Math.ceil(total - S.t));
        g.fillStyle = left <= 5 && S.phase === 'race' ? '#f87171' : '#fff';
        g.fillText('⏱ ' + left + 's', 18, 28);
        g.fillStyle = '#facc15'; g.fillText('⭐ ' + score(), 150, 28);
        g.fillStyle = '#fff'; g.fillText('🔩 ' + S.bolts, 330, 28);
        g.fillText('🛡️ ' + S.shields, 440, 28);
        g.fillText('🚀 ' + S.dashes + (pw.dash ? '  (Space)' : ''), 540, 28);
        g.textAlign = 'right'; g.font = '700 18px Nunito, sans-serif'; g.fillStyle = '#cbd5e1';
        g.fillText('↑ ↓ switch lanes', W - 16, 28);
        g.textAlign = 'center';
        if (S.phase === 'count') {
          g.fillStyle = 'rgba(15,23,42,.45)'; g.fillRect(0, 54, W, H - 54);
          const n = Math.ceil(S.countT - 0.2);
          g.font = '400 150px "Lilita One", Nunito, sans-serif'; g.fillStyle = '#facc15';
          g.fillText(n > 0 ? String(n) : 'GO!', W / 2, H / 2 + 10);
          g.font = '800 26px Nunito, sans-serif'; g.fillStyle = '#fff';
          g.fillText('Dodge 🐛 👾 🧱 · grab 🔩 · ↑ ↓ to switch lanes' + (pw.dash ? ' · Space to dash' : ''), W / 2, H - 70);
        }
        g.restore();
      }

      let last = performance.now(), done = false;
      function end() {
        S.phase = 'done';
        window.removeEventListener('keydown', keys);
        canvas.removeEventListener('pointerdown', tap);
        done = true;
        draw();
        resolve({ score: score(), bolts: S.bolts, meters: Math.round(S.dist / 10), smashed: S.smashed });
      }
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        if (!done) { draw(); requestAnimationFrame(frame); }
      }
      requestAnimationFrame(frame);
    });
  }

  window.RobotRush = { play };
})();
