/* Code editor with micro:bit toolbar (CodeMirror 5). */
(function () {
  'use strict';
  let active = null;   // editor whose console receives serial output
  const all = [];

  function setStatus(ed, text, kind) {
    ed.status.textContent = text || '';
    ed.status.className = 'ed-status' + (kind ? ' ' + kind : '');
  }

  function appendConsole(ed, text) {
    ed.consoleBox.hidden = false;
    // drop terminal noise from the REPL
    text = text.replace(/\x04|\x1b\[[0-9;]*[A-Za-z]/g, '');
    ed.consoleText += text;
    if (ed.consoleText.length > 20000) ed.consoleText = ed.consoleText.slice(-15000);
    ed.pre.textContent = ed.consoleText;
    ed.pre.scrollTop = ed.pre.scrollHeight;
    // Highlight the line an error points at, e.g.  File "main.py", line 7, in <module>
    const m = /File "main\.py", line (\d+)[^\n]*\n(?:[^\n]*\n)*?(\w+Error|\w+Exception)[^\n]*/.exec(ed.consoleText.slice(-2000));
    if (m) markError(ed, parseInt(m[1], 10) - 1, m[0].split('\n').pop());
  }

  function markError(ed, line, message) {
    clearError(ed);
    if (line < 0 || line >= ed.cm.lineCount()) return;
    ed.errLine = ed.cm.addLineClass(line, 'background', 'cm-error-line');
    ed.pre.classList.add('has-error');
    setStatus(ed, 'Error on line ' + (line + 1) + ': ' + message.trim(), 'bad');
  }

  function clearError(ed) {
    if (ed.errLine) { ed.cm.removeLineClass(ed.errLine, 'background', 'cm-error-line'); ed.errLine = null; }
    ed.pre.classList.remove('has-error');
  }

  const HELP_NO_MP = 'Your micro:bit doesn\'t have Python on it yet. Click "Download .hex", drag the file onto the MICROBIT drive, wait for the light to stop blinking, then try Send again.';

  // ----- on-screen simulator from the Micro:bit Educational Foundation -----
  const SIM_ORIGIN = 'https://python-simulator.usermbit.org';
  const SIM_URL = SIM_ORIGIN + '/v/0.1/simulator.html?color=%230b78b8';
  const SIM_LABELS = {
    gesture: 'Gesture', accelerometerX: 'Tilt left-right (x)', accelerometerY: 'Tilt forward-back (y)',
    accelerometerZ: 'Up-down (z)', lightLevel: 'Light', temperature: 'Temperature (°C)', soundLevel: 'Sound',
  };

  function buildSimControls(ed, state, post) {
    const box = ed.root.querySelector('.sim-controls');
    box.textContent = '';
    ed.sim.inputs = {};
    Object.keys(SIM_LABELS).forEach((id) => {
      const sensor = state[id];
      if (!sensor) return;
      const label = box.appendChild(document.createElement('label'));
      label.appendChild(document.createElement('span')).textContent = SIM_LABELS[id];
      let input;
      if (sensor.type === 'enum') {
        input = label.appendChild(document.createElement('select'));
        sensor.choices.forEach((c) => { input.appendChild(document.createElement('option')).textContent = c; });
        input.addEventListener('change', () => post({ kind: 'set_value', id, value: input.value }));
      } else if (sensor.type === 'range') {
        input = label.appendChild(document.createElement('input'));
        Object.assign(input, { type: 'range', min: sensor.min, max: sensor.max });
        input.addEventListener('input', () => post({ kind: 'set_value', id, value: Number(input.value) }));
      } else {
        label.remove();
        return;
      }
      input.value = sensor.value;
      ed.sim.inputs[id] = input;
    });
    ed.root.querySelector('.sim-sensors').hidden = !Object.keys(ed.sim.inputs).length;
  }

  function closeSim(ed) {
    if (!ed.sim) return;
    window.removeEventListener('message', ed.sim.onMessage);
    clearTimeout(ed.sim.timer);
    ed.sim.iframe.remove();
    ed.sim = null;
    ed.root.querySelector('.ed-sim').hidden = true;
    const btn = ed.root.querySelector('[data-act=sim]');
    btn.textContent = '🖥 Simulate';
    btn.setAttribute('aria-expanded', 'false');
    setStatus(ed, '', '');
  }

  function openSim(ed) {
    const iframe = document.createElement('iframe');
    iframe.title = 'micro:bit simulator';
    iframe.src = SIM_URL;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('scrolling', 'no');
    const post = (msg) => iframe.contentWindow.postMessage(msg, SIM_ORIGIN);
    const onMessage = (e) => {
      if (e.source !== iframe.contentWindow || e.origin !== SIM_ORIGIN) return;
      const data = e.data;
      if (data.kind === 'ready') {
        clearTimeout(ed.sim.timer);
        setStatus(ed, 'Press ▶ on the board.', '');
        buildSimControls(ed, data.state, post);
      } else if (data.kind === 'state_change') {
        Object.keys(data.change).forEach((id) => {
          const input = ed.sim.inputs[id];
          if (input && document.activeElement !== input) input.value = data.change[id].value;
        });
      } else if (data.kind === 'request_flash') {
        ed.consoleText = '';
        ed.pre.textContent = '';
        clearError(ed);
        post({ kind: 'flash', filesystem: { 'main.py': new TextEncoder().encode(ed.getCode()) } });
        ed.sim.running = true;
        setStatus(ed, 'Running in the simulator ✓', 'ok');
      } else if (data.kind === 'serial_output') {
        appendConsole(ed, data.data);
      } else if (data.kind === 'internal_error') {
        console.error('Simulator error:', data.error);
      }
    };
    ed.sim = { iframe, onMessage, post, inputs: {}, running: false };
    ed.sim.timer = setTimeout(() => {
      setStatus(ed, "The simulator didn't load. Ask your teacher to allow python-simulator.usermbit.org.", 'bad');
    }, 15000);
    window.addEventListener('message', onMessage);
    ed.root.querySelector('.sim-board').appendChild(iframe);
    ed.root.querySelector('.ed-sim').hidden = false;
    const btn = ed.root.querySelector('[data-act=sim]');
    btn.textContent = '✕ Close simulator';
    btn.setAttribute('aria-expanded', 'true');
    setStatus(ed, 'Loading the simulator…', 'busy');
    ed.root.querySelector('.ed-sim').scrollIntoView({ block: 'nearest' });
  }

  function mount(root, opts) {
    opts = opts || {};
    const textarea = root.querySelector('.ed-source');
    const resetEl = root.querySelector('.ed-reset');
    const cm = window.CodeMirror.fromTextArea(textarea, {
      mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, matchBrackets: true,
      viewportMargin: Infinity,
      extraKeys: {
        Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end')),
        'Shift-Tab': (c) => c.indentSelection('subtract'),
        'Ctrl-Enter': () => doSend(), 'Cmd-Enter': () => doSend(),
      },
    });
    const ed = {
      root, cm, status: root.querySelector('.ed-status'),
      consoleBox: root.querySelector('.ed-console'), pre: root.querySelector('.ed-console pre'),
      consoleText: '', errLine: null, changeFns: [], sim: null,
      resetCode: resetEl ? JSON.parse(resetEl.textContent) : null,
      filename: root.dataset.filename || 'microbit',
      getCode: () => cm.getValue(),
      setCode: (c) => cm.setValue(c),
      onChange: (fn) => ed.changeFns.push(fn),
      opts,
    };
    let t = null;
    cm.on('change', () => {
      clearError(ed);
      if (ed.sim && ed.sim.running) {      // stop the old code, so the next ▶ runs the new code
        ed.sim.running = false;
        ed.sim.post({ kind: 'stop' });
        setStatus(ed, 'Code changed. Press ▶ on the board to run it.', '');
      }
      clearTimeout(t);
      t = setTimeout(() => ed.changeFns.forEach((fn) => fn(cm.getValue())), 800);
    });

    // Apps Script pages can't use USB (Google's frame blocks it), so .hex download is the way.
    if (window.MAKERLAB_NO_USB) {
      root.querySelectorAll('[data-act=send],[data-act=stop]').forEach((b) => { b.hidden = true; });
      const hx = root.querySelector('[data-act=hex]');
      if (hx) { hx.classList.remove('ghost'); hx.classList.add('primary'); hx.textContent = '⬇ Download .hex for micro:bit'; }
    }

    async function doSend() {
      if (window.MAKERLAB_NO_USB) { const hx = root.querySelector('[data-act=hex]'); if (hx) hx.click(); return; }
      active = ed;
      ed.consoleText = '';
      ed.pre.textContent = '';
      ed.consoleBox.hidden = false;
      clearError(ed);
      setStatus(ed, window.Microbit.connected ? 'Sending…' : 'Pick your micro:bit in the pop-up…', 'busy');
      try {
        await window.Microbit.send(ed.getCode());
        setStatus(ed, 'Running on your micro:bit ✓', 'ok');
        if (opts.onSend) opts.onSend('serial');
      } catch (e) {
        if (e && e.message === 'NO_MICROPYTHON') setStatus(ed, HELP_NO_MP, 'bad');
        else if (e && e.name === 'NotFoundError') setStatus(ed, 'No micro:bit picked. Plug it in and try again.', 'bad');
        else if (e && e.name === 'NetworkError') setStatus(ed, 'Couldn\'t open the micro:bit. Close other tabs that use it, unplug it, plug it back in and try again.', 'bad');
        else setStatus(ed, (e && e.message) || 'Something went wrong.', 'bad');
      }
    }

    root.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn || !root.contains(btn)) return;
      const act = btn.dataset.act;
      if (act === 'send') doSend();
      else if (act === 'sim') { if (ed.sim) closeSim(ed); else openSim(ed); }
      else if (act === 'stop') {
        try { await window.Microbit.stop(); setStatus(ed, 'Stopped.', ''); } catch (e) { setStatus(ed, e.message, 'bad'); }
      } else if (act === 'hex') {
        setStatus(ed, 'Building .hex…', 'busy');
        try {
          await window.Microbit.downloadHex(ed.getCode(), ed.filename);
          setStatus(ed, 'Downloaded! Drag the .hex file onto the MICROBIT drive.', 'ok');
          if (opts.onSend) opts.onSend('hex');
        } catch (e) { setStatus(ed, 'Could not build the .hex: ' + e.message, 'bad'); }
      } else if (act === 'reset') {
        if (ed.resetCode !== null && confirm('Replace your code with the original? Your changes will be lost.')) ed.setCode(ed.resetCode);
      } else if (act === 'clear') {
        ed.consoleText = ''; ed.pre.textContent = ''; clearError(ed);
      }
    });

    all.push(ed);
    return ed;
  }

  window.Microbit && window.Microbit.onData((text) => { if (active) appendConsole(active, text); });
  window.Microbit && window.Microbit.onStatus((connected) => {
    all.forEach((ed) => ed.root.classList.toggle('connected', connected));
  });

  window.MakerEditor = { mount, all, closeSim };
})();
