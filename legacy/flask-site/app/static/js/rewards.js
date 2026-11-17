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

  function showRewards(r) {
    if (!r || (!r.xp_gained && !(r.badges || []).length)) return;
    let delay = 0;
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
        toast(`<span class="badge-big">🚀</span><div><small>Level up!</small><b>Level ${r.level.level}: ${esc(r.level.title)}</b><span>Check your robot — new parts may be unlocked.</span></div>`, 'level', 7000);
      }, delay);
    }
    updateHeader(r.level);
  }

  window.showRewards = showRewards;
})();
