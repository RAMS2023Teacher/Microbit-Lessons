/* Robot avatar renderer. Part ids must match AVATAR_OPTIONS in course/rules.py.
 * Usage: <span data-avatar='{"body":"box",...}' data-size="48"></span>  (auto-rendered)
 *        RobotAvatar.svg(spec, size) -> SVG markup string */
(function () {
  'use strict';
  let uid = 0;
  const COLORS = {
    teal: ['#14b8a6', '#0d8f82'], red: ['#ef4444', '#b91c1c'], orange: ['#fb923c', '#c2410c'],
    yellow: ['#facc15', '#ca8a04'], green: ['#4ade80', '#15803d'], blue: ['#60a5fa', '#1d4ed8'],
    purple: ['#a78bfa', '#6d28d9'], pink: ['#f472b6', '#be185d'], white: ['#f1f5f9', '#94a3b8'],
    chrome: ['url(#CHROME)', '#64748b'], gold: ['url(#GOLD)', '#a16207'],
    lime: ['#a3e635', '#4d7c0f'], galaxy: ['url(#GALAXY)', '#4c1d95'],
    ice: ['#a5f3fc', '#0891b2'], midnight: ['#334155', '#0f172a'], sunset: ['url(#SUNSET)', '#9a3412'], copper: ['url(#COPPER)', '#7c4a1e'],
  };
  const BG = { sky: '#bfe3ff', mint: '#c7f5df', sun: '#ffe9a8', lilac: '#e3d7ff', night: '#1e2a55', circuit: '#0f3d3a', stars: '#0b1026', ocean: '#0e7490', lava: '#431407', rainbow: '#fff', dusk: '#fb923c', matrix: '#04130a', arcade: '#1e1b4b', pcb: '#0b5a3c' };
  const HEADS = {
    box: { x: 25, y: 20, w: 50, h: 40, r: 8 },
    round: { x: 24, y: 18, w: 52, h: 42, r: 21 },
    tall: { x: 31, y: 12, w: 38, h: 48, r: 10 },
    tank: { x: 20, y: 24, w: 60, h: 34, r: 7 },
    hover: { x: 26, y: 18, w: 48, h: 40, r: 16 },
  };
  const DEFAULT = { body: 'box', color: 'teal', outfit: 'none', eyes: 'round', mouth: 'smile', face: 'none', antenna: 'ball', accessory: 'none', bg: 'sky' };

  // opts.noBg: just the robot, no background square (used by Robot Rush)
  function svg(spec, size, opts) {
    const a = Object.assign({}, DEFAULT, spec || {}), noBg = !!(opts && opts.noBg);
    if (noBg) a.bg = 'none';
    const id = 'av' + (++uid);
    const [fill, dark] = COLORS[a.color] || COLORS.teal;
    const F = fill.replace('CHROME', id + 'c').replace('GOLD', id + 'g').replace('GALAXY', id + 'x').replace('SUNSET', id + 's').replace('COPPER', id + 'k');
    const H = HEADS[a.body] || HEADS.box;
    const cx = H.x + H.w / 2;
    const eyeY = H.y + H.h * 0.42, mouthY = H.y + H.h * 0.74;
    const ex = H.w * 0.2;
    const ink = '#13203f';
    const o = [];
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="robot-avatar" role="img" aria-label="${(a.name || 'robot avatar').replace(/[<>"&]/g, '')}">`);
    o.push(`<defs><linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset=".5" stop-color="#94a3b8"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>` +
      `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#eab308"/><stop offset="1" stop-color="#fef3c7"/></linearGradient>` +
      `<linearGradient id="${id}x" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset=".55" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient>` +
      `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#facc15"/><stop offset=".5" stop-color="#f97316"/><stop offset="1" stop-color="#db2777"/></linearGradient>` +
      `<linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c28b"/><stop offset=".5" stop-color="#b87333"/><stop offset="1" stop-color="#e8a866"/></linearGradient>` +
      `<clipPath id="${id}clip"><rect width="100" height="100" rx="22"/></clipPath>` +
      `<clipPath id="${id}h"><rect x="${H.x}" y="${H.y}" width="${H.w}" height="${H.h}" rx="${H.r}"/></clipPath></defs>`);
    const onHead = (svgText) => `<g clip-path="url(#${id}h)">${svgText}</g>`;      // drawn inside the head's outline only
    o.push(noBg ? '<g>' : `<g clip-path="url(#${id}clip)"><rect width="100" height="100" fill="${BG[a.bg] || BG.sky}"/>`);
    if (a.bg === 'circuit') {
      o.push('<g stroke="#2dd4bf" stroke-width="1.6" fill="none" opacity=".55"><path d="M0 18h22l8 8h20M100 30H78l-6 6v20M0 70h14l10-10M100 82H70l-8-8"/></g><g fill="#5eead4" opacity=".7"><circle cx="50" cy="26" r="2.2"/><circle cx="72" cy="56" r="2.2"/><circle cx="24" cy="60" r="2.2"/></g>');
    } else if (a.bg === 'stars') {
      o.push('<g fill="#fff">' + [[12, 14], [84, 10], [90, 44], [8, 52], [70, 22], [20, 86], [92, 78], [40, 8]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.6}"/>`).join('') + '</g>');
    } else if (a.bg === 'ocean') {
      o.push('<path d="M0 70 q12 -6 25 0 t25 0 t25 0 t25 0 V100 H0z" fill="#0891b2"/><path d="M0 80 q12 -6 25 0 t25 0 t25 0 t25 0 V100 H0z" fill="#155e75"/><g fill="#a5f3fc" opacity=".7"><circle cx="14" cy="30" r="2"/><circle cx="20" cy="22" r="1.3"/><circle cx="86" cy="40" r="1.8"/></g>');
    } else if (a.bg === 'lava') {
      o.push('<path d="M0 100 L28 46 L40 58 L52 40 L70 100z" fill="#7c2d12"/><path d="M44 47 l8 -9 l6 9 l-6 10z" fill="#f97316"/><path d="M0 88 q20 -8 40 0 t40 0 t40 0 V100 H0z" fill="#ea580c"/><g fill="#fdba74"><circle cx="54" cy="24" r="2.2"/><circle cx="62" cy="16" r="1.4"/><circle cx="46" cy="18" r="1.6"/></g>');
    } else if (a.bg === 'rainbow') {
      o.push(['#ef4444', '#f97316', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'].map((c, i) => `<circle cx="50" cy="104" r="${92 - i * 9}" fill="${c}"/>`).join('') + '<circle cx="50" cy="104" r="38" fill="#fff"/>');
    } else if (a.bg === 'dusk') {
      o.push('<rect width="100" height="100" fill="#fdba74"/><rect y="0" width="100" height="34" fill="#7c3aed" opacity=".55"/><rect y="34" width="100" height="22" fill="#f472b6" opacity=".5"/><circle cx="50" cy="72" r="20" fill="#fde047"/><rect y="72" width="100" height="28" fill="#7c2d12"/><path d="M0 72 h100" stroke="#fed7aa" stroke-width="1.5"/>');
    } else if (a.bg === 'matrix') {
      o.push('<g font-family="monospace" font-size="9" fill="#22c55e">' + [6, 18, 30, 42, 54, 66, 78, 90].map((x, i) => [0, 1, 2, 3, 4].map((k) => `<text x="${x}" y="${((i * 23 + k * 21) % 105) + 6}" opacity="${0.25 + ((i + k) % 4) * 0.2}">${'10'[(i + k) % 2]}</text>`).join('')).join('') + '</g>');
    } else if (a.bg === 'arcade') {
      o.push('<g>' + [[10, 12, '#f472b6'], [30, 6, '#facc15'], [52, 14, '#22d3ee'], [74, 7, '#4ade80'], [92, 16, '#f472b6'], [8, 86, '#22d3ee'], [90, 84, '#facc15'], [6, 48, '#4ade80'], [94, 50, '#f472b6']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}" opacity=".9"/><circle cx="${x}" cy="${y}" r="7" fill="${c}" opacity=".25"/>`).join('') + '</g><path d="M0 96 h100" stroke="#f472b6" stroke-width="3"/>');
    } else if (a.bg === 'pcb') {
      o.push('<rect x="-10" y="60" width="120" height="26" fill="#063d29"/><rect x="-10" y="63" width="120" height="20" fill="#b87333"/><path d="M0 73 h100" stroke="#fde6c0" stroke-width="1.5" stroke-dasharray="7 6" opacity=".7"/><g fill="#4ade80"><circle cx="14" cy="50" r="3.5"/><circle cx="86" cy="50" r="3.5"/></g><g>' + [0, 1, 2, 3].map((i) => `<rect x="${44 + (i % 2) * 6}" y="${63 + Math.floor(i / 2) * 5}" width="6" height="5" fill="${(i + Math.floor(i / 2)) % 2 ? '#fff' : '#111827'}"/>`).join('') + '</g>');
    } else if (a.bg === 'night') {
      o.push('<circle cx="82" cy="16" r="7" fill="#fef3c7"/><circle cx="85" cy="14" r="6" fill="#1e2a55"/>');
    }
    // jetpack (behind body)
    if (a.accessory === 'jetpack') o.push(`<rect x="16" y="${H.y + H.h - 2}" width="12" height="26" rx="5" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/><rect x="72" y="${H.y + H.h - 2}" width="12" height="26" rx="5" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>` +
      `<path d="M18 ${H.y + H.h + 24} q4 12 8 0 M74 ${H.y + H.h + 24} q4 12 8 0" fill="#f97316" stroke="#facc15" stroke-width="1.5"/>`);
    // cape (behind body)
    if (a.accessory === 'cape') o.push(`<path d="M30 64 L18 100 H82 L70 64 Z" fill="#dc2626"/><path d="M30 64 L24 100 H32 Z" fill="#991b1b"/>`);
    // torso
    const tw = a.body === 'tank' ? 46 : 36, tx = 50 - tw / 2;
    const ty = H.y + H.h + 2, th = a.body === 'tank' ? 22 : 30, arms = a.body !== 'tank' && a.body !== 'hover';
    // costume parts that go behind the body
    switch (a.outfit) {
      case 'bat': o.push(`<path d="M${tx + 3} ${ty + 2} L${tx - 14} 100 Q${tx} 94 ${tx + 10} 100 Q50 93 ${tx + tw - 10} 100 Q${tx + tw} 94 ${tx + tw + 14} 100 L${tx + tw - 3} ${ty + 2} Z" fill="#111827"/>`); break;
      case 'cat': o.push(`<path d="M${tx + tw - 3} ${ty + th - 6} q16 3 13 -16 q-2 -8 5 -11" fill="none" stroke="#111827" stroke-width="4.5" stroke-linecap="round"/>`); break;
      case 'astronaut': o.push(`<rect x="${tx - 6}" y="${ty - 1}" width="${tw + 12}" height="${th - 5}" rx="5" fill="#9ca3af" stroke="#4b5563" stroke-width="1.6"/>`); break;
      case 'dino': o.push(`<path d="M${tx + tw - 3} ${ty + th - 14} L${tx + tw + 22} ${ty + th + 2} L${tx + tw - 3} ${ty + th - 2} Z" fill="#22c55e" stroke="#15803d" stroke-width="1.6" stroke-linejoin="round"/>`); break;
    }
    o.push(`<rect x="${tx}" y="${H.y + H.h + 2}" width="${tw}" height="${a.body === 'tank' ? 22 : 30}" rx="7" fill="${F}" stroke="${dark}" stroke-width="2"/>`);
    o.push(`<rect x="44" y="${H.y + H.h + 8}" width="12" height="8" rx="2" fill="${ink}" opacity=".8"/><circle cx="47" cy="${H.y + H.h + 12}" r="1.4" fill="#4ade80"/><circle cx="53" cy="${H.y + H.h + 12}" r="1.4" fill="#f87171"/>`);
    if (a.body === 'tank') {
      o.push(`<rect x="18" y="80" width="64" height="16" rx="8" fill="#334155"/>` + [26, 38, 50, 62, 74].map((x) => `<circle cx="${x}" cy="88" r="4.5" fill="#94a3b8" stroke="#1e293b"/>`).join(''));
    } else if (a.body === 'hover') {
      o.push(`<path d="M40 ${H.y + H.h + 32} q3 10 6 0 M54 ${H.y + H.h + 32} q3 10 6 0" fill="#fb923c" stroke="#fde047" stroke-width="1.5"/>`);
    } else {
      o.push(`<rect x="22" y="${H.y + H.h + 6}" width="7" height="20" rx="3.5" fill="${F}" stroke="${dark}" stroke-width="1.6"/><rect x="71" y="${H.y + H.h + 6}" width="7" height="20" rx="3.5" fill="${F}" stroke="${dark}" stroke-width="1.6"/>`);
    }
    // costume over the body: suit() recolors the torso (and the arms, for costumes with sleeves)
    const suit = (fill, edge, sleeves) => `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="7" fill="${fill}" stroke="${edge}" stroke-width="2"/>` +
      (arms && sleeves ? [22, 71].map((x) => `<rect x="${x}" y="${H.y + H.h + 6}" width="7" height="20" rx="3.5" fill="${sleeves}" stroke="${edge}" stroke-width="1.6"/>`).join('') : '');
    const num = (n, fill, edge) => `<text x="50" y="${ty + th * 0.7}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${th > 25 ? 12.5 : 10}" fill="${fill}" stroke="${edge}" stroke-width="1.1" paint-order="stroke">${n}</text>`;
    const armStripe = (c) => arms ? `<path d="M22 ${H.y + H.h + 19} h7 M71 ${H.y + H.h + 19} h7" stroke="${c}" stroke-width="2.4"/>` : '';
    switch (a.outfit) {
      case 'hoops23': o.push(suit('#552583', '#2e1065') + `<path d="M43 ${ty} q7 9 14 0" fill="none" stroke="#fdb927" stroke-width="2.6"/>` +
        `<path d="M${tx + 3} ${ty + 7} v${th - 12} M${tx + tw - 3} ${ty + 7} v${th - 12}" stroke="#fdb927" stroke-width="2.2"/>` + num('23', '#fdb927', '#fff')); break;
      case 'football': o.push(suit('#1e3a8a', '#0f172a', '#1e3a8a') + armStripe('#fff') +
        `<path d="M${tx - 6} ${ty + 10} q0 -10 11 -10 h${tw - 10} q11 0 11 10 z" fill="#1e40af" stroke="#0f172a" stroke-width="2"/>` + num('88', '#fff', '#0f172a')); break;
      case 'soccer': o.push(suit('#16a34a', '#14532d', '#16a34a') + [tx + 8, 50 - 2, tx + tw - 12].map((x) => `<rect x="${x}" y="${ty + 1}" width="4" height="${th - 2}" fill="#f0fdf4" opacity=".9"/>`).join('') +
        `<path d="M44 ${ty} q6 6 12 0" fill="none" stroke="#fff" stroke-width="2.4"/>` + num('10', '#fff', '#14532d') +
        `<g transform="translate(83 92)"><circle r="5.5" fill="#fff" stroke="#111827" stroke-width="1.2"/><path d="M0 -2.3 l2.2 1.6 -.8 2.6 h-2.8 l-.8 -2.6z" fill="#111827"/></g>`); break;
      case 'hockey': o.push(suit('#b91c1c', '#7f1d1d', '#b91c1c') + armStripe('#fff') +
        `<rect x="${tx + 1}" y="${ty + th - 9}" width="${tw - 2}" height="3" fill="#fff"/><rect x="${tx + 1}" y="${ty + th - 6}" width="${tw - 2}" height="2" fill="#1d4ed8"/>` + num('9', '#fff', '#7f1d1d') +
        `<path d="M86 ${ty - 6} L82 96 h-10" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M73 96 h5" stroke="#111827" stroke-width="3" stroke-linecap="round"/>`); break;
      case 'bat': o.push(suit('#4b5563', '#1f2937', '#374151') + `<rect x="${tx + 1}" y="${ty + th - 10}" width="${tw - 2}" height="5" fill="#facc15" stroke="#a16207" stroke-width=".8"/>` +
        `<rect x="47" y="${ty + th - 10.5}" width="6" height="6" rx="1" fill="#fde047" stroke="#a16207" stroke-width=".8"/>`); break;
      case 'cat': o.push(suit('#111827', '#000', '#111827') + `<rect x="${tx + 5}" y="${ty}" width="${tw - 10}" height="4" rx="2" fill="#ec4899"/><circle cx="50" cy="${ty + 6}" r="2.4" fill="#facc15" stroke="#a16207" stroke-width=".7"/>`); break;
      case 'astronaut': o.push(suit('#f8fafc', '#94a3b8', '#f1f5f9') + armStripe('#ef4444') +
        `<rect x="43" y="${ty + 7}" width="14" height="9" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/><circle cx="47" cy="${ty + 11.5}" r="1.6" fill="#ef4444"/><circle cx="53" cy="${ty + 11.5}" r="1.6" fill="#22c55e"/>` +
        `<circle cx="${tx + 7}" cy="${ty + 6}" r="3.4" fill="#1d4ed8" stroke="#fff" stroke-width=".8"/><path d="M${tx + 7} ${ty + 3.8} l.7 1.5 1.6 .1 -1.2 1 .4 1.6 -1.5 -.9 -1.5 .9 .4 -1.6 -1.2 -1 1.6 -.1z" fill="#fff"/>`); break;
      case 'ninja': o.push(suit('#111827', '#000', '#111827') + `<rect x="${tx + 1}" y="${ty + th - 11}" width="${tw - 2}" height="4" fill="#dc2626"/><path d="M58 ${ty + th - 9} l5 8 M60 ${ty + th - 9} l1 9" stroke="#dc2626" stroke-width="2"/>`); break;
      case 'pirate': o.push(suit('#fff', '#7f1d1d', '#dc2626') + [5, 12, 19].map((k) => `<rect x="${tx + 1}" y="${ty + k}" width="${tw - 2}" height="3.5" fill="#dc2626"/>`).join('') +
        `<path d="M${tx + 2} ${ty + 4} L${tx + tw - 2} ${ty + th - 4}" stroke="#111827" stroke-width="4"/><rect x="47" y="${ty + 12}" width="6" height="5" fill="#facc15" stroke="#a16207" stroke-width=".7" transform="rotate(40 50 ${ty + 14.5})"/>`); break;
      case 'dino': o.push(suit('#4ade80', '#15803d', '#4ade80') + `<ellipse cx="50" cy="${ty + th / 2 + 1}" rx="${tw / 2 - 7}" ry="${th / 2 - 5}" fill="#bbf7d0"/>` +
        [0, 1, 2].map((k) => `<path d="M${tx + 8 + k * 10} ${ty + th / 2 - 2} q4 3 8 0" fill="none" stroke="#86efac" stroke-width="1.6"/>`).join('')); break;
      case 'tux': o.push(suit('#111827', '#000', '#111827') + `<path d="M43 ${ty} L50 ${ty + 18} L57 ${ty} Z" fill="#fff"/>` +
        `<path d="M43 ${ty} L50 ${ty + 18} L45 ${ty + 20} L40 ${ty + 3} Z M57 ${ty} L50 ${ty + 18} L55 ${ty + 20} L60 ${ty + 3} Z" fill="#1f2937" stroke="#000" stroke-width=".8"/>` +
        `<path d="M50 ${ty + 3} l-5 -3 v6 z M50 ${ty + 3} l5 -3 v6 z" fill="#111827"/><circle cx="50" cy="${ty + 10}" r=".9" fill="#111827"/><circle cx="50" cy="${ty + 14}" r=".9" fill="#111827"/>` +
        `<circle cx="${tx + tw - 7}" cy="${ty + 7}" r="2.2" fill="#ef4444"/>`); break;
      case 'chef': o.push(suit('#fff', '#94a3b8', '#fff') + `<path d="M44 ${ty} l6 6 l6 -6 z" fill="#ef4444"/>` +
        [44, 56].map((x) => [10, 16, 22].map((y) => `<circle cx="${x}" cy="${ty + y}" r="1.3" fill="#94a3b8"/>`).join('')).join('')); break;
    }
    // antenna
    const top = H.y;
    switch (a.antenna) {
      case 'ball': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 9}" stroke="${ink}" stroke-width="2"/><circle cx="${cx}" cy="${top - 11}" r="3.6" fill="#f43f5e"/>`); break;
      case 'double': o.push(`<path d="M${cx - 9} ${top} l-4 -10 M${cx + 9} ${top} l4 -10" stroke="${ink}" stroke-width="2"/><circle cx="${cx - 13}" cy="${top - 11}" r="3" fill="#facc15"/><circle cx="${cx + 13}" cy="${top - 11}" r="3" fill="#facc15"/>`); break;
      case 'bolt': o.push(`<path d="M${cx + 1} ${top - 16} l-6 9 h5 l-3 8 l8 -10 h-5 l3 -7 z" fill="#facc15" stroke="#a16207" stroke-width="1"/>`); break;
      case 'dish': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 6}" stroke="${ink}" stroke-width="2"/><path d="M${cx - 9} ${top - 13} a9 6 0 0 0 18 0 z" fill="#e2e8f0" stroke="${ink}" stroke-width="1.5"/><circle cx="${cx}" cy="${top - 12}" r="1.5" fill="${ink}"/>`); break;
      case 'flower': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 10}" stroke="#15803d" stroke-width="2"/>` + [0, 72, 144, 216, 288].map((d) => `<circle cx="${cx + 4.5 * Math.cos(d * Math.PI / 180)}" cy="${top - 13 + 4.5 * Math.sin(d * Math.PI / 180)}" r="3.2" fill="#f472b6"/>`).join('') + `<circle cx="${cx}" cy="${top - 13}" r="2.6" fill="#facc15"/>`); break;
      case 'wifi': o.push(`<circle cx="${cx}" cy="${top - 3}" r="2.2" fill="${ink}"/><path d="M${cx - 6} ${top - 7} a8 8 0 0 1 12 0 M${cx - 10} ${top - 11} a14 14 0 0 1 20 0" fill="none" stroke="#38bdf8" stroke-width="2.4" stroke-linecap="round"/>`); break;
      case 'led': o.push(`<line x1="${cx - 2}" y1="${top}" x2="${cx - 2}" y2="${top - 6}" stroke="#94a3b8" stroke-width="1.6"/><line x1="${cx + 2}" y1="${top}" x2="${cx + 2}" y2="${top - 6}" stroke="#94a3b8" stroke-width="1.6"/><circle cx="${cx}" cy="${top - 11}" r="8" fill="#ef4444" opacity=".25"/><path d="M${cx - 5} ${top - 6} v-6 a5 5 0 0 1 10 0 v6 z" fill="#ef4444" stroke="#991b1b" stroke-width="1.2"/><circle cx="${cx - 1.5}" cy="${top - 12}" r="1.4" fill="#fff" opacity=".8"/>`); break;
      case 'flag': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 17}" stroke="${ink}" stroke-width="2"/>` + [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${cx + 1 + (i % 3) * 4.5}" y="${top - 17 + Math.floor(i / 3) * 4.5}" width="4.5" height="4.5" fill="${(i + Math.floor(i / 3)) % 2 ? '#fff' : '#111827'}" stroke="#111827" stroke-width=".4"/>`).join('')); break;
      case 'halo': o.push(`<ellipse cx="${cx}" cy="${top - 8}" rx="15" ry="4" fill="none" stroke="#facc15" stroke-width="3"/><ellipse cx="${cx}" cy="${top - 8}" rx="15" ry="4" fill="none" stroke="#fef9c3" stroke-width="1"/>`); break;
      case 'propeller': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 8}" stroke="${ink}" stroke-width="2"/><ellipse cx="${cx - 8}" cy="${top - 9}" rx="8" ry="2.4" fill="#38bdf8"/><ellipse cx="${cx + 8}" cy="${top - 9}" rx="8" ry="2.4" fill="#f472b6"/><circle cx="${cx}" cy="${top - 9}" r="2" fill="${ink}"/>`); break;
    }
    // head + face plate
    o.push(`<rect x="${H.x}" y="${H.y}" width="${H.w}" height="${H.h}" rx="${H.r}" fill="${F}" stroke="${dark}" stroke-width="2.2"/>`);
    o.push(`<rect x="${H.x + 6}" y="${H.y + 7}" width="${H.w - 12}" height="${H.h - 13}" rx="${Math.max(4, H.r - 4)}" fill="#eaf4ff" opacity=".92"/>`);
    // headphones band goes over the head
    if (a.accessory === 'headphones') o.push(`<path d="M${H.x - 2} ${H.y + H.h * 0.5} Q${cx} ${H.y - 22} ${H.x + H.w + 2} ${H.y + H.h * 0.5}" fill="none" stroke="#1f2937" stroke-width="3.5"/><rect x="${H.x - 7}" y="${H.y + H.h * 0.32}" width="9" height="16" rx="4" fill="#ef4444"/><rect x="${H.x + H.w - 2}" y="${H.y + H.h * 0.32}" width="9" height="16" rx="4" fill="#ef4444"/>`);
    // eyes
    const L = cx - ex, R = cx + ex;
    switch (a.eyes) {
      case 'dots': o.push(`<circle cx="${L}" cy="${eyeY}" r="2.6" fill="${ink}"/><circle cx="${R}" cy="${eyeY}" r="2.6" fill="${ink}"/>`); break;
      case 'visor': o.push(`<rect x="${H.x + 9}" y="${eyeY - 5}" width="${H.w - 18}" height="10" rx="5" fill="#0f172a"/><rect x="${L - 4}" y="${eyeY - 2}" width="8" height="4" rx="2" fill="#22d3ee"/><rect x="${R - 4}" y="${eyeY - 2}" width="8" height="4" rx="2" fill="#22d3ee"/>`); break;
      case 'cyclops': o.push(`<circle cx="${cx}" cy="${eyeY}" r="8" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${cx + 1.5}" cy="${eyeY}" r="4" fill="${ink}"/><circle cx="${cx + 3}" cy="${eyeY - 1.5}" r="1.3" fill="#fff"/>`); break;
      case 'hearts': [L, R].forEach((x) => o.push(`<path d="M${x} ${eyeY + 4} l-5 -5 a2.8 2.8 0 0 1 5 -3.5 a2.8 2.8 0 0 1 5 3.5 z" fill="#ef4444"/>`)); break;
      case 'leds': [L, R].forEach((x) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) o.push(`<rect x="${x + i * 3.2 - 1.2}" y="${eyeY + j * 3.2 - 1.2}" width="2.4" height="2.4" fill="${(i + j) % 2 ? '#7f1d1d' : '#ef4444'}"/>`); }); break;
      case 'happy': [L, R].forEach((x) => o.push(`<path d="M${x - 4} ${eyeY + 1.5} q4 -6 8 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`)); break;
      case 'shades': o.push(`<path d="M${L - 7} ${eyeY - 4} h14 v4 a6 6 0 0 1 -14 0 z M${R - 7} ${eyeY - 4} h14 v4 a6 6 0 0 1 -14 0 z" fill="#0f172a"/><line x1="${L + 7}" y1="${eyeY - 3}" x2="${R - 7}" y2="${eyeY - 3}" stroke="#0f172a" stroke-width="2"/><path d="M${L - 4} ${eyeY - 2} l3 0" stroke="#fff" stroke-width="1.2"/><path d="M${R - 4} ${eyeY - 2} l3 0" stroke="#fff" stroke-width="1.2"/>`); break;
      case 'sleepy': [L, R].forEach((x) => o.push(`<circle cx="${x}" cy="${eyeY}" r="5" fill="#fff" stroke="${ink}" stroke-width="1.8"/><circle cx="${x}" cy="${eyeY + 1.5}" r="2.2" fill="${ink}"/><path d="M${x - 5.6} ${eyeY} a5.6 5.6 0 0 1 11.2 0 z" fill="#cbd5e1" stroke="${ink}" stroke-width="1.4"/>`)); o.push(`<text x="${H.x + H.w - 3}" y="${H.y + 1}" font-size="8" font-weight="800" fill="${ink}" font-family="sans-serif">z</text>`); break;
      case 'angry': [L, R].forEach((x, i) => o.push(`<circle cx="${x}" cy="${eyeY + 1}" r="4.6" fill="#fff" stroke="${ink}" stroke-width="1.8"/><circle cx="${x}" cy="${eyeY + 1.5}" r="2.3" fill="${ink}"/><path d="M${x - 6} ${eyeY - (i ? 2 : 7)} L${x + 6} ${eyeY - (i ? 7 : 2)}" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`)); break;
      case 'laser': [L, R].forEach((x) => o.push(`<circle cx="${x}" cy="${eyeY}" r="7" fill="#ef4444" opacity=".3"/><circle cx="${x}" cy="${eyeY}" r="4.4" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.2"/><circle cx="${x}" cy="${eyeY}" r="1.6" fill="#fff"/><path d="M${x + 4} ${eyeY} L${x + 46} ${eyeY + 16}" stroke="#ef4444" stroke-width="1.6" opacity=".75"/>`)); break;
      case 'star': [L, R].forEach((x) => o.push(`<path d="M${x} ${eyeY - 6} l1.8 4 4.2 .4 -3.2 2.8 1 4.2 -3.8 -2.2 -3.8 2.2 1 -4.2 -3.2 -2.8 4.2 -.4z" fill="#facc15" stroke="#a16207" stroke-width=".8"/>`)); break;
      default: [L, R].forEach((x) => o.push(`<circle cx="${x}" cy="${eyeY}" r="5" fill="#fff" stroke="${ink}" stroke-width="1.8"/><circle cx="${x + 1}" cy="${eyeY + 0.5}" r="2.5" fill="${ink}"/>`));
    }
    // goggles over the eyes' forehead
    if (a.accessory === 'goggles') o.push(`<rect x="${H.x - 1}" y="${H.y + 4}" width="${H.w + 2}" height="4" fill="#1f2937"/><circle cx="${L}" cy="${H.y + 6}" r="5.5" fill="#bae6fd" stroke="#f59e0b" stroke-width="2"/><circle cx="${R}" cy="${H.y + 6}" r="5.5" fill="#bae6fd" stroke="#f59e0b" stroke-width="2"/>`);
    // mouth
    const mw = H.w * 0.18;
    switch (a.mouth) {
      case 'flat': o.push(`<line x1="${cx - mw}" y1="${mouthY}" x2="${cx + mw}" y2="${mouthY}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`); break;
      case 'open': o.push(`<ellipse cx="${cx}" cy="${mouthY}" rx="${mw * 0.6}" ry="4" fill="${ink}"/><ellipse cx="${cx}" cy="${mouthY + 2}" rx="${mw * 0.4}" ry="1.6" fill="#f87171"/>`); break;
      case 'grille': o.push(`<rect x="${cx - mw}" y="${mouthY - 3.5}" width="${mw * 2}" height="7" rx="2" fill="${ink}"/>` + [-0.5, 0, 0.5].map((k) => `<line x1="${cx + k * mw}" y1="${mouthY - 3.5}" x2="${cx + k * mw}" y2="${mouthY + 3.5}" stroke="#94a3b8" stroke-width="1"/>`).join('')); break;
      case 'zigzag': o.push(`<path d="M${cx - mw} ${mouthY} l${mw / 2} -3 l${mw / 2} 3 l${mw / 2} -3 l${mw / 2} 3" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`); break;
      case 'fangs': o.push(`<path d="M${cx - mw} ${mouthY - 2} q${mw} 7 ${mw * 2} 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M${cx - mw * 0.6} ${mouthY} l1.6 4 1.6 -3.4 z M${cx + mw * 0.6} ${mouthY} l-1.6 4 -1.6 -3.4 z" fill="#fff" stroke="${ink}" stroke-width=".8"/>`); break;
      case 'tongue': o.push(`<path d="M${cx - mw} ${mouthY - 2} q${mw} 7 ${mw * 2} 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/><path d="M${cx - 1} ${mouthY + 1.2} h7 v4 a3.5 3.5 0 0 1 -7 0 z" fill="#fb7185" stroke="#9f1239" stroke-width=".9"/>`); break;
      case 'braces': o.push(`<path d="M${cx - mw} ${mouthY - 3} q${mw} 9 ${mw * 2} 0 z" fill="#fff" stroke="${ink}" stroke-width="2"/><path d="M${cx - mw * 0.8} ${mouthY - 0.6} h${mw * 1.6}" stroke="#64748b" stroke-width="1.2"/>` + [-0.5, 0, 0.5].map((k) => `<rect x="${cx + k * mw - 1.2}" y="${mouthY - 1.9}" width="2.4" height="2.6" fill="#38bdf8" stroke="#0369a1" stroke-width=".5"/>`).join('')); break;
      case 'speaker': o.push(`<rect x="${cx - mw}" y="${mouthY - 4}" width="${mw * 2}" height="8" rx="4" fill="${ink}"/>` + [-0.6, -0.2, 0.2, 0.6].map((k) => `<circle cx="${cx + k * mw}" cy="${mouthY}" r="1.3" fill="#94a3b8"/>`).join('')); break;
      case 'mustache': o.push(`<path d="M${cx} ${mouthY - 3} c-3 -3 -9 -3 -12 1 c3 0 5 2 7 2 c2 0 4 -1 5 -3 c1 2 3 3 5 3 c2 0 4 -2 7 -2 c-3 -4 -9 -4 -12 -1z" fill="#3f2a14"/>`); break;
      default: o.push(`<path d="M${cx - mw} ${mouthY - 2} q${mw} 7 ${mw * 2} 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`);
    }
    // face extras
    const brown = '#5b3a1e', mx = () => `translate(${2 * cx} 0) scale(-1 1)`;
    switch (a.face) {
      case 'rosy': [L - 3, R + 3].forEach((x) => o.push(`<ellipse cx="${x}" cy="${mouthY - 3}" rx="4.4" ry="2.6" fill="#f472b6" opacity=".55"/>`)); break;
      case 'freckles': [L, R].forEach((x) => [[-3, 7], [0, 9], [3, 7], [-1.5, 11], [1.5, 11]].forEach(([dx, dy]) => o.push(`<circle cx="${x + dx}" cy="${eyeY + dy}" r=".9" fill="#b45309"/>`))); break;
      case 'eyeblack': [L, R].forEach((x) => o.push(`<rect x="${x - 5}" y="${eyeY + 6.5}" width="10" height="2.8" rx="1" fill="#111827"/>`)); break;
      case 'clownnose': o.push(`<circle cx="${cx}" cy="${(eyeY + mouthY) / 2 + 1}" r="4.2" fill="#ef4444" stroke="#991b1b" stroke-width=".8"/><circle cx="${cx - 1.3}" cy="${(eyeY + mouthY) / 2 - 0.3}" r="1.2" fill="#fff" opacity=".8"/>`); break;
      case 'glasses': o.push(`<g fill="#e0f2fe" fill-opacity=".25" stroke="${ink}" stroke-width="1.8"><circle cx="${L}" cy="${eyeY}" r="6.6"/><circle cx="${R}" cy="${eyeY}" r="6.6"/></g>` +
        `<path d="M${L + 6.6} ${eyeY - 1} q${ex - 6.6} -3 ${2 * ex - 13.2} 0 M${L - 6.6} ${eyeY - 1} H${H.x + 2} M${R + 6.6} ${eyeY - 1} H${H.x + H.w - 2}" fill="none" stroke="${ink}" stroke-width="1.6"/>`); break;
      case 'monocle': o.push(`<circle cx="${R}" cy="${eyeY}" r="6.8" fill="#fff" fill-opacity=".2" stroke="#ca8a04" stroke-width="2.2"/>` +
        `<path d="M${R + 4} ${eyeY + 5.5} Q${R + 9} ${mouthY + 4} ${H.x + H.w - 3} ${H.y + H.h + 4}" fill="none" stroke="#ca8a04" stroke-width="1" stroke-dasharray="1.6 1"/>`); break;
      case 'eyepatch': o.push(onHead(`<path d="M${H.x - 2} ${eyeY - 10} L${H.x + H.w + 2} ${eyeY - 2}" stroke="#111827" stroke-width="1.6"/>`) +
        `<ellipse cx="${L}" cy="${eyeY}" rx="7" ry="6" fill="#111827"/>`); break;
      case 'sideburns': o.push(onHead(`<rect x="${H.x - 1}" y="${eyeY - 3}" width="7" height="${mouthY - eyeY + 6}" rx="3" fill="${brown}"/><rect x="${H.x + H.w - 6}" y="${eyeY - 3}" width="7" height="${mouthY - eyeY + 6}" rx="3" fill="${brown}"/>`)); break;
      case 'goatee': o.push(`<path d="M${cx - 5} ${mouthY + 3.5} Q${cx} ${mouthY + 15} ${cx + 5} ${mouthY + 3.5} Q${cx} ${mouthY + 6} ${cx - 5} ${mouthY + 3.5} Z" fill="${brown}"/>`); break;
      case 'handlebar': {
        const half = `M${cx} ${mouthY - 3} C${cx - 3} ${mouthY - 6.5} ${cx - 9} ${mouthY - 5.5} ${cx - 11} ${mouthY - 2.5} C${cx - 12.5} ${mouthY - 0.5} ${cx - 15} ${mouthY - 1.5} ${cx - 14.5} ${mouthY - 5} ` +
          `C${cx - 17} ${mouthY + 0.5} ${cx - 11.5} ${mouthY + 2} ${cx - 8} ${mouthY - 0.5} C${cx - 5} ${mouthY - 1.5} ${cx - 2} ${mouthY - 1.5} ${cx} ${mouthY - 1} Z`;
        o.push(`<path d="${half}" fill="#3f2a14"/><path d="${half}" fill="#3f2a14" transform="${mx()}"/>`); break;
      }
      case 'beard': o.push(`<path fill-rule="evenodd" d="M${H.x + 3} ${eyeY + 5} Q${H.x + 3} ${H.y + H.h + 9} ${cx} ${H.y + H.h + 13} Q${H.x + H.w - 3} ${H.y + H.h + 9} ${H.x + H.w - 3} ${eyeY + 5} ` +
        `Q${H.x + H.w - 8} ${eyeY + 9} ${cx} ${mouthY - 7} Q${H.x + 8} ${eyeY + 9} ${H.x + 3} ${eyeY + 5} Z M${cx - mw - 3} ${mouthY} a${mw + 3} 4.6 0 1 0 ${2 * mw + 6} 0 a${mw + 3} 4.6 0 1 0 ${-2 * mw - 6} 0 Z" fill="${brown}" stroke="#3f2a14" stroke-width=".8"/>`); break;
      case 'wizardbeard': o.push(`<path fill-rule="evenodd" d="M${H.x + 5} ${eyeY + 6} Q${H.x + 4} ${H.y + H.h + 14} ${cx} ${H.y + H.h + 30} Q${H.x + H.w - 4} ${H.y + H.h + 14} ${H.x + H.w - 5} ${eyeY + 6} ` +
        `Q${cx} ${mouthY - 9} ${H.x + 5} ${eyeY + 6} Z M${cx - mw - 2} ${mouthY} a${mw + 2} 4.2 0 1 0 ${2 * mw + 4} 0 a${mw + 2} 4.2 0 1 0 ${-2 * mw - 4} 0 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>` +
        `<path d="M${cx - 6} ${H.y + H.h + 4} q2 6 0 12 M${cx + 6} ${H.y + H.h + 4} q-2 6 0 12 M${cx} ${H.y + H.h + 8} v14" fill="none" stroke="#cbd5e1" stroke-width="1"/>`); break;
    }
    // costume headwear: helmets, hoods, masks and ears
    const shell = (fill, edge, flap) => onHead(`<path d="M${H.x - 2} ${H.y - 2} H${H.x + H.w + 2} V${H.y + H.h * flap} H${H.x + H.w - 6} V${eyeY - 7} H${H.x + 6} V${H.y + H.h * flap} H${H.x - 2} Z" fill="${fill}" stroke="${edge}" stroke-width="1.6"/>`);
    switch (a.outfit) {
      case 'football': o.push(shell('#1e40af', '#0f172a', 0.82) + onHead(`<rect x="${cx - 2.5}" y="${H.y - 2}" width="5" height="${eyeY - 7 - H.y + 2}" fill="#fff"/>`) +
        `<path d="M${H.x + 5} ${mouthY - 5} H${H.x + H.w - 5} M${H.x + 7} ${mouthY + 3} H${H.x + H.w - 7} M${cx - 6} ${mouthY - 5} V${mouthY + 3} M${cx + 6} ${mouthY - 5} V${mouthY + 3}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>`); break;
      case 'hockey': o.push(shell('#111827', '#000', 0.6) +
        onHead(`<g stroke="#cbd5e1" stroke-width=".9" opacity=".75">` + [-2, -1, 0, 1, 2].map((k) => `<line x1="${cx + k * 7}" y1="${eyeY - 7}" x2="${cx + k * 7}" y2="${H.y + H.h}"/>`).join('') +
          [0, 1].map((k) => `<line x1="${H.x + 5}" y1="${eyeY + 8 + k * 8}" x2="${H.x + H.w - 5}" y2="${eyeY + 8 + k * 8}"/>`).join('') + '</g>')); break;
      case 'bat': {
        const e1 = H.x + H.w * 0.24, e2 = H.x + H.w * 0.76;
        o.push(`<path d="M${e1 - 5} ${H.y + 4} L${e1 - 2} ${H.y - 11} L${e1 + 4} ${H.y + 4} Z M${e2 + 5} ${H.y + 4} L${e2 + 2} ${H.y - 11} L${e2 - 4} ${H.y + 4} Z" fill="#1f2937" stroke="#000" stroke-width="1"/>` +
          onHead(`<path fill-rule="evenodd" d="M${H.x - 2} ${H.y - 2} H${H.x + H.w + 2} V${H.y + H.h + 2} H${H.x + H.w - 7} V${eyeY + 9} H${H.x + 7} V${H.y + H.h + 2} H${H.x - 2} Z ` +
            `M${L - 8} ${eyeY - 6.5} H${R + 8} V${eyeY + 6.5} H${L - 8} Z" fill="#1f2937"/>`));
        break;
      }
      case 'cat': {
        const e1 = H.x + H.w * 0.2, e2 = H.x + H.w * 0.8;
        o.push(`<path d="M${e1 - 6} ${H.y + 5} L${e1 - 3} ${H.y - 10} L${e1 + 6} ${H.y + 2} Z M${e2 + 6} ${H.y + 5} L${e2 + 3} ${H.y - 10} L${e2 - 6} ${H.y + 2} Z" fill="#111827" stroke="#000" stroke-width="1"/>` +
          `<path d="M${e1 - 3} ${H.y + 1} L${e1 - 2} ${H.y - 5} L${e1 + 2} ${H.y + 1} Z M${e2 + 3} ${H.y + 1} L${e2 + 2} ${H.y - 5} L${e2 - 2} ${H.y + 1} Z" fill="#f9a8d4"/>` +
          `<path fill-rule="evenodd" d="M${L - 11} ${eyeY - 4} L${L - 4} ${eyeY - 7.5} H${R + 4} L${R + 11} ${eyeY - 4} L${R + 7} ${eyeY + 6} H${L - 7} Z M${L - 5} ${eyeY} a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z M${R - 5} ${eyeY} a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z" fill="#111827"/>` +
          `<path d="M${cx - 7} ${mouthY - 4} l-9 -2 M${cx - 7} ${mouthY - 2} h-10 M${cx + 7} ${mouthY - 4} l9 -2 M${cx + 7} ${mouthY - 2} h10" stroke="${ink}" stroke-width=".9" stroke-linecap="round"/>`);
        break;
      }
      case 'ninja': o.push(onHead(`<path fill-rule="evenodd" d="M${H.x - 2} ${H.y - 2} H${H.x + H.w + 2} V${H.y + H.h + 2} H${H.x - 2} Z M${H.x + 4} ${eyeY - 6.5} H${H.x + H.w - 4} V${eyeY + 6.5} H${H.x + 4} Z" fill="#111827"/>` +
        `<rect x="${H.x - 2}" y="${H.y + 4}" width="${H.w + 4}" height="4" fill="#dc2626"/>`) +
        `<path d="M${H.x + H.w - 1} ${H.y + 6} q7 0 10 6 M${H.x + H.w - 1} ${H.y + 6} q8 -3 12 1" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/>`); break;
      case 'astronaut': {
        const r = Math.max(H.w, H.h) / 2 + 7, cy = H.y + H.h / 2;
        o.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#bae6fd" fill-opacity=".22" stroke="#e2e8f0" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#64748b" stroke-width=".8"/>` +
          `<path d="M${cx - r * 0.65} ${cy - r * 0.35} a${r * 0.75} ${r * 0.75} 0 0 1 ${r * 0.45} ${-r * 0.42}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`);
        break;
      }
      case 'pirate': o.push(`<path d="M${cx - 24} ${H.y + 3} Q${cx} ${H.y - 6} ${cx + 24} ${H.y + 3} Q${cx + 16} ${H.y - 22} ${cx} ${H.y - 15} Q${cx - 16} ${H.y - 22} ${cx - 24} ${H.y + 3} Z" fill="#111827" stroke="#facc15" stroke-width="1.2"/>` +
        `<circle cx="${cx}" cy="${H.y - 8}" r="3" fill="#fff"/><rect x="${cx - 1.8}" y="${H.y - 6}" width="3.6" height="2.4" fill="#fff"/><circle cx="${cx - 1}" cy="${H.y - 8.3}" r=".7" fill="#111827"/><circle cx="${cx + 1}" cy="${H.y - 8.3}" r=".7" fill="#111827"/>`); break;
      case 'dino': o.push(`<g fill="#f97316" stroke="#c2410c" stroke-width=".9" stroke-linejoin="round">` + [-2, -1, 0, 1, 2].map((k) => `<path d="M${cx + k * 8 - 4} ${H.y + 2} L${cx + k * 8} ${H.y - 8 + Math.abs(k) * 2} L${cx + k * 8 + 4} ${H.y + 2} Z"/>`).join('') + '</g>' +
        onHead(`<rect x="${H.x - 2}" y="${H.y - 2}" width="${H.w + 4}" height="7" fill="#4ade80"/><path d="M${H.x - 2} ${H.y + 5} H${H.x + H.w + 2}" stroke="#15803d" stroke-width="1.4"/>`)); break;
      case 'chef': o.push(`<rect x="${cx - 13}" y="${H.y - 7}" width="26" height="9" rx="2" fill="#fff" stroke="#cbd5e1" stroke-width="1.2"/>` +
        [[-9, -12, 7], [0, -16, 8], [9, -12, 7]].map(([dx, dy, r]) => `<circle cx="${cx + dx}" cy="${H.y + dy}" r="${r}" fill="#fff" stroke="#cbd5e1" stroke-width="1.2"/>`).join('') +
        `<rect x="${cx - 12}" y="${H.y - 9}" width="24" height="5" fill="#fff"/>`); break;
    }
    // hats & neckwear
    if (a.accessory === 'bowtie') o.push(`<path d="M50 ${H.y + H.h + 5} l-8 -5 v10 z M50 ${H.y + H.h + 5} l8 -5 v10 z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1"/><circle cx="50" cy="${H.y + H.h + 5}" r="2.2" fill="#b91c1c"/>`);
    if (a.accessory === 'cap') o.push(`<path d="M${H.x + 4} ${H.y + 3} a${H.w / 2 - 4} 13 0 0 1 ${H.w - 8} 0 z" fill="#2563eb"/><rect x="${cx}" y="${H.y}" width="${H.w / 2 + 6}" height="4" rx="2" fill="#1d4ed8"/><circle cx="${cx}" cy="${H.y - 9}" r="1.8" fill="#facc15"/>`);
    if (a.accessory === 'crown') o.push(`<path d="M${cx - 14} ${H.y + 2} l0 -12 l7 6 l7 -10 l7 10 l7 -6 l0 12 z" fill="#facc15" stroke="#a16207" stroke-width="1.4"/><circle cx="${cx}" cy="${H.y - 4}" r="1.8" fill="#ef4444"/>`);
    if (a.accessory === 'tie') o.push(`<path d="M50 ${H.y + H.h + 2} l-3.5 3.5 l3.5 3.5 l3.5 -3.5 z" fill="#1d4ed8"/><path d="M50 ${H.y + H.h + 9} l-4 14 l4 5 l4 -5 z" fill="#2563eb" stroke="#1e3a8a" stroke-width=".8"/>`);
    if (a.accessory === 'tophat') o.push(`<ellipse cx="${cx}" cy="${H.y + 2}" rx="20" ry="3.6" fill="#111827"/><rect x="${cx - 12}" y="${H.y - 19}" width="24" height="21" rx="2" fill="#1f2937"/><rect x="${cx - 12}" y="${H.y - 5}" width="24" height="4" fill="#dc2626"/>`);
    if (a.accessory === 'medal') o.push(`<path d="M44 ${H.y + H.h + 1} l6 12 l6 -12" fill="none" stroke="#2563eb" stroke-width="3"/><circle cx="50" cy="${H.y + H.h + 17}" r="6" fill="#facc15" stroke="#a16207" stroke-width="1.4"/><text x="50" y="${H.y + H.h + 19.6}" text-anchor="middle" font-size="7" font-weight="800" fill="#a16207" font-family="sans-serif">1</text>`);
    if (a.accessory === 'helmet') o.push(`<path d="M${H.x - 3} ${H.y + H.h * 0.3} a${H.w / 2 + 3} ${H.h * 0.55} 0 0 1 ${H.w + 6} 0 v-2 z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.6"/><path d="M${cx - 3} ${H.y - H.h * 0.22} h6 v${H.h * 0.5} h-6 z" fill="#fff"/><rect x="${H.x - 3}" y="${H.y + H.h * 0.26}" width="${H.w + 6}" height="4" rx="2" fill="#111827"/>`);
    if (a.accessory === 'scarf') o.push(`<rect x="${50 - 21}" y="${H.y + H.h - 1}" width="42" height="8" rx="4" fill="#dc2626"/><rect x="58" y="${H.y + H.h + 4}" width="7" height="16" rx="2" fill="#b91c1c"/><path d="M${50 - 15} ${H.y + H.h + 3} h30" stroke="#fef2f2" stroke-width="1.2" stroke-dasharray="3 3"/>`);
    if (a.accessory === 'wizard') o.push(`<path d="M${cx - 16} ${H.y + 3} L${cx + 2} ${H.y - 26} L${cx + 16} ${H.y + 3} z" fill="#4338ca" stroke="#312e81" stroke-width="1.4"/><ellipse cx="${cx}" cy="${H.y + 3}" rx="19" ry="3.6" fill="#3730a3"/><path d="M${cx - 4} ${H.y - 10} l1.4 3 3.2 .3 -2.4 2 .8 3 -3 -1.6 -3 1.6 .8 -3 -2.4 -2 3.2 -.3z" fill="#facc15"/>`);
    if (a.accessory === 'cowboy') o.push(`<path d="M${cx - 12} ${H.y + 1} Q${cx - 14} ${H.y - 15} ${cx - 6} ${H.y - 15} Q${cx} ${H.y - 11} ${cx + 6} ${H.y - 15} Q${cx + 14} ${H.y - 15} ${cx + 12} ${H.y + 1} Z" fill="#b45309" stroke="#78350f" stroke-width="1.2"/>` +
      `<rect x="${cx - 12}" y="${H.y - 4}" width="24" height="3.5" fill="#451a03"/><path d="M${cx - 27} ${H.y - 5} Q${cx} ${H.y + 9} ${cx + 27} ${H.y - 5} Q${cx} ${H.y + 3} ${cx - 27} ${H.y - 5} Z" fill="#92400e" stroke="#78350f" stroke-width="1.2"/>`);
    if (a.accessory === 'fedora') o.push(`<ellipse cx="${cx}" cy="${H.y + 2}" rx="22" ry="3.8" fill="#374151"/><path d="M${cx - 13} ${H.y + 2} L${cx - 11} ${H.y - 13} Q${cx} ${H.y - 8} ${cx + 11} ${H.y - 13} L${cx + 13} ${H.y + 2} Z" fill="#4b5563" stroke="#1f2937" stroke-width="1"/>` +
      `<rect x="${cx - 12.4}" y="${H.y - 3.5}" width="24.8" height="4" fill="#111827"/><path d="M${cx + 7} ${H.y - 3.5} l3 -5" stroke="#ef4444" stroke-width="1.6"/>`);
    if (a.accessory === 'beanie') o.push(`<path d="M${H.x + 3} ${H.y + 5} a${H.w / 2 - 3} 15 0 0 1 ${H.w - 6} 0 z" fill="#f97316"/><rect x="${H.x + 1}" y="${H.y + 1}" width="${H.w - 2}" height="7" rx="3.5" fill="#ea580c"/>` +
      `<path d="M${H.x + 6} ${H.y + 4.5} H${H.x + H.w - 6}" stroke="#fdba74" stroke-width="1" stroke-dasharray="2 2"/><circle cx="${cx}" cy="${H.y - 11}" r="4.4" fill="#fde68a" stroke="#f59e0b" stroke-width=".8"/>`);
    if (a.accessory === 'party') o.push(`<path d="M${cx - 10} ${H.y + 3} L${cx + 1} ${H.y - 23} L${cx + 10} ${H.y + 3} Z" fill="#ec4899" stroke="#9d174d" stroke-width="1"/>` +
      `<g fill="#fde047"><circle cx="${cx - 3}" cy="${H.y - 3}" r="1.6"/><circle cx="${cx + 4}" cy="${H.y - 8}" r="1.4"/><circle cx="${cx - 1}" cy="${H.y - 13}" r="1.2"/></g><circle cx="${cx + 1}" cy="${H.y - 24}" r="3" fill="#22d3ee"/>`);
    if (a.accessory === 'viking') o.push(`<path d="M${H.x + 6} ${H.y + 1} q-11 -3 -10 -19 q4 10 14 12 z M${H.x + H.w - 6} ${H.y + 1} q11 -3 10 -19 q-4 10 -14 12 z" fill="#fef3c7" stroke="#a8a29e" stroke-width="1"/>` +
      `<path d="M${H.x + 4} ${H.y + 6} a${H.w / 2 - 4} 15 0 0 1 ${H.w - 8} 0 z" fill="#9ca3af" stroke="#4b5563" stroke-width="1.2"/><rect x="${H.x + 3}" y="${H.y + 2}" width="${H.w - 6}" height="5" rx="2" fill="#ca8a04" stroke="#854d0e" stroke-width=".8"/>` +
      `<path d="M${cx - 2} ${H.y - 9} h4 v10 h-4z" fill="#ca8a04"/>`);
    if (a.accessory === 'sweatband') o.push(onHead(`<rect x="${H.x - 2}" y="${H.y + 3}" width="${H.w + 4}" height="6" fill="#fff"/><rect x="${H.x - 2}" y="${H.y + 5}" width="${H.w + 4}" height="2" fill="#ef4444"/>`));
    o.push('</g></svg>');
    return o.join('');
  }

  function renderAll(root) {
    (root || document).querySelectorAll('[data-avatar]').forEach((el) => {
      let spec = {};
      try { spec = JSON.parse(el.dataset.avatar || '{}'); } catch (e) { /* default */ }
      el.innerHTML = svg(spec, el.dataset.size || 48);
    });
  }

  /** A student's calling card (the title under their name) as HTML, or '' if they wear none. */
  function card(spec, cls) {
    if (!spec || !spec.card_text) return '';
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<span class="call-card s-${esc(spec.card_style || 'plain')}${cls ? ' ' + cls : ''}">${esc(spec.card_text)}</span>`;
  }

  window.RobotAvatar = { svg, renderAll, card };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => renderAll());
  else renderAll();
})();
