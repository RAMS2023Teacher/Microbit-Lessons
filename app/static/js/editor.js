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
      consoleText: '', errLine: null, changeFns: [],
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
      clearTimeout(t);
      t = setTimeout(() => ed.changeFns.forEach((fn) => fn(cm.getValue())), 800);
    });

    async function doSend() {
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

  window.MakerEditor = { mount, all };
})();
