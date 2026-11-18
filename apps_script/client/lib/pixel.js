/* Pixel art for the skill tree: a lab that fills up and a robot that gets built as lessons are finished.
 *   PixelArt.sprite(key, { ghost, size })   one 12×12 gadget as SVG (ghost = grey silhouette of what's coming)
 *   PixelArt.lab({ items, done, current, color, total })   the whole lab scene as SVG
 *   PixelArt.spriteFor(lessonId, index)   which gadget a lesson earns
 * Everything is drawn from the little text pictures below: one letter = one pixel colour. */
(function () {
  'use strict';
  const P = { k: '#1d2a5c', w: '#f8fafc', g: '#94a3b8', G: '#475569', y: '#facc15', o: '#fb923c', r: '#ef4444', R: '#b91c1c',
              b: '#60a5fa', B: '#2563eb', e: '#4ade80', E: '#16a34a', p: '#f472b6', v: '#a78bfa', t: '#2dd4bf', n: '#a16207', c: '#67e8f9', s: '#fde68a' };
  const S = {
    microbit: ['kkkkkkkkkkkk', 'kEEEEEEEEEEk', 'kEkrEkrEkrEk', 'kEEEEEEEEEEk', 'kEkrEEEEkrEk', 'kEEkrrrrkEEk', 'kEEEEEEEEEEk', 'kyEyyEyyEyyk', 'kkkkkkkkkkkk'],
    lamp: ['....kkkk....', '...kyyyyk...', '..kyywyyyk..', '..kyywyyyk..', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '....kGGk....', '....kggk....', '....kGGk....', '.....kk.....'],
    traffic: ['...kkkkkk...', '...kGGGGk...', '...kGrrGk...', '...kGrrGk...', '...kGGGGk...', '...kGyyGk...', '...kGyyGk...', '...kGGGGk...', '...kGeeGk...', '...kGeeGk...', '...kGGGGk...', '....kggk....'],
    stopwatch: ['.....kk.....', '....kGGk....', '...kkkkkk...', '..kwwwwwwk..', '.kwwwkwwwwk.', '.kwwwkwwwwk.', '.kwwwkkkwwk.', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '..kwwwwwwk..', '...kkkkkk...'],
    note: ['.......kk...', '......kvvk..', '......kvkk..', '......kvk...', '......kvk...', '......kvk...', '...kkkkvk...', '..kvvvvvk...', '..kvvvvvk...', '...kvvvk....', '....kkk.....'],
    console: ['..kkkkkkkk..', '.kGGGGGGGGk.', '.kGbbbbbbGk.', '.kGbewbbbGk.', '.kGbbbbbbGk.', '.kGGGGGGGGk.', '.kGkGGGrGGk.', '.kkkkGGrrGk.', '.kGkGGGGrGk.', '.kGGGGGGGGk.', '..kkkkkkkk..'],
    moon: ['....kkk.....', '...kyyyk....', '..kyyk......', '..kyk.......', '..kyk.......', '..kyyk......', '...kyyyk....', '....kkkk....', '....kGGk....', '...kGGGGk...', '..kkkkkkkk..'],
    sonar: ['............', '.kkkkkkkkkk.', '.kBBBBBBBBk.', '.kBkkBBkkBk.', '.kkwgkkwgkk.', '.kkggkkggkk.', '.kBkkBBkkBk.', '.kBBBBBBBBk.', '.kkkkkkkkkk.', '...kk..kk...'],
    heart: ['............', '..kkk..kkk..', '.krrrkkrrrk.', '.krwrrrrrrk.', '.krrrrrrrrk.', '.krrrrrrrrk.', '..krrrrrrk..', '...krrrrk...', '....krrk....', '.....kk.....'],
    gear: ['....k..k....', '..kkGkkGkk..', '..kGGGGGGk..', '.kGGGkkGGGk.', '.kGGk..kGGk.', '.kGGk..kGGk.', '.kGGGkkGGGk.', '..kGGGGGGk..', '..kkGkkGkk..', '....k..k....'],
    eyes: ['............', '.kkkk..kkkk.', 'kccwckkccwck', 'kcccckkcccck', 'kckkckkckkck', 'kcccckkcccck', '.kkkk..kkkk.'],
    tower: ['.....kk.....', '....kyyk....', '..k..kk..k..', '.k.k.kk.k.k.', '..k..kk..k..', '.....kk.....', '....kGGk....', '....kGGk....', '...kGkkGk...', '...kGkkGk...', '..kGk..kGk..', '..kkk..kkk..'],
    rocket: ['.....kk.....', '....kwwk....', '....kwwk....', '...kwbbwk...', '...kwbbwk...', '...kwwwwk...', '..krkwwkrk..', '..krkwwkrk..', '..kk.kk.kk..', '....kook....', '.....oo.....', '.....y......'],
    film: ['kkkkkkkkkkkk', 'kGwGwGwGwGwk', 'kkkkkkkkkkkk', 'kbbbbbbbbbbk', 'kbbbbyybbbbk', 'kbbbyyyybbbk', 'kbbbbyybbbbk', 'kkkkkkkkkkkk', 'kGwGwGwGwGwk', 'kkkkkkkkkkkk'],
    dice: ['.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwkkwwwwkkwk', 'kwkkwwwwkkwk', 'kwwwwkkwwwwk', 'kwwwwkkwwwwk', 'kwkkwwwwkkwk', 'kwkkwwwwkkwk', 'kwwwwwwwwwwk', '.kkkkkkkkkk.'],
    shoe: ['............', '...kkkk.....', '...kbbbk....', '...kbwbk....', '...kbbbkkk..', '..kbbbbbbbk.', '.kbbbbbbbbk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.'],
    coin: ['............', '...kkkkkk...', '..kyyyyyyk..', '.kyywyyyyyk.', '.kyywyyoyyk.', '.kyyyyyoyyk.', '.kyyyyyoyyk.', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kkkkkk...'],
    fire: ['.....r......', '....rr..r...', '...rorr.rr..', '..rooorrorr.', '..royyoooor.', '.royyyyoyor.', '.royywyyyor.', '.rooyyyyoor.', '..rooooooor.', '...rrrrrrr..'],
    brain: ['............', '...kkkkkk...', '..kppkppppk.', '.kppkppkpppk', '.kpppppkpppk', '.kpkkppppkpk', '.kppppkppppk', '..kpppkpppk.', '...kkkkkkk..', '.....kk.....'],
    wand: ['.........y..', '........yyy.', '.........y..', '.......kk...', '......kvk...', '.....kvk....', '....kvk.....', '...kvk......', '..kvk.......', '..kk........'],
    dumbbell: ['............', '.kk......kk.', 'kGGk....kGGk', 'kGGkkkkkkGGk', 'kGGkggggkGGk', 'kGGkkkkkkGGk', 'kGGk....kGGk', '.kk......kk.'],
    joystick: ['....kkk.....', '...krrrk....', '...krrrk....', '....kGk.....', '....kGk.....', '..kkkGkkk...', '.kGGGGGGGk..', '.kGrGGGbGk..', '.kGGGGGGGk..', '..kkkkkkk...'],
    trophy: ['.kkkkkkkkkk.', 'kyyyyyyyyyyk', 'kykyyyyyykyk', 'kykyywyyykyk', '.kkyyyyyykk.', '...kyyyyk...', '....kyyk....', '....kyyk....', '...kkkkkk...', '..knnnnnnk..', '..kkkkkkkk..'],
  };
  const FOR = {
    'name-badge': 'microbit', 'blink-an-led': 'lamp', 'traffic-light': 'traffic', 'reaction-game': 'stopwatch', 'making-music': 'note',
    'dodge-the-drop': 'console', 'night-light': 'moon', 'distance-detector': 'sonar', 'heartbeat-monitor': 'heart', 'servo-robot': 'gear',
    'robot-eyes': 'eyes', 'radio-messenger': 'tower', 'invent-it': 'rocket',
    'hello-microbit': 'microbit', 'animate-it': 'film', 'rock-paper-scissors': 'dice', 'step-counter': 'shoe', 'coin-catcher': 'coin',
    'radio-hot-potato': 'fire', 'how-machines-learn': 'brain', 'ai-gesture-remote': 'wand', 'ai-fitness-coach': 'dumbbell', 'game-jam': 'joystick',
  };
  const NAMES = { microbit: 'micro:bit', lamp: 'Desk lamp', traffic: 'Traffic light', stopwatch: 'Stopwatch', note: 'Music note', console: 'Game console',
    moon: 'Moon lamp', sonar: 'Sonar sensor', heart: 'Heart monitor', gear: 'Servo gear', eyes: 'Robot eyes', tower: 'Radio tower', rocket: 'Rocket',
    film: 'Film reel', dice: 'Lucky dice', shoe: 'Sneaker', coin: 'Gold coin', fire: 'Hot potato', brain: 'AI brain', wand: 'Magic wand',
    dumbbell: 'Dumbbell', joystick: 'Joystick', trophy: 'Trophy' };
  const PARTS = ['wheels', 'legs', 'body', 'left arm', 'right arm', 'chest panel', 'neck', 'head', 'face plate', 'eyes', 'smile', 'antenna', 'sparkle'];
  /** Which robot part finishing lesson number k (1..total) adds. */
  const partFor = (k, total) => { const a = Math.round(13 * (k - 1) / total), b = Math.round(13 * k / total); return PARTS.slice(a, b); };
  const FALLBACK = ['lamp', 'gear', 'note', 'heart', 'coin', 'tower', 'rocket', 'trophy'];
  const spriteFor = (id, i) => FOR[id] || FALLBACK[(i || 0) % FALLBACK.length];

  /** Pixels of a sprite as <rect>s placed at (x, y), one pixel = `px`. ghost: one flat colour. */
  function pixels(key, x, y, px, ghost) {
    const rows = S[key] || S.trophy, h = rows.length, top = y + Math.floor((12 - h) / 2) * px;
    let out = '';
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        out += `<rect x="${x + c * px}" y="${top + r * px}" width="${px}" height="${px}" fill="${ghost || P[ch] || '#000'}"/>`;
      }
    });
    return out;
  }
  function sprite(key, o) {
    o = o || {};
    const size = o.size || 48;
    return `<svg viewBox="0 0 12 12" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${pixels(key, 0, 0, 1, o.ghost ? '#9aa6bf' : null)}</svg>`;
  }

  // ---------------------------------------------------------------- the robot, one part per lesson (13 parts)
  function robotParts(c, d) {           // c = body colour, d = darker edge
    const R = (x, y, w, h, f) => ({ x, y, w, h, f });
    return [
      [R(2, 24, 6, 4, '#334155'), R(12, 24, 6, 4, '#334155'), R(3, 25, 1, 2, '#94a3b8'), R(16, 25, 1, 2, '#94a3b8')],     // wheels
      [R(6, 20, 3, 4, '#94a3b8'), R(11, 20, 3, 4, '#94a3b8')],                                                              // legs
      [R(4, 12, 12, 9, c)],                                                                                                  // body
      [R(1, 13, 3, 7, c), R(1, 20, 3, 2, '#94a3b8')],                                                                        // left arm
      [R(16, 13, 3, 7, c), R(16, 20, 3, 2, '#94a3b8')],                                                                      // right arm
      [R(7, 14, 6, 4, '#1d2a5c'), R(8, 15, 1, 1, '#4ade80'), R(10, 15, 1, 1, '#facc15'), R(8, 16, 4, 1, '#ef4444')],       // chest panel
      [R(8, 10, 4, 2, '#94a3b8')],                                                                                           // neck
      [R(3, 3, 14, 8, c)],                                                                                                   // head
      [R(5, 4, 10, 6, '#1d2a5c')],                                                                                           // face plate
      [R(6, 5, 2, 2, '#67e8f9'), R(12, 5, 2, 2, '#67e8f9')],                                                                 // eyes
      [R(8, 8, 4, 1, '#f8fafc')],                                                                                            // smile
      [R(9, 0, 2, 3, '#94a3b8'), R(9, 0, 2, 1, '#ef4444')],                                                                  // antenna
      [R(0, 11, 1, 1, '#facc15'), R(19, 11, 1, 1, '#facc15'), R(1, 1, 1, 1, '#facc15'), R(18, 2, 1, 1, '#facc15'), R(10, 22, 1, 1, '#facc15')],   // sparkles: complete!
    ];
  }
  function robot(x, y, px, built, c, d, pulse) {
    let out = '';
    robotParts(c, d).forEach((part, i) => {
      part.forEach((r) => {
        const X = x + r.x * px, Y = y + r.y * px, W = r.w * px, H = r.h * px;
        if (i < built) out += (i === 12 ? '' : `<rect x="${X - 1}" y="${Y - 1}" width="${W + 2}" height="${H + 2}" fill="#0b1229"/>`) +
          `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${r.f}"${i === 12 ? ' class="px-twinkle"' : ''}/>`;
        else if (i < 12) out += `<rect x="${X + .5}" y="${Y + .5}" width="${W - 1}" height="${H - 1}" fill="none" stroke="#67e8f9" stroke-opacity=".45" stroke-dasharray="2 2"${i === built && pulse ? ' class="px-next"' : ''}/>`;
      });
    });
    return out;
  }

  // ---------------------------------------------------------------- the lab scene
  const COLORS = { teal: ['#14b8a6', '#0d8f82'], red: ['#ef4444', '#b91c1c'], orange: ['#fb923c', '#c2410c'], yellow: ['#facc15', '#ca8a04'],
    green: ['#4ade80', '#15803d'], blue: ['#60a5fa', '#1d4ed8'], purple: ['#a78bfa', '#6d28d9'], pink: ['#f472b6', '#be185d'], white: ['#e2e8f0', '#94a3b8'],
    chrome: ['#cbd5e1', '#64748b'], gold: ['#facc15', '#a16207'], lime: ['#a3e635', '#4d7c0f'], galaxy: ['#8b5cf6', '#4c1d95'] };

  function lab(o) {
    const W = 480, H = 200, px = 4, items = o.items || [], n = items.length, done = items.filter((it) => it.done).length;
    const f = n ? done / n : 0, [c, d] = COLORS[o.color] || COLORS.teal;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="px-lab" shape-rendering="crispEdges" role="img" aria-label="Your Maker Lab: ${done} of ${n} gadgets built">`;
    // wall: brick rows, darker until the lights come on
    s += `<rect width="${W}" height="${H}" fill="${f > 0 ? '#24306b' : '#141a3a'}"/>`;
    for (let r = 0; r < 40; r++) for (let k = 0; k < 16; k++) {
      s += `<rect x="${k * 32 + (r % 2 ? 16 : 0)}" y="${r * 8}" width="31" height="7" fill="${f > 0 ? '#2b3878' : '#182044'}"/>`;
    }
    // window with the night sky (25%)
    if (f >= .25) {
      s += `<rect x="196" y="18" width="88" height="52" fill="#0b1229"/><rect x="200" y="22" width="80" height="44" fill="#0f1d4a"/>`;
      [[208, 28], [236, 34], [262, 26], [250, 52], [218, 50], [272, 44]].forEach(([x, y], i) => { s += `<rect x="${x}" y="${y}" width="${i % 2 ? 2 : 4}" height="${i % 2 ? 2 : 4}" fill="#fef9c3" class="${i % 3 ? '' : 'px-twinkle'}"/>`; });
      s += `<rect x="238" y="22" width="4" height="44" fill="#0b1229"/><rect x="200" y="42" width="80" height="4" fill="#0b1229"/>`;
    } else s += `<rect x="196" y="18" width="88" height="52" fill="#11173a" stroke="#2b3878" stroke-dasharray="4 4"/>`;
    // neon sign (50%)
    s += f >= .5 ? `<text x="240" y="13" text-anchor="middle" class="px-neon">MAKER LAB</text>` : '';
    // ceiling lamps: one dim bulb at first, both bright once lessons are done
    [[120, f > 0], [360, f >= .75]].forEach(([x, on]) => {
      s += `<rect x="${x - 1}" y="0" width="2" height="12" fill="#0b1229"/><rect x="${x - 10}" y="12" width="20" height="6" fill="#475569"/>`;
      s += `<rect x="${x - 6}" y="18" width="12" height="4" fill="${on ? '#fde68a' : '#334155'}"/>`;
      if (on) s += `<polygon points="${x - 8},22 ${x + 8},22 ${x + 40},150 ${x - 40},150" fill="#fde68a" opacity=".07"/>`;
    });
    // shelves and the gadget slots: 4 shelves around the robot, slots spread evenly
    const shelves = [[12, 70, 172], [12, 128, 172], [296, 70, 172], [296, 128, 172]];
    shelves.forEach(([x, y, w]) => { s += `<rect x="${x}" y="${y}" width="${w}" height="6" fill="#a16207"/><rect x="${x}" y="${y + 6}" width="${w}" height="2" fill="#713f12"/><rect x="${x + 8}" y="${y + 8}" width="4" height="10" fill="#713f12"/><rect x="${x + w - 12}" y="${y + 8}" width="4" height="10" fill="#713f12"/>`; });
    const per = Math.ceil(n / 4), ip = per > 3 ? 3 : 4, half = 6 * ip;    // 4 a shelf: smaller gadgets so they fit
    items.forEach((it, i) => {
      const sh = shelves[Math.floor(i / per)], k = i % per, slots = Math.min(per, n - Math.floor(i / per) * per);
      const x = Math.round(sh[0] + (sh[2] / slots) * (k + .5) - half), y = sh[1] - 2 * half;
      if (it.done) s += `<g class="px-item">${pixels(it.sprite, x, y, ip)}</g>`;
      else s += `<g opacity="${it.current ? .55 : .2}"${it.current ? ' class="px-next"' : ''}>${pixels(it.sprite, x, y, ip, '#8fa0c8')}</g>`;
    });
    // plants (75%)
    if (f >= .75) [[6, 160], [452, 160]].forEach(([x, y]) => { s += `<rect x="${x + 6}" y="${y + 14}" width="14" height="14" fill="#b45309"/><rect x="${x + 2}" y="${y}" width="8" height="8" fill="#16a34a"/><rect x="${x + 12}" y="${y - 6}" width="8" height="12" fill="#22c55e"/><rect x="${x + 16}" y="${y + 4}" width="8" height="8" fill="#16a34a"/>`; });
    // floor
    for (let k = 0; k < 30; k++) s += `<rect x="${k * 16}" y="186" width="16" height="14" fill="${k % 2 ? '#334155' : '#3b475f'}"/>`;
    s += `<rect y="184" width="${W}" height="2" fill="#0b1229"/>`;
    // the robot on its assembly stand, in the student's colour
    const built = Math.round(13 * f);
    s += `<rect x="196" y="176" width="88" height="10" fill="#475569"/><rect x="204" y="172" width="72" height="4" fill="#64748b"/>`;
    s += `<rect x="190" y="96" width="4" height="80" fill="#64748b" opacity=".7"/><rect x="286" y="96" width="4" height="80" fill="#64748b" opacity=".7"/><rect x="190" y="96" width="100" height="3" fill="#64748b" opacity=".7"/>`;
    s += robot(200, 60, 4, built, c, d, done < n);
    // banner when every gadget is built
    if (n && done === n) s += `<rect x="188" y="32" width="104" height="20" fill="#facc15" stroke="#1d2a5c" stroke-width="3"/><text x="240" y="47" text-anchor="middle" class="px-banner">COMPLETE!</text>`;
    return s + '</svg>';
  }

  window.PixelArt = { sprite, lab, spriteFor, partFor, names: NAMES, sprites: Object.keys(S) };
})();
