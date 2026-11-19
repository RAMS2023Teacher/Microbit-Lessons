// Circuit Driver: opens the arcade as the teacher, then an autopilot drives a 30 s race and prints laps and score.
// Run: IFRAME=1 node tests/apps_script_app/serve.js dist/apps-script   then   node tests/browser/circuit_driver.js <folder for screenshots>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const T = 'http://localhost:5055/exec', fr = () => p.frames().find(x => x.url().includes('127.0.0.1'));
  await p.goto(T + '?as=teacher@school.org&p=/arcade'); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/1-arcade.png' });
  await fr().click('.game-tab[data-game="circuit"]'); await p.waitForTimeout(300);
  await fr().click('#start'); await p.waitForTimeout(1500);
  await (await fr().$('#rush')).screenshot({ path: out + '/2-countdown.png' });
  // autopilot: aim at a spot a little further along the trace
  p.waitForTimeout(15000).then(async () => { await (await fr().$('#auto')).screenshot({ path: out + '/3-race.png' }); });
  const res = await fr().evaluate(() => new Promise((done) => {
    const c = document.createElement('canvas'); c.id = 'auto'; c.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:540px;z-index:999'; document.body.appendChild(c);
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
    let shot = false;
    CircuitDriver.play(c, { avatar: { color: 'purple', accessory: 'helmet' }, seconds: 30, powerups: { turbo: 1, shield: 1, dash: 1, magnet: 1 }, spy: (S) => {
      if (S.phase !== 'race') return;
      const n = CircuitDriver.nearest(S.x, S.y), aim = CircuitDriver.at(n.s + 55, 0);
      let d = Math.atan2(aim.y - S.y, aim.x - S.x) - S.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      key(d > 0.06 ? 'keydown' : 'keyup', 'ArrowRight'); key(d < -0.06 ? 'keydown' : 'keyup', 'ArrowLeft');
      if (S.boosts > 0 && S.boostT <= 0 && Math.abs(d) < 0.1) key('keydown', 'Space');
      window.__S = { t: S.t, laps: S.laps, leds: S.leds, v: Math.round(S.v) };
    } }).then(done);
  }).then((r) => r));
  console.log('autopilot 30s:', res, 'per second:', Math.round(res.score / 30));
  await p.screenshot({ path: out + '/4-end.png' });
  console.log('errors', errs);
  await b.close();
})();
