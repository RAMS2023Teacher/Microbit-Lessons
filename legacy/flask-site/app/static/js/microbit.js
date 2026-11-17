/* Talk to a micro:bit running MicroPython.
 *
 *  - send(code): over Web Serial, copy the code to main.py on the micro:bit
 *    using the MicroPython raw REPL, then soft-reset so it runs.
 *  - downloadHex(code, name): build a MicroPython .hex with the code inside
 *    (works in every browser; drag it to the MICROBIT drive).
 *  - Serial output (print() and error messages) is delivered to listeners.
 */
(function () {
  'use strict';
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const MB = {
    port: null, writer: null, reader: null,
    buffer: '',          // protocol buffer while a command is in flight
    capturing: false,    // when true, data goes to the buffer and not the console
    listeners: new Set(),
    statusListeners: new Set(),
    busy: false,

    supported() { return 'serial' in navigator; },
    get connected() { return !!this.port && !!this.writer; },

    onData(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    onStatus(fn) { this.statusListeners.add(fn); return () => this.statusListeners.delete(fn); },
    _status() { this.statusListeners.forEach((fn) => fn(this.connected)); },

    async connect() {
      if (!this.supported()) {
        throw new Error('This browser can\'t talk to USB devices. Use Chrome or Edge, or click "Download .hex".');
      }
      if (this.connected) return;
      let port;
      const known = (await navigator.serial.getPorts()).filter((p) => (p.getInfo().usbVendorId === 0x0d28));
      if (known.length === 1) port = known[0];
      else port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x0d28 }] });
      await port.open({ baudRate: 115200 });
      this.port = port;
      this.writer = port.writable.getWriter();
      this._readLoop();
      navigator.serial.addEventListener('disconnect', (e) => { if (e.target === this.port) this._cleanup(); });
      this._status();
    },

    async _readLoop() {
      const port = this.port;
      while (port && port.readable && this.port === port) {
        this.reader = port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            const text = dec.decode(value, { stream: true });
            if (this.capturing) this.buffer += text;
            else this.listeners.forEach((fn) => fn(text));
          }
        } catch (e) {
          break;
        } finally {
          try { this.reader.releaseLock(); } catch (e) { /* ignore */ }
        }
      }
      this._cleanup();
    },

    _cleanup() {
      this.port = null; this.writer = null; this.reader = null;
      this._status();
    },

    async disconnect() {
      const port = this.port;
      try { if (this.reader) await this.reader.cancel(); } catch (e) { /* ignore */ }
      try { if (this.writer) this.writer.releaseLock(); } catch (e) { /* ignore */ }
      try { if (port) await port.close(); } catch (e) { /* ignore */ }
      this._cleanup();
    },

    async _write(str) {
      // micro:bit's USB serial buffer is small: send in slices
      const bytes = enc.encode(str);
      for (let i = 0; i < bytes.length; i += 64) {
        await this.writer.write(bytes.slice(i, i + 64));
        await sleep(8);
      }
    },

    async _waitFor(pattern, timeout) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const idx = this.buffer.indexOf(pattern);
        if (idx !== -1) {
          const before = this.buffer.slice(0, idx + pattern.length);
          this.buffer = this.buffer.slice(idx + pattern.length);
          return before;
        }
        await sleep(20);
      }
      throw new Error('timeout');
    },

    /* Run one statement in the raw REPL; returns [stdout, stderr]. */
    async _exec(stmt) {
      this.buffer = '';
      await this._write(stmt);
      await this._write('\x04');
      await this._waitFor('OK', 3000);
      const out = await this._waitFor('\x04', 5000);
      const err = await this._waitFor('\x04', 5000);
      await this._waitFor('>', 2000);
      return [out.slice(0, -1), err.slice(0, -1)];
    },

    async _enterRaw() {
      this.capturing = true;
      this.buffer = '';
      await this._write('\r\x03\x03');      // stop a running program
      await sleep(150);
      this.buffer = '';
      await this._write('\x01');            // raw REPL
      try {
        await this._waitFor('raw REPL; CTRL-B to exit\r\n>', 2500);
      } catch (e) {
        // One retry - a busy program can swallow the first Ctrl-C
        await this._write('\r\x03\x03\x01');
        try {
          await this._waitFor('raw REPL; CTRL-B to exit\r\n>', 2500);
        } catch (e2) {
          this.capturing = false;
          const err = new Error('NO_MICROPYTHON');
          throw err;
        }
      }
    },

    async stop() {
      if (!this.connected) await this.connect();
      await this._write('\r\x03\x03');
    },

    async send(code) {
      if (this.busy) return;
      this.busy = true;
      try {
        if (!this.connected) await this.connect();
        await this._enterRaw();
        await this._exec("f=open('main.py','w')");
        for (let i = 0; i < code.length; i += 120) {
          const chunk = code.slice(i, i + 120);
          const [, err] = await this._exec('f.write(' + JSON.stringify(chunk) + ')');
          if (err.trim()) throw new Error('Writing failed: ' + err.trim());
        }
        await this._exec('f.close()');
        await this._write('\x02');            // leave raw REPL
        await sleep(100);
        this.capturing = false;
        this.buffer = '';
        await this._write('\x04');            // soft reset -> runs main.py
      } finally {
        this.capturing = false;
        this.busy = false;
      }
    },

    _hexCache: null,
    async _firmware() {
      if (!this._hexCache) {
        const base = (document.querySelector('meta[name=static-root]') || {}).content || '/static/';
        const [v1, v2] = await Promise.all([
          fetch(base + 'vendor/microbit/micropython-v1.hex').then((r) => r.text()),
          fetch(base + 'vendor/microbit/micropython-v2.hex').then((r) => r.text()),
        ]);
        this._hexCache = { v1, v2 };
      }
      return this._hexCache;
    },

    async downloadHex(code, name) {
      const fw = await this._firmware();
      const fs = new window.microbitFs.MicropythonFsHex([
        { hex: fw.v1, boardId: 0x9900 },
        { hex: fw.v2, boardId: 0x9903 },
      ]);
      fs.write('main.py', code);
      const blob = new Blob([fs.getUniversalHex()], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (name || 'microbit') + '.hex';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    },
  };

  window.Microbit = MB;
})();
