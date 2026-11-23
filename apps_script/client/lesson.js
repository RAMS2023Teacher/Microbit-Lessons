/* The lesson page: Mission → Build (one step per screen) → Quiz → Ship it, like the App Inventor curriculum.
 * Students code in MakeCode (a second tab); this page guides them, saves their checks and answers, grades the quiz
 * on the server, and collects their MakeCode share link. Everything typed by students is shown with textContent
 * or escaped; lesson text is HTML made by the build from the teacher's Markdown. */
(function () {
  'use strict';

  window.__lessonPage = function () {
    const ML = window.ML, d = ML.data, L = d.lesson, S = d.state, E = ML.esc;
    const main = document.getElementById('main'), base = '/api/lessons/' + L.id;
    const STAGES = [['mission', 'Mission', '🎯'], ['build', 'Build', '🛠️'], ['quiz', 'Quiz', '🧠'], ['ship', 'Ship it', '🚀']];
    let stagesDone = d.stages, view = d.stage === 'done' ? 'ship' : d.stage, stepAt = Math.min(S.step_at || 0, L.build.length - 1);
    S.steps = S.steps || {};
    const $ = (id) => document.getElementById(id);
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

    // ------------------------------------------------------------ talking to the server
    let arcadeOpen = null;
    async function api(action, body) {
      const r = await ML.api(base + '/' + action, body);
      if (r.rewards && window.showRewards) window.showRewards(r.rewards);
      if (r.level) ML.updateLevel(r.level);
      if (r.stages) { stagesDone = r.stages; drawStages(); }
      if (typeof r.lesson_xp === 'number') drawXp(r.lesson_xp, r.stars);
      if (r.arcade) { ML.arcadePill(r.arcade); arcadeOpen = r.arcade; }
      return r;
    }
    const put = (id, t) => { const e = $(id); if (e) e.textContent = t; };   // a save can finish after the student moved on
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    // A button that isn't ready yet is grey (class "locked"), not disabled, so a click can explain what's missing.
    const C = window.Celebrate || { nope() {}, sound() {}, confetti() {} };
    function setLocked(btn, locked) {
      const was = btn.classList.contains('locked');
      btn.classList.toggle('locked', !!locked);
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
      if (was && !locked) { C.sound('ready'); btn.classList.remove('unlocked-now'); void btn.offsetWidth; btn.classList.add('unlocked-now'); }
    }
    // ------------------------------------------------------------ 🤔 feedback: "this was confusing" and the lesson rating
    const myFb = d.my_fb || { flags: [], rating: 0 }, flagged = new Set(myFb.flags || []);
    const REASONS = [['unclear', '😵 Instructions unclear'], ['broken', "🐞 Code didn't work"], ['hard', '🧗 Too hard'], ['easy', '😴 Too easy'], ['other', '💬 Other']];
    function flagWidget(kind, i) {
      const key = kind + ':' + i, wrap = el('div', 'flag-wrap');
      const draw = () => {
        wrap.innerHTML = '';
        if (flagged.has(key)) { wrap.appendChild(el('span', 'flag-done', '🤔 Thanks! Your teacher will see this.')); return; }
        const b = wrap.appendChild(el('button', 'flag-btn', kind === 'step' ? '🤔 Confusing?' : '🤔 This question was confusing'));
        b.type = 'button';
        b.addEventListener('click', () => {
          wrap.innerHTML = '';
          const pop = wrap.appendChild(el('div', 'flag-pop'));
          pop.appendChild(el('b', '', 'What was confusing?'));
          const row = pop.appendChild(el('div', 'flag-reasons'));
          let reason = '';
          REASONS.forEach(([id, label]) => {
            const r = row.appendChild(el('button', 'flag-reason', label));
            r.type = 'button';
            r.addEventListener('click', () => { reason = id; row.querySelectorAll('.flag-reason').forEach((x) => x.classList.toggle('on', x === r)); });
          });
          const note = pop.appendChild(document.createElement('input'));
          note.placeholder = 'Tell us more (optional)'; note.maxLength = 200;
          const btns = pop.appendChild(el('div', 'row'));
          const go = btns.appendChild(el('button', 'btn small go', 'Send'));
          go.type = 'button';
          const no = btns.appendChild(el('button', 'btn small ghost', 'Cancel'));
          no.type = 'button';
          no.addEventListener('click', draw);
          go.addEventListener('click', async () => {
            if (!reason) { C.nope(go, row); return; }
            go.disabled = true;
            const r = await ML.api(base + '/feedback', { kind, i, reason, note: note.value });
            if (r && (r.ok || r.teacher)) { flagged.add(key); C.sound('tick'); }
            draw();
          });
        });
      };
      draw();
      return wrap;
    }
    function ratingCard() {
      const card = el('div', 'panel-soft rate-card');
      const FACES = ['😣', '😕', '😐', '🙂', '🤩'];
      let pick = myFb.rating || 0;
      card.innerHTML = `<h3>⭐ Rate this lesson ${myFb.rating ? '<small class="muted">(you can change it)</small>' : '<small class="muted">+10 XP</small>'}</h3>` +
        `<div class="rate-faces">${FACES.map((f, k) => `<button type="button" class="rate-face${pick === k + 1 ? ' on' : ''}" data-r="${k + 1}" aria-label="${k + 1} out of 5">${f}</button>`).join('')}</div>` +
        `<label class="ask-box"><b>What was the hardest part?</b> <span class="muted small">(optional)</span><textarea id="rate-hard" rows="2" maxlength="400"></textarea></label>` +
        `<label class="ask-box"><b>What would make this lesson better?</b> <span class="muted small">(optional)</span><textarea id="rate-change" rows="2" maxlength="400"></textarea></label>` +
        `<div class="row"><button type="button" class="btn go" id="rate-go">Send my rating</button><span class="saved" id="rate-msg"></span></div>`;
      card.querySelector('#rate-hard').value = myFb.hardest || '';
      card.querySelector('#rate-change').value = myFb.change || '';
      card.querySelectorAll('.rate-face').forEach((b) => b.addEventListener('click', () => {
        pick = +b.dataset.r; C.sound('tick');
        card.querySelectorAll('.rate-face').forEach((x) => x.classList.toggle('on', x === b));
      }));
      card.querySelector('#rate-go').addEventListener('click', async () => {
        const msg = card.querySelector('#rate-msg');
        if (!pick) { msg.textContent = 'Tap a face first.'; C.nope(card.querySelector('#rate-go'), card.querySelector('.rate-faces')); return; }
        const r = await ML.api(base + '/feedback', { kind: 'rating', rating: pick, hardest: card.querySelector('#rate-hard').value, change: card.querySelector('#rate-change').value });
        if (r.rewards && window.showRewards) window.showRewards(r.rewards);
        if (r.level) ML.updateLevel(r.level);
        if (r.ok || r.teacher) { myFb.rating = pick; myFb.hardest = card.querySelector('#rate-hard').value; myFb.change = card.querySelector('#rate-change').value; }
        msg.textContent = r.ok ? 'Thanks! Saved ✓' : r.teacher ? '(Teacher preview: not saved)' : (r.error || 'Could not save');
      });
      return card;
    }

    function flagTodo(els) {
      els.forEach((x) => { x.classList.remove('todo'); void x.offsetWidth; x.classList.add('todo'); setTimeout(() => x.classList.remove('todo'), 2200); });
      if (els[0] && els[0].scrollIntoView) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // ------------------------------------------------------------ Python code with line numbers and new lines highlighted
    const KW = /\b(while|if|elif|else|for|in|def|return|not|and|or|True|False|None|import|from|global|break|pass|lambda)\b/g;
    function highlight(line) {
      let out = '', rest = line;
      const m = /^([^"'#]*(?:(["'])(?:(?!\2).)*\2[^"'#]*)*)(#.*)?$/.exec(line);
      let comment = '';
      if (m && m[3]) { rest = line.slice(0, line.length - m[3].length); comment = m[3]; }
      rest.split(/("[^"]*"|'[^']*')/).forEach((part, i) => {
        if (i % 2) out += '<span class="py-str">' + E(part) + '</span>';
        else out += E(part).replace(KW, '<span class="py-kw">$1</span>').replace(/\b(\d+(\.\d+)?)\b/g, '<span class="py-num">$1</span>');
      });
      return out + (comment ? '<span class="py-com">' + E(comment) + '</span>' : '');
    }
    function blocksBox(blocks, newLines) {
      if (!blocks || !window.MLBlocks) return '';
      return ((newLines || []).length ? '<p class="code-legend"><mark>Glowing blocks</mark> are the new ones to add.</p>' : '') +
        `<div class="blocks-box"><p class="blocks-hint">🧩 Find each block in the drawer with the same color.</p>${window.MLBlocks.render(blocks, newLines)}</div>`;
    }
    function codeBox(code, newLines, blocks) {
      if (blocks) return blocksBox(blocks, newLines);
      if (!code) return '';
      const fresh = new Set(newLines || []);
      const lines = code.split('\n').map((ln, i) => `<span class="ln${fresh.has(i + 1) ? ' new' : ''}" data-n="${i + 1}">${highlight(ln) || ' '}</span>`).join('');
      return (fresh.size ? '<p class="code-legend"><mark>Highlighted lines</mark> are the new code to add.</p>' : '') +
        `<div class="code-box"><button type="button" class="btn small ghost copy" data-code="${E(code)}">📋 Copy</button><pre>${lines}</pre></div>`;
    }
    function picture(v) { return v ? `<figure class="vz" data-visual='${E(JSON.stringify(v))}'></figure>` : ''; }
    function afterDraw(root) {
      if (window.Visuals) window.Visuals.renderAll(root);
      root.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', () => copy(b)));
      root.querySelectorAll('[data-read]').forEach((b) => b.addEventListener('click', () => readAloud(b)));
    }
    function copy(b) {
      const text = b.dataset.code, done = () => { b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '📋 Copy'; }, 1500); };
      const fallback = () => {
        const t = document.body.appendChild(document.createElement('textarea'));
        t.value = text; t.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* select it for Ctrl+C */ }
        t.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    }
    let reading = null;
    function readAloud(btn) {
      const voice = window.speechSynthesis;
      if (!voice) return;
      voice.cancel();
      if (reading === btn) { reading = null; btn.textContent = '🔊'; return; }
      const box = btn.closest('[data-readable]');
      const copyEl = box.cloneNode(true);
      copyEl.querySelectorAll('button, .code-box, input, textarea, figure').forEach((x) => x.remove());
      const u = new SpeechSynthesisUtterance(copyEl.textContent.replace(/\s+/g, ' ').trim());
      u.rate = 0.95; if (document.documentElement.lang === 'pt-BR') u.lang = 'pt-BR';
      u.onend = () => { reading = null; btn.textContent = '🔊'; };
      reading = btn; btn.textContent = '⏹'; voice.speak(u);
    }

    // ------------------------------------------------------------ page frame
    const xpPossible = d.xp_possible;
    main.innerHTML =
      `<section class="banner ${E(L.color)}"><div class="banner-icon">${E(L.icon)}</div><div>` +
      `<h1>${E(L.title)}</h1><p>${E(L.tagline)}</p><div class="pills"><span class="pill">Lesson ${E(L.number)}</span>` +
      `<span class="pill">${L.editor === 'blocks' ? '🧩' : '🐍'} ${E(L.python)}</span><span class="pill">🔌 ${E(L.hardware)}</span>` +
      `<span class="pill" id="xp-chip">⭐ ${d.lesson_xp} / ${xpPossible} XP</span></div></div></section>` +
      `<nav class="stages" id="stages" aria-label="Lesson stages"></nav>` +
      `<div class="lesson-grid"><div id="stage-view"></div><aside class="lesson-side">` +
      `<a class="btn go makecode-btn" href="${E(d.makecode)}" target="_blank" rel="noopener">🧰 Open MakeCode ↗</a>` +
      (ML.teacher ? '' : `<div class="side-panel help-panel" id="help-box"></div>`) +
      (d.feedback ? `<div class="side-panel"><h3>💬 From your teacher</h3><div id="fb"></div></div>` : '') +
      `<div class="side-panel" id="partner-panel" ${ML.teacher ? 'hidden' : ''}><h3>👥 Partner</h3><div id="partner-box"></div></div>` +
      `<div class="side-panel"><h3>🎁 Rewards</h3><div class="side-row">⭐ This lesson <b id="xp-side">${d.lesson_xp} XP</b></div>` +
      `<div class="side-row">🏅 Stars <span id="stars">${'★'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)}</span></div>` +
      `<p class="muted small">Stars: perfect quiz · an extension · shipped.</p></div>` +
      `<a class="small" href="/help">❓ How do I use MakeCode?</a>` +
      (d.key ? teacherKey() : '') + `</aside></div>`;
    if (d.feedback) $('fb').textContent = d.feedback;

    function teacherKey() {
      const k = d.key;
      return `<details class="side-panel" open><summary><b>🍎 Answer key (teacher only)</b></summary><ol>` +
        k.quiz.map((a) => `<li>${a}</li>`).join('') + `</ol>${k.notes || ''}<h3>Standards</h3><ul>` +
        k.standards.map((s) => `<li><b>${E(s.code)}</b> ${E(s.how)}</li>`).join('') + '</ul></details>';
    }
    function drawXp(xp, stars) {
      $('xp-chip').textContent = `⭐ ${xp} / ${xpPossible} XP`;
      $('xp-side').textContent = xp + ' XP';
      if (typeof stars === 'number') $('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    }
    function drawStages() {
      const nav = $('stages');
      nav.innerHTML = STAGES.map((st, i) => {
        const done = stagesDone[st[0]], here = view === st[0];
        return (i ? `<span class="stage-bar${stagesDone[STAGES[i - 1][0]] ? ' done' : ''}"></span>` : '') +
          `<button type="button" class="stage${done ? ' done' : ''}${here ? ' here' : ''}" data-stage="${st[0]}" aria-current="${here ? 'step' : 'false'}">` +
          `<span class="stage-dot">${done && !here ? '✔' : st[2]}</span><span class="stage-name">${st[1]}</span></button>`;
      }).join('');
      nav.querySelectorAll('.stage').forEach((b) => b.addEventListener('click', () => show(b.dataset.stage)));
    }
    const tellCtx = () => { ML.ctx = { lesson: L.id, stage: view, step: view === 'build' ? stepAt : null }; };   // for problem reports
    function show(stage) {
      view = stage;
      drawStages();
      ({ mission: drawMission, build: drawBuild, quiz: drawQuiz, ship: drawShip })[stage]();
      tellCtx();
      const top = $('stages').getBoundingClientRect().top + window.scrollY - 10;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    }

    // ------------------------------------------------------------ Mission
    function drawMission() {
      const m = L.mission, box = $('stage-view');
      box.innerHTML = `<section class="panel" data-readable><div class="step-head"><h2>🎯 Your mission</h2><button type="button" class="read-aloud" data-read title="Read to me">🔊</button></div>` +
        (m.big_question ? `<p class="big-q">❓ <b>Big question:</b> ${E(m.big_question)}</p>` : '') + `<div class="goal">${m.goal}</div>${picture(m.picture)}` +
        (m.learn.length ? `<div class="panel-soft box-new"><h3>✨ You'll learn</h3><ul class="learn-list">${m.learn.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : '') +
        `<div class="panel-soft box-what"><h3>🧰 You'll need</h3><ul class="need-list">${m.you_need.map((x) => `<li>${x}</li>`).join('')}</ul></div>` +
        (d.video ? `<div class="panel-soft"><h3>🎬 Watch first</h3><div class="video-box" id="video"></div></div>` : '') +
        `<div class="panel-soft box-ask"><h3>💬 Talk it over with your partner</h3><p>${m.talk}</p>` +
        `<label class="ask-box"><span class="muted small">Write what you decided:</span><textarea id="talk" rows="3"></textarea></label></div>` +
        `<div class="step-nav"><span class="saved" id="talk-saved"></span><button type="button" class="btn go big" id="mission-go">Mission accepted! Start building ▶</button></div></section>`;
      $('talk').value = S.talk || '';
      if (d.video) drawVideo($('video'), d.video);
      afterDraw(box);
      const save = debounce(async () => { const r = await api('mission', { talk: S.talk || '' }); put('talk-saved', r.ok ? 'Saved ✓' : (r.error || '')); }, 700);
      $('talk').addEventListener('input', () => { S.talk = $('talk').value; $('talk-saved').textContent = 'Saving…'; save(); });
      const talkReady = () => setLocked($('mission-go'), (S.talk || '').trim().length < 3 && !ML.teacher);
      $('talk').addEventListener('input', talkReady);
      talkReady();
      $('mission-go').addEventListener('click', async () => {
        if ((S.talk || '').trim().length < 3 && !ML.teacher) {
          $('talk-saved').textContent = 'Write a few words with your partner first.';
          C.nope($('mission-go'), $('talk-saved')); flagTodo([$('talk').closest('.ask-box')]); $('talk').focus(); return;
        }
        await api('mission', { talk: S.talk });
        show('build');
      });
    }
    function drawVideo(box, v) {
      if (v.kind === 'iframe') { const f = box.appendChild(document.createElement('iframe')); f.src = v.src; f.title = 'Lesson video'; f.allow = 'encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; }
      else if (v.kind === 'video') { const vid = box.appendChild(document.createElement('video')); vid.src = v.src; vid.controls = true; }
      else { const a = box.appendChild(document.createElement('a')); a.href = v.src; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '▶ Watch the lesson video'; }
    }

    // ------------------------------------------------------------ Build: one step per screen
    const stepRow = (i) => S.steps[i] || (S.steps[i] = { tests: [], answer: '', fields: [], done: false });
    function stepReady(i) {
      const St = L.build[i], row = stepRow(i);
      const missing = [];
      if ((row.tests || []).length < St.test.length) missing.push('tick every Test it box');
      if (St.ask && String(row.answer || '').trim().length < 2) missing.push('answer the question');
      if (St.fields.some((f, k) => !String((row.fields || [])[k] || '').trim())) missing.push('fill in the blanks');
      return missing;
    }
    // The blanks a step asks students to fill in. With a `fields_prompt` they sit right under the picture they're about.
    function fieldsHtml(St, underPicture) {
      const row = `<div class="fields-row">${St.fields.map((f, k) => `<label>${E(f)}<input data-field="${k}"></label>`).join('')}</div>`;
      return underPicture ? `<div class="panel-soft box-ask fields-box"><h3>✏️ ${St.fields_prompt}</h3>${row}</div>` : row;
    }
    function drawBuild() {
      ML.ctx = { lesson: L.id, stage: 'build', step: stepAt };
      const i = stepAt, St = L.build[i], row = stepRow(i), box = $('stage-view'), last = i === L.build.length - 1;
      const dots = L.build.map((s, k) => {
        const reachable = ML.teacher || k <= stepAt || stepRow(k).done || (k > 0 && stepRow(k - 1).done);
        return (k && L.build[k - 1].part !== s.part ? '<li class="sep" aria-hidden="true">|</li>' : '') +
          `<li><button type="button" class="${stepRow(k).done ? 'done' : ''}${k === i ? ' here' : ''}" data-step="${k}" ${reachable ? '' : 'disabled'} title="${E(s.title)}">${k + 1}</button></li>`;
      }).join('');
      box.innerHTML = `<section class="panel" data-readable><ol class="step-dots">${dots}</ol>` +
        `<div class="step-head"><div><div class="step-part">${E(St.part || 'Build')}</div><h2 class="step-title">${E(St.title)}</h2></div>` +
        `<div><span class="step-count">Step ${i + 1} of ${L.build.length}</span> <button type="button" class="read-aloud" data-read title="Read to me">🔊</button></div></div>` +
        (St.say ? `<div class="panel-soft box-new">${St.say}</div>` : '') + picture(St.picture) +
        (St.fields_prompt ? fieldsHtml(St, true) : '') +
        (St.wiring.length ? `<div class="panel-soft box-what"><h3>🔌 Wire it</h3><ol class="do-list">${St.wiring.map((w) => `<li>${w.text || w}</li>`).join('')}</ol>` +
          (St.breadboard ? `<figure class="wire-pic"><div class="kit-pick" id="kit-pick" hidden><span>My kit:</span><button type="button" data-kit="breakout">🟥 Breakout board</button><button type="button" data-kit="clips">🐊 Alligator clips</button><button type="button" data-kit="diagram">📐 Circuit diagram</button></div>` +
            `<div class="bb" id="wire-bb" translate="no"></div><p class="kit-note" id="kit-note"></p><figcaption>${St.breadboard.caption || ''}</figcaption></figure>` : '') + `</div>` : '') +
        (St.do.length ? `<h3>Do this</h3><ol class="do-list">${St.do.map((x) => `<li>${x}</li>`).join('')}</ol>` : '') +
        codeBox(St.code, St.new, St.blocks) +
        (St.tip ? `<div class="panel-soft box-tip">${St.tip}</div>` : '') +
        (St.what ? `<div class="panel-soft box-what"><h3>💡 What it does</h3>${St.what}</div>` : '') +
        (St.stuck.length ? `<div class="panel-soft box-stuck"><h3>🧯 Not working? Check these</h3><ul>${St.stuck.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : '') +
        `<div class="panel-soft box-test"><h3>✅ Test it</h3><div class="tests">${St.test.map((t, k) =>
          `<label><input type="checkbox" data-test="${k}" ${(row.tests || []).includes(k) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>` +
        (St.fields.length && !St.fields_prompt ? fieldsHtml(St, false) : '') +
        (St.ask ? `<div class="panel-soft box-ask ask-box"><h3>✏️ ${E(St.ask)}</h3><textarea id="step-ask" rows="3"></textarea></div>` : '') +
        `<div class="step-nav"><button type="button" class="btn ghost" id="step-back" ${i ? '' : 'disabled'}>◀ Back</button>` +
        `<span class="need" id="step-need"></span><span class="saved" id="step-saved"></span>` +
        `<button type="button" class="btn go big" id="step-next">${last ? 'Got it! On to the quiz ▶' : 'Got it! Next ▶'}</button></div></section>`;
      box.querySelector('.step-head').after(flagWidget('step', i));
      if (St.breadboard && $('wire-bb') && window.Breadboard) {       // the wiring picture: this step's parts glow, earlier ones are dimmed
        const bb = St.breadboard, pins = new Set();
        bb.steps.forEach((x) => (x.add || []).forEach((q) => { if (q.type === 'wire') [q.from, q.to].forEach((e) => { if (/^mb\./.test(e || '')) pins.add(e.slice(3)); }); }));
        // Two kits: the breakout board plugged into the breadboard, or alligator clips on the big pins (0, 1, 2, 3V, GND only).
        const clipsOk = [...pins].every((x) => ['P0', 'P1', 'P2', '3V', 'GND'].includes(x)), both = bb.board !== false && clipsOk && pins.size > 0;
        let kit = 'breakout';
        try { kit = localStorage.getItem('ml-kit') || 'breakout'; } catch (e) { /* default */ }
        const can = { breakout: bb.board !== false, clips: clipsOk && (pins.size > 0 || bb.board === false), diagram: pins.size > 0 && !!window.Schematic };
        const drawWire = () => {
          const mode = can[kit] ? kit : can.breakout ? 'breakout' : 'clips';
          if (mode === 'diagram') window.Schematic.render($('wire-bb'), bb);
          else window.Breadboard.render($('wire-bb'), Object.assign({}, bb, { mb: mode }), bb.steps.length - 1, { crop: true, plain: bb.steps.length < 2 });
          $('wire-bb').classList.toggle('is-diagram', mode === 'diagram');
          $('wire-bb').querySelector('svg').setAttribute('aria-label', 'Wiring picture: ' + St.wiring.map((w) => String(w.text || w).replace(/<[^>]+>/g, '')).join(' '));
          $('kit-note').textContent = !pins.size ? '' : mode === 'diagram'
            ? '📐 A circuit diagram shows what is joined to what, not where things sit. Every line is a wire or a breadboard row. Follow a line from a pin, through the parts, and back to GND.'
            : mode === 'clips'
            ? '🐊 Clip one end of each wire onto the big pin on the micro:bit' + (bb.board === false ? '.' : '. Push its other end into the hole shown.')
            : "🟥 The breakout board's pins are plugged into the breadboard. Every hole in a pin's row is joined to that pin, so wires start in the same row." +
              (clipsOk ? '' : ' (This step uses pins that alligator clips can\'t reach.)');
          $('kit-pick').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.kit === mode));
        };
        $('kit-pick').hidden = Object.keys(can).filter((k) => can[k]).length < 2;
        $('kit-pick').querySelectorAll('button').forEach((x) => { x.hidden = !can[x.dataset.kit]; });
        $('kit-pick').querySelectorAll('button').forEach((x) => x.addEventListener('click', () => { kit = x.dataset.kit; try { localStorage.setItem('ml-kit', kit); } catch (e) { /* fine */ } drawWire(); }));
        drawWire();
      }
      if (St.ask) $('step-ask').value = row.answer || '';
      box.querySelectorAll('[data-field]').forEach((inp) => { inp.value = (row.fields || [])[+inp.dataset.field] || ''; });
      afterDraw(box);
      box.querySelectorAll('.step-dots button').forEach((b) => b.addEventListener('click', () => { stepAt = +b.dataset.step; drawBuild(); }));
      const sync = () => {
        const need = stepReady(i);
        setLocked($('step-next'), need.length && !ML.teacher);
        $('step-need').textContent = need.length ? 'To go on: ' + need.join(', ') + '.' : '';
      };
      const save = debounce(async () => {
        const r = await api('step', { i, tests: row.tests, answer: row.answer, fields: row.fields });
        if (r.ok) row.done = r.step_done;
        put('step-saved', r.ok ? 'Saved ✓' : (r.error || 'Could not save'));
      }, 600);
      const changed = () => { $('step-saved').textContent = 'Saving…'; sync(); save(); };
      box.querySelectorAll('[data-test]').forEach((c) => c.addEventListener('change', () => {
        if (c.checked) C.sound('tick');
        row.tests = [...box.querySelectorAll('[data-test]:checked')].map((x) => +x.dataset.test);
        changed();
      }));
      box.querySelectorAll('[data-field]').forEach((inp) => inp.addEventListener('input', () => {
        row.fields = [...box.querySelectorAll('[data-field]')].map((x) => x.value);
        changed();
      }));
      if (St.ask) $('step-ask').addEventListener('input', () => { row.answer = $('step-ask').value; changed(); });
      $('step-back').addEventListener('click', () => { stepAt = Math.max(0, i - 1); drawBuild(); });
      $('step-next').addEventListener('click', async () => {
        if ($('step-next').classList.contains('locked')) {
          C.nope($('step-next'), $('step-need'));
          flagTodo([...box.querySelectorAll('[data-test]:not(:checked)')].map((x) => x.closest('label'))
            .concat(St.ask && !(row.answer || '').trim() ? [$('step-ask').closest('.ask-box')] : [])
            .concat([...box.querySelectorAll('[data-field]')].some((x) => !x.value.trim()) ? [box.querySelector('.fields-row')] : []));
          return;
        }
        $('step-next').disabled = true;
        const r = await api('step', { i, tests: row.tests, answer: row.answer, fields: row.fields });
        row.done = !!r.step_done || !!r.teacher;
        if (!row.done && !r.teacher) { sync(); return; }
        if (last) show('quiz'); else { stepAt = i + 1; drawBuild(); }
      });
      sync();
    }

    // ------------------------------------------------------------ Quiz
    function drawQuiz() {
      const box = $('stage-view'), picks = (S.quiz_answers || []).slice();
      const results = S.quiz_results;
      box.innerHTML = `<section class="panel"><div class="step-head"><h2>🧠 Quiz</h2>` +
        `<span class="step-count">Get ${Math.ceil(L.quiz.length * 0.75)} of ${L.quiz.length} right to pass</span></div><div id="quiz-qs"></div>` +
        `<div class="step-nav"><span id="quiz-score" class="quiz-score"></span><span class="need" id="quiz-need"></span>` +
        `<button type="button" class="btn go big" id="quiz-go">Check my answers ▶</button></div></section>`;
      const qs = $('quiz-qs');
      L.quiz.forEach((q, qi) => {
        const card = qs.appendChild(el('div', 'quiz-q'));
        card.appendChild(el('h3', '', `${qi + 1}. ${q.question}`));
        const grid = card.appendChild(el('div', 'quiz-choices'));
        q.choices.forEach((c, ci) => {
          const b = grid.appendChild(el('button', 'quiz-choice', `<span class="letter">${'ABCD'[ci]}</span><span>${c}</span>`));
          b.type = 'button';
          b.addEventListener('click', () => { if (box.dataset.graded) return; picks[qi] = ci; C.sound('tick'); mark(); });
        });
        card.appendChild(el('p', 'quiz-why'));
        card.appendChild(flagWidget('quiz', qi));
      });
      function mark(res) {
        qs.querySelectorAll('.quiz-q').forEach((card, qi) => {
          card.querySelectorAll('.quiz-choice').forEach((b, ci) => {
            b.classList.toggle('picked', picks[qi] === ci);
            b.classList.toggle('right', !!res && res.results[qi].answer === ci);
            b.classList.toggle('wrong', !!res && picks[qi] === ci && !res.results[qi].correct);
          });
          const why = card.querySelector('.quiz-why');
          why.className = 'quiz-why' + (res ? (res.results[qi].correct ? ' good' : ' bad') : '');
          why.innerHTML = res ? (res.results[qi].correct ? '✓ ' : '✗ ') + res.results[qi].why : '';
        });
        const left = L.quiz.length - picks.filter((p) => p != null).length;
        $('quiz-need').textContent = !res && left ? `${left} to go` : '';
        setLocked($('quiz-go'), !res && left > 0);
      }
      function graded(res) {
        box.dataset.graded = '1';
        mark(res);
        $('quiz-score').textContent = `${res.score} / ${res.total} ${res.passed ? '🎉 Passed!' : ''}`;
        const go = $('quiz-go');
        go.disabled = false;
        go.textContent = res.passed ? 'Next: Ship it ▶' : 'Try again ↻';
        go.onclick = () => {
          if (res.passed) { show('ship'); return; }
          delete box.dataset.graded; picks.length = 0; S.quiz_results = null; drawQuiz();
        };
      }
      $('quiz-go').onclick = async () => {
        if ($('quiz-go').classList.contains('locked')) {
          C.nope($('quiz-go'), $('quiz-need'));
          flagTodo([...qs.querySelectorAll('.quiz-q')].filter((_, qi) => picks[qi] == null));
          return;
        }
        $('quiz-go').disabled = true;
        const r = await api('quiz', { answers: picks });
        if (!r.quiz) { $('quiz-need').textContent = r.error || 'Could not check that.'; $('quiz-go').disabled = false; return; }
        S.quiz_answers = picks.slice(); S.quiz_results = r.quiz;
        if (!r.quiz.passed) C.nope($('quiz-go'), $('quiz-score'));
        else if (!(r.rewards && r.rewards.xp_gained)) C.sound('pass');
        graded(r.quiz);
      };
      if (results) graded(results); else mark();
    }

    // ------------------------------------------------------------ Ship it
    function drawShip() {
      const ship = L.ship, box = $('stage-view'), ext = S.ext || {}, reflect = (S.reflect || []).slice();
      box.innerHTML = `<section class="panel"><div class="step-head"><h2>🚀 Ship it</h2></div>` +
        (S.shipped_at ? `<div class="shipped" id="shipped">📦 <b>Shipped!</b> Your teacher can open your project. You can still add more and ship again.</div>` : '') +
        (ship.extensions.length ? `<h3>🧩 Make it yours: add at least one extension</h3><div class="ext-grid">${ship.extensions.map((e, k) =>
          `<details class="ext"${ext[k] ? ' open' : ''}><summary><input type="checkbox" data-ext="${k}" ${ext[k] ? 'checked' : ''} aria-label="I added ${E(e.title)}">` +
          `<span>${'ABCDEFG'[k]}. ${E(e.title)}</span><span class="ext-level ${E(e.level)}">${E(e.level)}</span></summary><div class="ext-body">` +
          `<p><b>Goal:</b> ${e.goal}</p>${e.where ? `<p><b>Where it goes:</b> ${e.where}</p>` : ''}${codeBox(e.code, e.new, e.blocks)}` +
          (e.hints.length ? `<div class="panel-soft box-tip"><h3>💡 Hints</h3><ul>${e.hints.map((h) => `<li>${h}</li>`).join('')}</ul></div>` : '') +
          `<p class="muted small">Tick the box when you've added it and tested it three times.</p></div></details>`).join('')}</div>` : '') +
        `<h3>✏️ Reflect</h3>${ship.reflect.map((q, k) => `<label class="ask-box"><b>${E(q)}</b><textarea data-reflect="${k}" rows="3"></textarea></label>`).join('')}` +
        `<div class="panel-soft box-what"><h3>🔗 Your MakeCode share link</h3><ol class="do-list"><li>In MakeCode, click <b>Share</b> (top of the screen).</li>` +
        `<li>Click <b>Share Project</b>, then <b>Copy</b>.</li><li>Paste the link here.</li></ol>` +
        `<div class="share-row"><input id="share" placeholder="https://makecode.microbit.org/_…" aria-label="MakeCode share link"></div></div>` +
        `<div class="step-nav"><span class="saved" id="ship-saved"></span><span class="missing" id="ship-missing"></span>` +
        `<button type="button" class="btn go big" id="ship-go">Ship it! 🚀</button></div></section>`;
      box.querySelector('.panel').appendChild(ratingCard());
      $('share').value = S.share || '';
      box.querySelectorAll('[data-reflect]').forEach((t) => { t.value = reflect[+t.dataset.reflect] || ''; });
      afterDraw(box);
      const body = () => ({
        share: $('share').value.trim(),
        ext: [...box.querySelectorAll('[data-ext]:checked')].map((c) => +c.dataset.ext),
        reflect: [...box.querySelectorAll('[data-reflect]')].map((t) => t.value),
      });
      let latest = null;                     // read when they type, so a save after they've left the page still has it
      const save = debounce(async () => {
        const r = await api('ship', latest);
        put('ship-saved', r.ok !== false ? 'Saved ✓' : '');
      }, 800);
      box.querySelectorAll('[data-ext]').forEach((c) => {
        c.addEventListener('click', (e) => e.stopPropagation());
        c.addEventListener('change', () => { latest = body(); $('ship-saved').textContent = 'Saving…'; save(); });
      });
      box.querySelectorAll('textarea, #share').forEach((t) => t.addEventListener('input', () => { latest = body(); $('ship-saved').textContent = 'Saving…'; save(); }));
      $('ship-go').addEventListener('click', async () => {
        $('ship-go').disabled = true;
        const b = body(); b.submit = true;
        const r = await api('ship', b);
        $('ship-go').disabled = false;
        if (r.teacher) { $('ship-missing').textContent = '(Teacher preview: nothing is saved.)'; return; }
        if (r.missing && r.missing.length && !r.shipped) { $('ship-missing').textContent = 'Not yet: ' + r.missing.join(' '); C.nope($('ship-go'), $('ship-missing')); return; }
        Object.assign(S, b, { shipped_at: S.shipped_at || new Date().toISOString() });
        S.ext = {}; b.ext.forEach((k) => { S.ext[k] = true; });
        drawShip();
        if (r.stage === 'done') celebrate();
      });
    }
    function celebrate() {
      C.confetti();
      const box = $('stage-view').querySelector('.panel');
      box.insertAdjacentHTML('afterbegin', `<div class="shipped" style="margin-bottom:14px">🏁 <b>Lesson complete!</b> ` +
        `<a href="/map">See what you unlocked on the skill tree →</a></div>` +
        (arcadeOpen ? (arcadeOpen.can_play
          ? `<a class="arcade-banner" href="/arcade">🎮 <b>You earned ${arcadeOpen.minutes} minutes of Robot Rush!</b> The arcade is open: race your robot ▶</a>`
          : `<div class="arcade-banner">🎮 <b>You earned ${arcadeOpen.minutes} minutes of Robot Rush play time!</b> Use it when your teacher opens the arcade.</div>`) : ''));
    }

    // ------------------------------------------------------------ partners (two classmates, one Chromebook)
    async function partner(body) {
      const r = await window.fetch(base + '/partner', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined }).then((x) => x.json());
      drawPartner(r);
    }
    let partnerToasted = false;
    function drawPartner(p) {
      const box = $('partner-box');
      box.textContent = '';
      if (p.status === 'paired') {
        const t = box.appendChild(el('p', p.by_me ? '' : 'partner-note'));
        const nb = el('b', ''); nb.textContent = p.name; nb.setAttribute('translate', 'no');
        if (p.by_me) { t.append('You picked '); t.appendChild(nb); t.append(' as your partner.'); }
        else { t.append('👋 '); t.appendChild(nb); t.append(' picked you as their partner for this lesson.'); }
        box.appendChild(el('p', 'small', 'Everything in this lesson saves for both of you.'));
        const stop = box.appendChild(el('button', 'btn small ghost', p.by_me ? 'Remove partner' : "Not my partner: remove"));
        stop.type = 'button';
        stop.id = 'partner-remove';
        stop.addEventListener('click', () => { if (confirm(`Stop working with ${p.name}? Work you already did stays with both of you.`)) partner({ action: 'leave' }); });
        if (!p.by_me && !partnerToasted) { partnerToasted = true; $('partner-panel').classList.add('partner-new'); }
      } else if ((p.classmates || []).length) {
        box.appendChild(el('p', 'small', 'Sharing this Chromebook? Pick your partner so you both get the work and the XP.'));
        const pick = box.appendChild(el('select'));
        pick.appendChild(el('option', '', 'Pick your partner…')).value = '';
        p.classmates.forEach((m) => { const o = pick.appendChild(el('option')); o.value = m.id; o.textContent = m.name; });
        const go = box.appendChild(el('button', 'btn small', 'Add partner'));
        go.type = 'button';
        go.addEventListener('click', async () => {
          if (!pick.value) return;
          const name = pick.options[pick.selectedIndex].textContent;
          if (!confirm(`Work with ${name}? Your work on this lesson will save for both of you.`)) return;
          const r = await window.fetch(base + '/partner', { method: 'POST', body: JSON.stringify({ action: 'pair', partner_id: pick.value }) }).then((x) => x.json());
          drawPartner(r);
          if (r.status === 'paired') ML.reload(`You and ${r.name} are partners now! Tap Continue to load your shared work.`);   // both students' work, merged
        });
      } else box.appendChild(el('p', 'muted small', 'No classmates to pick yet.'));
      if (p.error) box.appendChild(el('p', 'missing small')).textContent = p.error;
    }

    drawStages();
    show(view);
    if (!ML.teacher) partner();

    // ------------------------------------------------------------ ✋ I'm stuck: rings on the teacher's class display
    let helpOn = !!d.help, helpTimer = null;
    function drawHelp(open) {
      const box = $('help-box');
      if (!box) return;
      if (helpOn) {
        box.className = 'side-panel help-panel waiting';
        box.innerHTML = `<h3>✋ Help is on the way!</h3><p class="small">Your teacher can see you need help. Keep trying while you wait, ` +
          `or ask your partner.</p><button type="button" class="btn small ghost" id="help-cancel">I figured it out 👍</button>`;
        $('help-cancel').addEventListener('click', async () => { await ML.api('/api/help', { action: 'cancel' }); helpOn = false; drawHelp(); });
        clearInterval(helpTimer);
        helpTimer = setInterval(async () => {        // the teacher pressed ✓ Helped on the display
          if (document.hidden) return;
          const r = await ML.api('/api/help', { action: 'status' }).catch(() => null);
          if (r && r.ok && !r.help) { helpOn = false; clearInterval(helpTimer); drawHelp(); }
        }, 30000);
        return;
      }
      box.className = 'side-panel help-panel';
      box.innerHTML = open
        ? `<h3>✋ What are you stuck on?</h3><textarea id="help-note" rows="2" maxlength="140" placeholder="Optional, e.g. my code shows an error"></textarea>` +
          `<div class="row"><button type="button" class="btn small go" id="help-send">Ask for help</button><button type="button" class="btn small ghost" id="help-no">Never mind</button></div>`
        : `<button type="button" class="btn help-btn" id="help-ask">✋ I'm stuck: ask for help</button>`;
      if (!open) { $('help-ask').addEventListener('click', () => drawHelp(true)); return; }
      $('help-note').focus();
      $('help-no').addEventListener('click', () => drawHelp(false));
      $('help-send').addEventListener('click', async () => {
        $('help-send').disabled = true;
        const r = await ML.api('/api/help', { action: 'ask', lesson: L.id, stage: view, step: stepAt, note: $('help-note').value });
        if (r && r.ok) { helpOn = true; C.sound('ready'); }
        drawHelp();
      });
    }
    drawHelp();
  };
})();
