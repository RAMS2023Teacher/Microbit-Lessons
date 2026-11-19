// Class display race at 1920x1080: node tests/browser/class_race.js <folder> [typical|spread|few]   (serve.js running with IFRAME=1)
// Fills a class of 26 at different places in Dodge the Drop, gives most a calling card, and shoots the class display.
const { chromium } = require('playwright');
const { makeWorld } = require('../apps_script_app/fake_google');
const D = makeWorld(require('path').join(__dirname, '../../dist/apps-script')).g.DATA;
(async () => {
  const out = process.argv[2], b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const T = 'http://localhost:5055/exec', fr = () => p.frames().find(x => x.url().includes('127.0.0.1'));
  await p.goto(T + '?as=teacher@school.org'); await p.waitForTimeout(1000);
  await fr().fill('#new-class', 'Period 3'); await fr().selectOption('#new-grade', 'g7'); await fr().click('#new-go'); await p.waitForTimeout(1500);
  const code = (await fr().textContent('.join-code b')).trim();
  const cid = await fr().evaluate(async () => { const h = await ML.run('teacherHome'); return (h.classes || h)[0].id; });
  const names = ['Ava', 'Ben', 'Carlos', 'Dalia', 'Eli', 'Fatima', 'Gabriel', 'Hana', 'Isaac', 'Jada', 'Kai', 'Lucia', 'Mateus', 'Noor', 'Owen', 'Priya', 'Quinn', 'Rafael', 'Sofia', 'Theo', 'Uma', 'Victor', 'Willow', 'Xavier', 'Yara', 'Zoe'];
  // where each student is: -1 not started, 0..12 the Build step they are on, 13 quiz, 14 ship, 15 done
  const where = process.argv[3] === 'spread' ? [3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 5, 4, 8, 8, 9, 2, 13, 13, 14, 15, 0, -1, 6]
    : [4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 5, 4, 6, 7, 3, 3, 5, 6];
  const cards = ['new-maker', 'snacks', 'bug-squasher', 'my-chromebook', 'none', 'banana', 'spaghetti', 'new-maker', 'chaos', 'duck', 'none', 'low-battery', 'beep-boop', 'napper', 'not-found', 'forgot-indent', 'bug-squasher', 'none', 'button-masher', 'one-more-try', 'new-maker', 'snacks', 'bug-squasher', 'none', 'new-maker', 'duck'];
  const L = D.lessons['dodge-the-drop'];
  const steps = L.build.map(s => ({ t: s.test.map((_, k) => k), f: s.fields.map(() => '7') })), quiz = L.quiz.map(q => q.answer), refl = L.ship.reflect.length;
  if (process.argv[3] === 'few') { names.length = 7; where.splice(0, 26, 4, 5, 5, 6, 6, 7, 13); cards.splice(0, 7, 'snacks', 'bug-squasher', 'my-chromebook', 'new-maker', 'duck', 'chaos', 'none'); }
  for (let k = 0; k < names.length; k++) {
    await p.goto(`${T}?as=${names[k].toLowerCase()}@students.school.org`); await p.waitForTimeout(450);
    await fr().fill('#j-code', code); await fr().fill('#j-name', names[k] + ' ' + 'KLMNPRST'[k % 8] + '.'); await fr().click('#j-go'); await p.waitForTimeout(900);
    await fr().evaluate(async ([w, steps, quiz, refl, card]) => {
      const B = '/api/lessons/dodge-the-drop/';
      if (w >= 0) {
        await ML.api(B + 'mission', { talk: 'Games end when you lose' });
        for (let i = 0; i < Math.min(w, 13); i++) await ML.api(B + 'step', { i, tests: steps[i].t, answer: 'my answer', fields: steps[i].f });
        if (w >= 14) await ML.api(B + 'quiz', { answers: quiz });
        if (w >= 15) await ML.api(B + 'ship', { share: 'https://makecode.microbit.org/_Abc123XyZ', ext: [0], reflect: Array(refl).fill('It loops until the game ends.'), submit: true });
      }
      if (card !== 'none') {
        const me = (await ML.api('/api/avatar', { color: ['teal', 'red', 'orange', 'blue', 'purple', 'pink', 'green'][card.length % 7], eyes: 'round', mouth: 'smile', antenna: 'ball', accessory: 'none', bg: 'sky', body: 'box', card: 'none', name: '' })).avatar;
        await ML.api('/api/shop/buy', { item: 'part:card:' + card });
        await ML.api('/api/avatar', Object.assign({}, me, { card }));
      }
    }, [where[k], steps, quiz, refl, cards[k]]);
  }
  await p.request.get('http://localhost:5055/__advance?ms=90000');
  await p.goto(`${T}?as=teacher@school.org&p=${encodeURIComponent('/teacher/classes/' + cid + '/screen')}`); await p.waitForTimeout(3500);
  await p.screenshot({ path: out + '/race-' + (process.argv[3] || 'typical') + '.png' });
  const info = await fr().evaluate(() => ({ bot: getComputedStyle(document.querySelector('.track')).getPropertyValue('--bot'),
    cls: document.querySelector('.track').className, cards: [...document.querySelectorAll('.racer-card')].map((c) => Math.round(parseFloat(getComputedStyle(c).fontSize) * 10) / 10 + 'px ' + (c.scrollHeight > c.clientHeight + 1 ? 'CLIPPED ' : '') + c.textContent).slice(0, 30),
    overflow: document.querySelector('.track').scrollWidth > document.querySelector('.track').clientWidth + 2 }));
  console.log(JSON.stringify(info, null, 1));
  console.log('errors', errs);
  await b.close();
})();
