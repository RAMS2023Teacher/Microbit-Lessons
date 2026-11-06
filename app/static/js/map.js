/* Skill-tree lesson map. Data comes from gamify.map_data(). */
(function () {
  'use strict';
  const M = window.MAP;
  const map = document.getElementById('map');
  const detail = document.getElementById('map-detail');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COL = 150, ROW = 132, PADX = 90, PADY = 70;
  const byId = {};
  M.nodes.forEach((n) => { byId[n.id] = n; });
  const W = PADX * 2 + 4.2 * COL;
  const H = PADY * 2 + Math.max(...M.nodes.map((n) => n.y)) * ROW + 40;
  const px = (n) => [PADX + n.x * COL, PADY + n.y * ROW];
  map.style.aspectRatio = `${W} / ${H}`;

  // trails
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.add('map-trails');
  M.nodes.forEach((n) => n.requires.forEach((rid) => {
    const p = byId[rid];
    if (!p) return;
    const [x1, y1] = px(p), [x2, y2] = px(n);
    const my = (y1 + y2) / 2;
    const d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
    const done = p.state === 'complete';
    ['trail-base', done ? 'trail-done' : 'trail-todo'].forEach((cls) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', cls);
      svg.appendChild(path);
    });
  }));
  map.appendChild(svg);

  const STAR = (k) => '★★★'.slice(0, k) + '☆☆☆'.slice(0, 3 - k);
  function nodeLabel(n) {
    if (n.state === 'complete') return '✓';
    if (n.state === 'locked') return '🔒';
    return n.number;
  }

  M.nodes.forEach((n) => {
    const [x, y] = px(n);
    const a = document.createElement('button');
    a.type = 'button';
    a.className = `map-node ${n.state} unit-${n.unit}` + (n.id === M.current ? ' current' : '');
    a.style.left = (100 * x / W) + '%';
    a.style.top = (100 * y / H) + '%';
    a.style.setProperty('--pct', n.pct);
    a.innerHTML = `<span class="node-disc"><span>${nodeLabel(n)}</span></span>` +
      `<span class="node-title">${n.assigned ? '📌 ' : ''}${esc(n.title)}</span>` +
      (n.state !== 'locked' ? `<span class="node-stars" aria-label="${n.stars} of 3 stars">${STAR(n.stars)}</span>` : '');
    a.setAttribute('aria-label', `Lesson ${n.number}: ${n.title}, ${n.state === 'open' ? 'unlocked' : n.state}`);
    a.addEventListener('click', () => select(n));
    map.appendChild(a);
  });

  // the student's robot stands on the current lesson
  if (window.ME && M.current && byId[M.current]) {
    const [x, y] = px(byId[M.current]);
    const me = document.createElement('div');
    me.className = 'map-me';
    me.style.left = (100 * (x - 92) / W) + '%';
    me.style.top = (100 * (y - 40) / H) + '%';
    me.innerHTML = window.RobotAvatar.svg(window.ME, 56) + '<span>You</span>';
    map.appendChild(me);
  }

  function select(n) {
    map.querySelectorAll('.map-node.selected').forEach((e) => e.classList.remove('selected'));
    const idx = M.nodes.indexOf(n);
    map.querySelectorAll('.map-node')[idx].classList.add('selected');
    const url = window.LESSON_URL.replace('__ID__', encodeURIComponent(n.id));
    const unit = M.units[n.unit] || {};
    const action = { complete: 'Review lesson', progress: `Continue (${n.pct}%)`, open: 'Start lesson', locked: 'Peek anyway' }[n.state];
    let body = `<div class="eyebrow">Lesson ${n.number} · Unit ${n.unit}: ${esc(unit.title || '')}</div><h2>${esc(n.title)}</h2>`;
    if (n.state === 'locked') {
      body += `<p class="lock-note">🔒 Finish <b>${n.requires_titles.map(esc).join('</b> and <b>')}</b> to unlock this path.</p>`;
    } else {
      body += `<p class="stars-big">${STAR(n.stars)}</p><div class="meter wide"><i style="width:${n.pct}%"></i></div><p class="muted small">${n.pct}% complete · up to ${n.xp_possible} XP</p>`;
    }
    if (n.assigned) body += '<p>📌 Your teacher assigned this lesson.</p>';
    body += `<a class="btn ${n.state === 'locked' ? 'ghost' : ''} wide" href="${url}">${action}</a>`;
    detail.innerHTML = body;
  }
  select(byId[M.current] || M.nodes[0]);
  const cur = map.querySelector('.map-node.current');
  if (cur) {
    const box = map.parentElement;  // horizontal scroller on small screens
    box.scrollLeft = cur.offsetLeft - box.clientWidth / 2;
    if (cur.getBoundingClientRect().top > window.innerHeight) cur.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
})();
