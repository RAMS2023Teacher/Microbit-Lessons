/* XP toasts, badge pop-ups and level-up celebrations. Call showRewards(rewards). */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stack() {
    let s = document.getElementById('reward-stack');
    if (!s) {
      s = document.createElement('div');
      s.id = 'reward-stack';
      s.setAttribute('aria-live', 'polite');
      document.body.appendChild(s);
    }
    return s;
  }

  function toast(html, cls, ms) {
    const t = document.createElement('div');
    t.className = 'reward-toast ' + (cls || '');
    t.innerHTML = html;
    stack().appendChild(t);
    setTimeout(() => t.classList.add('out'), ms || 3800);
    setTimeout(() => t.remove(), (ms || 3800) + 500);
  }

  function confetti() {
    if (reduced) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#ffd23f', '#0fa3a3', '#ef4444', '#60a5fa', '#a78bfa', '#4ade80'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.6 + 's';
      p.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  function updateHeader(level) {
    if (!level) return;
    const fill = document.getElementById('nav-xp-fill');
    const lab = document.getElementById('nav-level');
    if (fill) fill.style.width = level.pct + '%';
    if (lab) lab.textContent = 'Lv ' + level.level;
  }

  // ---------------------------------------------------------------- game-style feedback
  const sfx = (name) => { if (window.SFX) window.SFX.play(name); };
  let lastX = window.innerWidth / 2, lastY = window.innerHeight / 2;
  window.addEventListener('pointerdown', (e) => { lastX = e.clientX; lastY = e.clientY; }, true);
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  /** "+20 XP" floats up from where the student clicked, and coins fly into the XP bar in the top bar. */
  function flyCoins(amount, from) {
    if (reduced) return;
    const [x, y] = from ? centerOf(from) : [lastX, lastY];
    const tag = document.createElement('div');
    tag.className = 'xp-float';
    tag.textContent = '+' + amount + ' XP';
    tag.style.left = x + 'px'; tag.style.top = y + 'px';
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 1300);
    const target = document.getElementById('nav-xp-fill') || document.getElementById('nav-level');
    if (!target) return;
    const [tx, ty] = centerOf(target), n = Math.min(10, 3 + Math.round(amount / 15));
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'fly-coin';
      c.textContent = '⭐';
      c.style.left = x + 'px'; c.style.top = y + 'px';
      document.body.appendChild(c);
      const dx = tx - x, dy = ty - y, wob = (Math.random() - 0.5) * 160;
      c.animate([
        { transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.4 + wob}px), calc(-50% + ${dy * 0.4 - 90}px)) scale(1.3)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.9 },
      ], { duration: 750 + i * 70, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => {
        c.remove();
        const bar = target.closest('.usermenu-lite') || target;
        bar.classList.remove('xp-bump'); void bar.offsetWidth; bar.classList.add('xp-bump');
      };
    }
  }

  /** Big badge moment: the badge pops in the middle of the screen with shining rays. Click anywhere to close. */
  function badgeSpotlight(b) {
    const box = document.createElement('div');
    box.className = 'badge-spot';
    box.innerHTML = `<div class="badge-spot-card"><div class="badge-rays"></div><div class="badge-spot-icon">${esc(b.icon)}</div>` +
      `<small>Badge unlocked!</small><b>${esc(b.name)}</b><span>${esc(b.desc)}</span><em>tap to keep going</em></div>`;
    document.body.appendChild(box);
    const close = () => { box.classList.add('out'); setTimeout(() => box.remove(), 350); };
    box.addEventListener('click', close);
    setTimeout(close, 4200);
  }

  /** A sparkle burst around a button (used when buying). */
  function burst(el, emoji) {
    if (reduced || !el) return;
    const [x, y] = centerOf(el);
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'fly-coin';
      p.textContent = emoji || '✨';
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.appendChild(p);
      const a = (i / 12) * Math.PI * 2, d = 70 + Math.random() * 50;
      p.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
                 { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.1)`, opacity: 0 }],
                { duration: 650, easing: 'ease-out', fill: 'forwards' }).onfinish = () => p.remove();
    }
  }

  /** A locked button: buzz, shake it red, and make the "what's missing" note flash. */
  function nope(el, note) {
    sfx('nope');
    [el, note].forEach((x) => {
      if (!x) return;
      x.classList.remove('nope'); void x.offsetWidth; x.classList.add('nope');
      clearTimeout(x._nope); x._nope = setTimeout(() => x.classList.remove('nope'), 650);
    });
  }

  window.Celebrate = {
    buy(el) { sfx('buy'); burst(el, '🪙'); },
    burst, nope, confetti, coins: flyCoins, sound: sfx,
    lessonDone() { sfx('fanfare'); confetti(); },
  };

  function showRewards(r) {
    if (!r || (!r.xp_gained && !(r.badges || []).length)) return;
    let delay = 0;
    const big = (r.items || []).some((i) => /Lesson complete|Quiz passed|Project shipped/.test(i.reason));
    sfx(r.level_up ? 'levelup' : big ? 'fanfare' : (r.badges || []).length ? 'badge' : 'coin');
    if (r.xp_gained) flyCoins(r.xp_gained);
    (r.badges || []).forEach((b, k) => setTimeout(() => { if (k) sfx('badge'); badgeSpotlight(b); }, 600 + k * 1600));
    if (r.xp_gained) {
      const reasons = (r.items || []).map((i) => `<li>+${i.amount} ${esc(i.reason)}</li>`).join('');
      toast(`<b class="xp-pop">+${r.xp_gained} XP</b><ul>${reasons}</ul>`, 'xp');
      delay += 500;
    }
    (r.badges || []).forEach((b) => {
      setTimeout(() => toast(`<span class="badge-big">${esc(b.icon)}</span><div><small>Badge unlocked!</small><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`, 'badge', 6000), delay);
      delay += 700;
    });
    if (r.level_up && r.level) {
      setTimeout(() => {
        confetti();
        if ((r.badges || []).length) sfx('levelup');
        toast(`<span class="badge-big">🚀</span><div><small>Level up!</small><b>Level ${r.level.level}: ${esc(r.level.title)}</b><span>Check your robot — new parts may be unlocked.</span></div>`, 'level', 7000);
      }, delay);
    }
    updateHeader(r.level);
  }

  window.showRewards = showRewards;
})();
