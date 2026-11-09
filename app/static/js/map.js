/* Skill-tree lesson map. Data comes from gamify.map_data(). */
(function () {
  'use strict';
  const M = window.MAP;
  const map = document.getElementById('map');
  const detail = document.getElementById('map-detail');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COL = 150, ROW = 146, PADX = 90, PADY = 96;
  const byId = {};
  M.nodes.forEach((n) => { byId[n.id] = n; });
  const W = PADX * 2 + Math.max(4.2, ...M.nodes.map((n) => n.x)) * COL;
  const H = PADY * 2 + Math.max(...M.nodes.map((n) => n.y)) * ROW + 40;
  const px = (n) => [PADX + n.x * COL, PADY + n.y * ROW];
  map.style.aspectRatio = `${W} / ${H}`;

  // copper traces: straight runs with 45-degree corners, like a real circuit board
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.add('map-trails');
  const LANE = 14, BEND = 10;
  const spread = (i, count) => (i - (count - 1) / 2) * LANE;   // fan traces out so they don't overlap
  const childrenOf = (n) => M.nodes.filter((c) => c.requires.includes(n.id)).sort((a, b) => a.x - b.x);

  function addPath(d, classes) {
    classes.forEach((cls) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', cls);
      svg.appendChild(path);
    });
  }
  function addVia(x, y) {
    const via = document.createElementNS(NS, 'circle');
    via.setAttribute('cx', x);
    via.setAttribute('cy', y);
    via.setAttribute('r', 5);
    via.setAttribute('class', 'trace-via');
    svg.appendChild(via);
  }
  function traceClasses(powered, target) {
    if (!powered) return ['trace-mask', 'trace-off'];
    return ['trace-mask', 'trace-glow', 'trace-on'].concat(target.state === 'complete' ? [] : ['trace-live']);
  }
  function route(x1, y1, x2, y2, jog) {
    const dx = x2 - x1, dir = Math.sign(dx), c = Math.min(BEND, Math.abs(dx) / 2);
    if (Math.abs(dx) < 2) return `M${x1},${y1} L${x2},${y2}`;
    return `M${x1},${y1} L${x1},${jog - c} L${x1 + dir * c},${jog} L${x2 - dir * c},${jog} L${x2},${jog + c} L${x2},${y2}`;
  }

  M.nodes.forEach((n) => {
    const [x2, y2] = px(n);
    if (!n.requires.length) {   // first lessons are fed straight from the power rail
      addPath(`M${x2},0 L${x2},${y2}`, traceClasses(true, n));
      return;
    }
    const parents = n.requires.map((id) => byId[id]).filter(Boolean).sort((a, b) => a.x - b.x);
    parents.forEach((p, entry) => {
      const [x1, y1] = px(p);
      const siblings = childrenOf(p);
      const lane = spread(siblings.indexOf(n), siblings.length);
      const startX = x1 + lane, endX = x2 + spread(entry, parents.length);
      const far = y2 - y1 > ROW * 1.7;      // long runs turn just above the lesson they feed
      const jog = far ? y2 - 54 + spread(entry, parents.length) : Math.min(y1 + 78 + lane / 2, y2 - 42);
      addPath(route(startX, y1, endX, y2, jog), traceClasses(p.state === 'complete', n));
      if (far) { addVia(startX, jog); addVia(endX, jog); }
    });
  });
  map.appendChild(svg);

  const STAR = (k) => '★★★'.slice(0, k) + '☆☆☆'.slice(0, 3 - k);
  const STAR_LIGHTS = (k) => [0, 1, 2].map((i) => `<i class="${i < k ? 'lit' : ''}"></i>`).join('');
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
    a.innerHTML = `<span class="chip"><span class="chip-led"></span><span class="chip-num">${nodeLabel(n)}</span>` +
      `<span class="chip-bar"><i></i></span><span class="chip-stars">${STAR_LIGHTS(n.state === 'locked' ? 0 : n.stars)}</span></span>` +
      `<span class="node-title">${n.assigned ? '📌 ' : ''}${esc(n.title)}</span>`;
    a.setAttribute('aria-label', `Lesson ${n.number}: ${n.title}, ${n.state === 'open' ? 'unlocked' : n.state}` +
      (n.state === 'locked' ? '' : `, ${n.stars} of 3 stars`));
    a.addEventListener('click', () => select(n));
    map.appendChild(a);
  });

  // silkscreen labels above the side trails
  [[5, 'ROBOT SPRINT · START ANY TIME'], [6, 'AI LAB · AFTER SHAKE, TILT AND PLAY']].forEach(([unit, text]) => {
    const group = M.nodes.filter((n) => n.unit === unit);
    if (!group.length) return;
    const top = group.reduce((a, n) => (n.y < a.y ? n : a));
    const [x, y] = px(top);
    const lab = document.createElement('div');
    lab.className = 'map-unit-label';
    lab.style.left = (100 * (x + 60) / W) + '%';
    lab.style.top = (100 * (y - 44) / H) + '%';
    lab.textContent = text;
    map.appendChild(lab);
  });

  // the student's robot stands on the current lesson
  if (window.ME && M.current && byId[M.current]) {
    const [x, y] = px(byId[M.current]);
    const me = document.createElement('div');
    me.className = 'map-me';
    me.style.left = (100 * x / W) + '%';
    me.style.top = (100 * y / H) + '%';
    me.innerHTML = window.RobotAvatar.svg(window.ME, 56) + '<span>You</span>';
    map.appendChild(me);
  }

  const stamp = document.createElement('div');
  stamp.className = 'map-stamp';
  stamp.textContent = 'MAKER LAB · REV 1.0';
  map.appendChild(stamp);

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
