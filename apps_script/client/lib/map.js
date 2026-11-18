/* Skill tree: a pixel-art Maker Lab. Every finished lesson puts its gadget on the lab's shelves and adds a part to
 * the robot on the stand (lib/pixel.js draws both). Below it, the lessons are stations joined by pixel paths that
 * light up as power reaches them. Data comes from mapData_() on the server. */
(function () {
  'use strict';
  const M = window.MAP, PX = window.PixelArt;
  const map = document.getElementById('map');
  const detail = document.getElementById('map-detail');
  const hero = document.getElementById('lab-hero');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COL = 150, ROW = 150, PADX = 96, PADY = 96;
  const byId = {};
  M.nodes.forEach((n, i) => { byId[n.id] = n; n.sprite = PX.spriteFor(n.id, i); });
  const W = PADX * 2 + Math.max(2, ...M.nodes.map((n) => n.x)) * COL;
  const H = PADY * 2 + Math.max(...M.nodes.map((n) => n.y)) * ROW + 40;
  const px = (n) => [PADX + n.x * COL, PADY + n.y * ROW];
  map.style.aspectRatio = `${W} / ${H}`;
  map.style.maxWidth = Math.round(W * 1.25) + 'px';      // natural size, centred, so the stations don't spread out
  const teacher = !window.ME;
  const done = M.nodes.filter((n) => n.state === 'complete').length, total = M.nodes.length;
  const next = byId[M.current] && byId[M.current].state !== 'complete' ? byId[M.current] : M.nodes.find((n) => n.state === 'progress' || n.state === 'open');

  // ---------------------------------------------------------------- the lab
  if (hero) {
    const items = M.nodes.map((n) => ({ sprite: n.sprite, done: teacher || n.state === 'complete', current: next && n.id === next.id }));
    const color = (window.ME && window.ME.color) || 'teal';
    const shown = teacher ? total : done, pct = Math.round(100 * shown / Math.max(1, total));
    let line;
    if (teacher) line = 'This is the lab a student has built when they finish every lesson. Each lesson adds a gadget to the shelves and a part to the robot.';
    else if (done === total) line = 'Every gadget is built and your robot is finished. Amazing work, Maker!';
    else if (next) line = `Next up: finish <b>${esc(next.title)}</b> to add the <b>${esc(PX.names[next.sprite] || 'gadget')}</b> and the robot's <b>${esc(PX.partFor(M.nodes.indexOf(next) + 1, total).join(' + ') || 'next part')}</b>.`;
    else line = 'Finish a lesson to add your first gadget.';
    hero.innerHTML = `<div class="lab-art">${PX.lab({ items, color })}</div>` +
      `<div class="lab-info"><div class="eyebrow">${teacher ? 'Preview' : 'Your Maker Lab'}</div>` +
      `<h2><span translate="no">${shown}</span> of <span translate="no">${total}</span> gadgets built</h2>` +
      `<div class="px-meter" role="img" aria-label="Robot ${pct}% built"><i style="width:${pct}%"></i></div>` +
      `<p class="small"><b>🤖 Robot <span translate="no">${pct}%</span> built</b></p><p class="lab-next">${line}</p></div>`;
  }

  // ---------------------------------------------------------------- pixel paths between stations
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.classList.add('map-trails');
  const LANE = 16;
  const spread = (i, count) => (i - (count - 1) / 2) * LANE;
  const childrenOf = (n) => M.nodes.filter((c) => c.requires.includes(n.id)).sort((a, b) => a.x - b.x);
  const snap = (v) => Math.round(v / 4) * 4;          // everything on a 4px grid so it looks like pixels

  function addPath(d, classes) {
    classes.forEach((cls) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', cls);
      svg.appendChild(path);
    });
  }
  function pathClasses(powered, target) {
    if (!powered) return ['path-edge', 'path-off'];
    return ['path-edge', 'path-on'].concat(target.state === 'complete' ? [] : ['path-live']);
  }
  function route(x1, y1, x2, y2, jog) {           // square corners only
    [x1, y1, x2, y2, jog] = [x1, y1, x2, y2, jog].map(snap);
    if (Math.abs(x2 - x1) < 4) return `M${x1},${y1} L${x1},${y2}`;
    return `M${x1},${y1} L${x1},${jog} L${x2},${jog} L${x2},${y2}`;
  }
  M.nodes.forEach((n) => {
    const [x2, y2] = px(n);
    if (!n.requires.length) { addPath(route(x2, 0, x2, y2), pathClasses(true, n)); return; }
    const parents = n.requires.map((id) => byId[id]).filter(Boolean).sort((a, b) => a.x - b.x);
    parents.forEach((p, entry) => {
      const [x1, y1] = px(p);
      const siblings = childrenOf(p);
      const lane = spread(siblings.indexOf(n), siblings.length);
      const startX = x1 + lane, endX = x2 + spread(entry, parents.length);
      const far = y2 - y1 > ROW * 1.7;
      const jog = far ? y2 - 60 + spread(entry, parents.length) : Math.min(y1 + 80 + lane / 2, y2 - 48);
      addPath(route(startX, y1, endX, y2, jog), pathClasses(p.state === 'complete', n));
    });
  });
  map.appendChild(svg);

  // ---------------------------------------------------------------- stations
  const STAR = (k) => '★★★'.slice(0, k) + '☆☆☆'.slice(0, 3 - k);
  const PIXSTARS = (k) => [0, 1, 2].map((i) => `<i class="${i < k ? 'lit' : ''}"></i>`).join('');
  M.nodes.forEach((n) => {
    const [x, y] = px(n);
    const a = document.createElement('button');
    a.type = 'button';
    a.className = `map-node ${n.state}` + (n.id === M.current ? ' current' : '');
    a.style.left = (100 * x / W) + '%';
    a.style.top = (100 * y / H) + '%';
    a.style.setProperty('--pct', n.pct);
    const badge = n.state === 'complete' ? '✓' : n.state === 'locked' ? '🔒' : n.number;
    a.innerHTML = `<span class="station"><span class="station-art">${PX.sprite(n.sprite, { ghost: n.state === 'locked', size: 48 })}</span>` +
      `<span class="station-num" translate="no">${badge}</span>` +
      (n.state === 'progress' ? '<span class="station-bar"><i></i></span>' : '') +
      `</span><span class="px-stars">${PIXSTARS(n.state === 'locked' ? 0 : n.stars)}</span>` +
      `<span class="node-title">${n.assigned ? '📌 ' : ''}${esc(n.title)}</span>`;
    a.setAttribute('aria-label', `Lesson ${n.number}: ${n.title}, ${n.state === 'open' ? 'unlocked' : n.state}` +
      (n.state === 'locked' ? '' : `, ${n.stars} of 3 stars`));
    a.addEventListener('click', () => select(n));
    map.appendChild(a);
  });

  // the student's robot stands next to the current lesson
  if (window.ME && M.current && byId[M.current]) {
    const [x, y] = px(byId[M.current]);
    const me = document.createElement('div');
    me.className = 'map-me';
    me.style.left = (100 * x / W) + '%';
    me.style.top = (100 * y / H) + '%';
    me.innerHTML = window.RobotAvatar.svg(window.ME, 56) + '<span>You</span>';
    map.appendChild(me);
  }

  function select(n) {
    map.querySelectorAll('.map-node.selected').forEach((e) => e.classList.remove('selected'));
    map.querySelectorAll('.map-node')[M.nodes.indexOf(n)].classList.add('selected');
    const url = window.LESSON_URL.replace('__ID__', encodeURIComponent(n.id));
    const action = { complete: 'Review lesson', progress: `Continue (${n.pct}%)`, open: 'Start lesson', locked: 'Peek anyway' }[n.state];
    const parts = PX.partFor(M.nodes.indexOf(n) + 1, total);
    let body = `<div class="detail-art ${n.state}">${PX.sprite(n.sprite, { ghost: n.state === 'locked', size: 72 })}</div>` +
      `<div class="eyebrow">Lesson ${n.number}</div><h2>${esc(n.title)}</h2>` +
      `<p class="small detail-earn">${n.state === 'complete' ? '✅ Built:' : '🔧 Builds:'} <b>${esc(PX.names[n.sprite] || 'a gadget')}</b>` +
      (parts.length ? ` + robot <b>${esc(parts.join(' + '))}</b>` : '') + '</p>';
    if (n.state === 'locked') {
      body += `<p class="lock-note">🔒 Finish <b>${n.requires_titles.map(esc).join('</b> and <b>')}</b> to unlock this path.${n.or_titles.length ? ` Or finish <b>${n.or_titles.map(esc).join('</b> or <b>')}</b>.` : ''}</p>`;
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
    const box = map.parentElement;
    box.scrollLeft = cur.offsetLeft - box.clientWidth / 2;
  }
})();
