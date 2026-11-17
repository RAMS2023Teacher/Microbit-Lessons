/* Robot avatar renderer. Part ids must match AVATAR_OPTIONS in app/gamify.py.
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
  };
  const BG = { sky: '#bfe3ff', mint: '#c7f5df', sun: '#ffe9a8', lilac: '#e3d7ff', night: '#1e2a55', circuit: '#0f3d3a', stars: '#0b1026', ocean: '#0e7490', lava: '#431407', rainbow: '#fff' };
  const HEADS = {
    box: { x: 25, y: 20, w: 50, h: 40, r: 8 },
    round: { x: 24, y: 18, w: 52, h: 42, r: 21 },
    tall: { x: 31, y: 12, w: 38, h: 48, r: 10 },
    tank: { x: 20, y: 24, w: 60, h: 34, r: 7 },
    hover: { x: 26, y: 18, w: 48, h: 40, r: 16 },
  };
  const DEFAULT = { body: 'box', color: 'teal', eyes: 'round', mouth: 'smile', antenna: 'ball', accessory: 'none', bg: 'sky' };

  // opts.noBg: just the robot, no background square (used by Robot Rush)
  function svg(spec, size, opts) {
    const a = Object.assign({}, DEFAULT, spec || {}), noBg = !!(opts && opts.noBg);
    if (noBg) a.bg = 'none';
    const id = 'av' + (++uid);
    const [fill, dark] = COLORS[a.color] || COLORS.teal;
    const F = fill.replace('CHROME', id + 'c').replace('GOLD', id + 'g').replace('GALAXY', id + 'x');
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
      `<clipPath id="${id}clip"><rect width="100" height="100" rx="22"/></clipPath></defs>`);
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
    o.push(`<rect x="${tx}" y="${H.y + H.h + 2}" width="${tw}" height="${a.body === 'tank' ? 22 : 30}" rx="7" fill="${F}" stroke="${dark}" stroke-width="2"/>`);
    o.push(`<rect x="44" y="${H.y + H.h + 8}" width="12" height="8" rx="2" fill="${ink}" opacity=".8"/><circle cx="47" cy="${H.y + H.h + 12}" r="1.4" fill="#4ade80"/><circle cx="53" cy="${H.y + H.h + 12}" r="1.4" fill="#f87171"/>`);
    if (a.body === 'tank') {
      o.push(`<rect x="18" y="80" width="64" height="16" rx="8" fill="#334155"/>` + [26, 38, 50, 62, 74].map((x) => `<circle cx="${x}" cy="88" r="4.5" fill="#94a3b8" stroke="#1e293b"/>`).join(''));
    } else if (a.body === 'hover') {
      o.push(`<path d="M40 ${H.y + H.h + 32} q3 10 6 0 M54 ${H.y + H.h + 32} q3 10 6 0" fill="#fb923c" stroke="#fde047" stroke-width="1.5"/>`);
    } else {
      o.push(`<rect x="22" y="${H.y + H.h + 6}" width="7" height="20" rx="3.5" fill="${F}" stroke="${dark}" stroke-width="1.6"/><rect x="71" y="${H.y + H.h + 6}" width="7" height="20" rx="3.5" fill="${F}" stroke="${dark}" stroke-width="1.6"/>`);
    }
    // antenna
    const top = H.y;
    switch (a.antenna) {
      case 'ball': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 9}" stroke="${ink}" stroke-width="2"/><circle cx="${cx}" cy="${top - 11}" r="3.6" fill="#f43f5e"/>`); break;
      case 'double': o.push(`<path d="M${cx - 9} ${top} l-4 -10 M${cx + 9} ${top} l4 -10" stroke="${ink}" stroke-width="2"/><circle cx="${cx - 13}" cy="${top - 11}" r="3" fill="#facc15"/><circle cx="${cx + 13}" cy="${top - 11}" r="3" fill="#facc15"/>`); break;
      case 'bolt': o.push(`<path d="M${cx + 1} ${top - 16} l-6 9 h5 l-3 8 l8 -10 h-5 l3 -7 z" fill="#facc15" stroke="#a16207" stroke-width="1"/>`); break;
      case 'dish': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 6}" stroke="${ink}" stroke-width="2"/><path d="M${cx - 9} ${top - 13} a9 6 0 0 0 18 0 z" fill="#e2e8f0" stroke="${ink}" stroke-width="1.5"/><circle cx="${cx}" cy="${top - 12}" r="1.5" fill="${ink}"/>`); break;
      case 'flower': o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top - 10}" stroke="#15803d" stroke-width="2"/>` + [0, 72, 144, 216, 288].map((d) => `<circle cx="${cx + 4.5 * Math.cos(d * Math.PI / 180)}" cy="${top - 13 + 4.5 * Math.sin(d * Math.PI / 180)}" r="3.2" fill="#f472b6"/>`).join('') + `<circle cx="${cx}" cy="${top - 13}" r="2.6" fill="#facc15"/>`); break;
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
      case 'mustache': o.push(`<path d="M${cx} ${mouthY - 3} c-3 -3 -9 -3 -12 1 c3 0 5 2 7 2 c2 0 4 -1 5 -3 c1 2 3 3 5 3 c2 0 4 -2 7 -2 c-3 -4 -9 -4 -12 -1z" fill="#3f2a14"/>`); break;
      default: o.push(`<path d="M${cx - mw} ${mouthY - 2} q${mw} 7 ${mw * 2} 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`);
    }
    // hats & neckwear
    if (a.accessory === 'bowtie') o.push(`<path d="M50 ${H.y + H.h + 5} l-8 -5 v10 z M50 ${H.y + H.h + 5} l8 -5 v10 z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1"/><circle cx="50" cy="${H.y + H.h + 5}" r="2.2" fill="#b91c1c"/>`);
    if (a.accessory === 'cap') o.push(`<path d="M${H.x + 4} ${H.y + 3} a${H.w / 2 - 4} 13 0 0 1 ${H.w - 8} 0 z" fill="#2563eb"/><rect x="${cx}" y="${H.y}" width="${H.w / 2 + 6}" height="4" rx="2" fill="#1d4ed8"/><circle cx="${cx}" cy="${H.y - 9}" r="1.8" fill="#facc15"/>`);
    if (a.accessory === 'crown') o.push(`<path d="M${cx - 14} ${H.y + 2} l0 -12 l7 6 l7 -10 l7 10 l7 -6 l0 12 z" fill="#facc15" stroke="#a16207" stroke-width="1.4"/><circle cx="${cx}" cy="${H.y - 4}" r="1.8" fill="#ef4444"/>`);
    if (a.accessory === 'scarf') o.push(`<rect x="${50 - 21}" y="${H.y + H.h - 1}" width="42" height="8" rx="4" fill="#dc2626"/><rect x="58" y="${H.y + H.h + 4}" width="7" height="16" rx="2" fill="#b91c1c"/><path d="M${50 - 15} ${H.y + H.h + 3} h30" stroke="#fef2f2" stroke-width="1.2" stroke-dasharray="3 3"/>`);
    if (a.accessory === 'wizard') o.push(`<path d="M${cx - 16} ${H.y + 3} L${cx + 2} ${H.y - 26} L${cx + 16} ${H.y + 3} z" fill="#4338ca" stroke="#312e81" stroke-width="1.4"/><ellipse cx="${cx}" cy="${H.y + 3}" rx="19" ry="3.6" fill="#3730a3"/><path d="M${cx - 4} ${H.y - 10} l1.4 3 3.2 .3 -2.4 2 .8 3 -3 -1.6 -3 1.6 .8 -3 -2.4 -2 3.2 -.3z" fill="#facc15"/>`);
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

  window.RobotAvatar = { svg, renderAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => renderAll());
  else renderAll();
})();
