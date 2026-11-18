/* Game-style sounds, made with Web Audio (no sound files to download).
 *   SFX.play('coin' | 'tick' | 'ready' | 'step' | 'fanfare' | 'badge' | 'levelup' | 'buy' | 'nope' | 'pass')
 *   SFX.muted(), SFX.toggle()  -- the choice is remembered on this Chromebook.
 * Browsers only allow sound after a click or key press, so nothing plays before the student does something. */
(function () {
  'use strict';
  const KEY = 'ml-sound';
  let ctx = null, master = null;
  let off = false;
  try { off = localStorage.getItem(KEY) === 'off'; } catch (e) { /* no storage */ }

  function audio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return ctx;
  }
  // wake the audio up on the first click or key press (browser rule)
  const wake = () => { const c = audio(); if (c && c.state === 'suspended') c.resume(); };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);

  /** One note: frequency (Hz), start (s from now), length (s), wave, volume, optional slide to another pitch. */
  function note(f, at, len, type, vol, slideTo) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + len + 0.05);
  }
  function noise(at, len, vol) {
    const c = audio();
    if (!c) return;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), g = c.createGain(), hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    src.buffer = buf; g.gain.value = vol || 0.2;
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(c.currentTime + at);
  }
  const N = { C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, B5: 987.8, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568, C7: 2093 };

  const SOUNDS = {
    tick: () => note(N.A5, 0, 0.07, 'sine', 0.22),
    ready: () => { note(N.E5, 0, 0.09, 'triangle', 0.25); note(N.A5, 0.08, 0.16, 'triangle', 0.25); },
    coin: () => { note(N.B5, 0, 0.08, 'square', 0.16); note(N.E6, 0.075, 0.35, 'square', 0.16); },
    step: () => { note(N.C6, 0, 0.07, 'square', 0.14); note(N.E6, 0.06, 0.07, 'square', 0.14); note(N.G6, 0.12, 0.28, 'square', 0.14); },
    pass: () => [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => note(f, i * 0.08, 0.22, 'triangle', 0.28)),
    fanfare: () => {
      [N.C5, N.E5, N.G5].forEach((f, i) => note(f, i * 0.1, 0.14, 'square', 0.13));
      [N.C6, N.E6, N.G6].forEach((f) => note(f, 0.32, 0.6, 'triangle', 0.16));
      noise(0.32, 0.25, 0.08);
    },
    badge: () => {
      [N.E6, N.G6, N.C7, N.G6, N.C7].forEach((f, i) => note(f, i * 0.07, 0.18, 'sine', 0.2));
      note(N.C6, 0.36, 0.7, 'triangle', 0.18); note(N.E6, 0.36, 0.7, 'triangle', 0.12);
    },
    levelup: () => {
      [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6].forEach((f, i) => note(f, i * 0.07, 0.12, 'square', 0.12));
      [N.C6, N.E6, N.G6, N.C7].forEach((f) => note(f, 0.46, 0.9, 'triangle', 0.13));
      noise(0.46, 0.4, 0.1);
    },
    buy: () => { noise(0, 0.05, 0.25); note(N.G6, 0.05, 0.12, 'square', 0.13); note(N.C7, 0.13, 0.4, 'square', 0.13); noise(0.13, 0.12, 0.08); },
    help: () => {                                           // a doorbell, twice: someone needs help
      [0, 0.9].forEach((t) => { note(N.E6, t, 0.5, 'sine', 0.32); note(N.C6, t + 0.32, 0.8, 'sine', 0.32); note(N.G5, t + 0.32, 0.8, 'triangle', 0.12); });
    },
    nope: () => { note(180, 0, 0.12, 'sawtooth', 0.16, 150); note(130, 0.12, 0.2, 'sawtooth', 0.16, 100); },
  };

  window.SFX = {
    play(name) { if (off || !SOUNDS[name]) return; try { wake(); SOUNDS[name](); } catch (e) { /* no audio here */ } },
    muted: () => off,
    toggle() { off = !off; try { localStorage.setItem(KEY, off ? 'off' : 'on'); } catch (e) { /* no storage */ } if (!off) this.play('coin'); return off; },
  };
})();
