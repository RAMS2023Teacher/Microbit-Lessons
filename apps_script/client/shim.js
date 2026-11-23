/* Connects the pages to the Apps Script server.
 *  - fetch('/api/...') becomes google.script.run.api(path, body), one request at a time, with back-to-back saves
 *    to the same place merged so a slow save can never overwrite a newer one.
 *  - links like /lessons/x become ?p=/lessons/x on this web app's address.
 *  - draws the top bar. */
(function () {
  'use strict';
  var ML = window.ML || {};

  // Every server call goes through the one function every version has: api(). ML.run('createClass', ...) becomes
  // api('/api/run', {fn: 'createClass', args: [...]}) and the server picks the function (40_api.js, RUN_).
  // All calls wait in ONE line (one request at a time per browser), identical waiting requests are shared, and
  // "busy" answers (Google's "too many simultaneous invocations", a lock timeout, the server's BUSY) are tried again
  // with growing, spread-out waits. Those errors mean the request did not run, so trying again is safe.
  var BUSY = /simultaneous|too many|BUSY|lock|try again later|invoked too many|quota|service unavailable|timed out/i;
  var queue = Promise.resolve(), waiting = 0, pendingRun = {}, pending = null;
  function rawApi(path, body) {
    return new Promise(function (ok, no) {
      google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) { no(new Error((e && e.message) || String(e))); }).api(path, body);
    });
  }
  function busyNote(on) {
    var n = document.getElementById('busy-note');
    if (!n && on) { n = document.createElement('div'); n.id = 'busy-note'; n.className = 'busy-note'; n.textContent = '⏳ Busy… saving your work'; document.body.appendChild(n); }
    if (n) n.hidden = !on;
  }
  function attempt(path, body, n) {
    return rawApi(path, body).then(function (r) {
      if (r && r.status === 503) throw new Error((r.body && r.body.error) || 'BUSY');
      return r;
    }).catch(function (e) {
      if (n < 5 && BUSY.test(e.message)) {
        busyNote(true);
        var wait = 1200 * Math.pow(1.8, n) + Math.random() * 1500;
        return new Promise(function (r) { setTimeout(r, wait); }).then(function () { return attempt(path, body, n + 1); });
      }
      if (BUSY.test(e.message)) throw new Error('Maker Lab is very busy right now. Your work is safe. Wait a few seconds and try again.');
      throw e;
    });
  }
  function inLine(fn) {
    waiting++;
    var p = queue.catch(function () {}).then(fn);
    var done = function () { if (--waiting === 0) busyNote(false); };
    queue = p.then(done, done);
    return p;
  }
  function callApi(path, body) { return inLine(function () { return attempt(path, body, 0); }); }
  function run(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (name === 'api') return callApi(args[0], args[1]);
    var key = name + '|' + JSON.stringify(args);
    if (pendingRun[key]) return pendingRun[key];                   // the same request is already waiting: share it
    var p = callApi('/api/run', JSON.stringify({ fn: name, args: args })).then(function (r) {
      if (r && r.body && r.body.ok) return r.body.value;
      throw new Error((r && r.body && r.body.error) || 'Something went wrong.');
    });
    pendingRun[key] = p;
    var clear = function () { delete pendingRun[key]; };
    p.then(clear, clear);
    return p;
  }
  ML.run = run;

  // ------------------------------------------------------------ fetch
  function apiCall(path, body) {
    var key = path + '|' + (body.i === undefined ? '' : body.i);
    if (pending && pending.key === key && !pending.started && !body.submit && !/quiz|partner|shop|arcade|help|feedback/.test(path)) {
      Object.keys(body).forEach(function (k) { pending.body[k] = body[k]; });      // merge saves that haven't started yet
      return pending.promise;
    }
    var job = { key: key, body: body, started: false };
    job.promise = inLine(function () {
      job.started = true;
      if (pending === job) pending = null;
      return attempt(path, JSON.stringify(job.body), 0);
    });
    pending = job;
    return job.promise;
  }
  function response(status, body) {
    return { ok: status < 400, status: status, json: function () { return Promise.resolve(body); } };
  }
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    url = String(url);
    if (url.indexOf('/api/') === 0) {
      var body = {};
      try { body = opts && opts.body ? JSON.parse(opts.body) : {}; } catch (e) { body = {}; }
      if (!opts || !opts.method || opts.method === 'GET') body = {};
      return apiCall(url, body).then(function (r) { return response(r.status, r.body); },
        function (e) { return response(500, { ok: false, error: (e && e.message) || 'Could not reach Maker Lab.' }); });
    }
    return realFetch(url, opts);
  };
  /** POST to the lesson API; resolves with the response body. */
  ML.api = function (path, body) {
    return window.fetch(path, { method: 'POST', body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); });
  };

  // ------------------------------------------------------------ links
  ML.href = function (path) {
    var hash = '', i = path.indexOf('#');
    if (i >= 0) { hash = path.slice(i); path = path.slice(0, i); }
    return ML.base + '?p=' + encodeURIComponent(path) + hash;
  };
  // The page lives in a sandboxed frame that may only move the whole tab right after a click. After a slow save the
  // click is "too old" and Chrome refuses (problem reports: "does not have permission to navigate the target frame").
  // Then we show a button instead: tapping it is a fresh click, so the link always works.
  ML.go = function (path, note) {
    var url = ML.href(path);
    try { window.top.location.href = url; } catch (e) { goButton(url, note); }
  };
  function goButton(url, note) {
    var box = document.getElementById('go-box');
    if (!box) { box = document.createElement('div'); box.id = 'go-box'; box.className = 'go-box'; box.setAttribute('role', 'dialog'); document.body.appendChild(box); }
    box.innerHTML = '<div class="go-card"><p></p><a class="btn go big" target="_top">Continue ▶</a></div>';
    box.querySelector('p').textContent = note || 'All saved. Tap Continue to load the page.';
    box.querySelector('a').setAttribute('href', url);
    box.querySelector('a').focus();
  }
  // A sandboxed frame on another origin may set top.location.href but can't call top.location.reload().
  ML.reload = function (note) { ML.go(ML.path || '/', typeof note === 'string' ? note : ''); };
  function fixLinks(root) {
    var links = (root || document).querySelectorAll('a[href^="/"]:not([href^="//"])');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], path = a.getAttribute('href');
      a.setAttribute('href', ML.href(path));
      if (!a.getAttribute('target')) a.setAttribute('target', '_top');
    }
  }
  ML.fixLinks = fixLinks;
  new MutationObserver(function () { fixLinks(document); }).observe(document.documentElement, { childList: true, subtree: true });
  // In-page links (#something) would follow <base target="_top"> and load a blank page: keep them in the page.
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!a || ev.defaultPrevented) return;
    ev.preventDefault();
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, true);

  // ------------------------------------------------------------ helpers for pages.js and lesson.js
  ML.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  ML.avatarAttr = function (a) { return ML.esc(JSON.stringify(a || {})); };

  // ------------------------------------------------------------ top bar
  function topbar() {
    var bar = document.getElementById('topbar'), d = ML.data || {}, h = [];
    if (!bar) return;
    h.push('<a class="brand" href="/" translate="no"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>Maker Lab</a><nav>');
    (ML.nav || []).forEach(function (n) {
      var here = n[0] === ML.path || (n[0] !== '/' && ML.path.indexOf(n[0]) === 0);
      h.push('<a href="' + n[0] + '"' + (here ? ' class="here"' : '') + '>' + ML.esc(n[1]) + '</a>');
    });
    if (!ML.teacher && d.level) {
      h.push('<a class="usermenu-lite" href="/me" title="My robot &amp; badges"><span class="nav-avatar" data-avatar="' + ML.avatarAttr(d.avatar) +
        '" data-size="30"></span><span class="nav-xp"><b id="nav-level">Lv ' + d.level.level + '</b><span class="nav-xp-bar"><i id="nav-xp-fill" style="width:' +
        d.level.pct + '%"></i></span></span> <span translate="no">' + ML.esc(d.name || '') + '</span></a>');
    }
    h.push('<button type="button" class="prefs-btn" id="prefs-open" translate="no" title="Display settings and language" aria-label="Display settings and language">Aa</button>' +
      '<button type="button" class="sound-toggle" id="sound-toggle" title="Sound on or off"></button></nav>');
    bar.innerHTML = h.join('');
    var pb = document.getElementById('prefs-open');
    if (window.MLPrefs) pb.addEventListener('click', function () { window.MLPrefs.open(); }); else pb.remove();
    var st = document.getElementById('sound-toggle');
    var drawSound = function () { var off = window.SFX && window.SFX.muted(); st.textContent = off ? '🔇' : '🔊'; st.setAttribute('aria-label', off ? 'Turn sound on' : 'Turn sound off'); };
    if (window.SFX) { drawSound(); st.addEventListener('click', function () { window.SFX.toggle(); drawSound(); }); } else st.remove();
  }
  // "Arcade open" in the top bar, while the teacher has the arcade open and the student has play time (35_arcade.js)
  ML.arcadePill = function (st) {
    var bar = document.querySelector('#topbar nav'), pill = document.getElementById('nav-arcade');
    if (!bar || ML.teacher) return;
    if (!st || !st.can_play) { if (pill) pill.remove(); return; }
    if (!pill) {
      pill = document.createElement('a');
      pill.id = 'nav-arcade'; pill.className = 'arcade-pill'; pill.setAttribute('href', ML.href('/arcade')); pill.setAttribute('target', '_top');
      bar.insertBefore(pill, bar.firstChild);
    }
    pill.textContent = '🎮 Arcade open · ' + Math.floor(st.bank / 60) + ':' + String(st.bank % 60).padStart(2, '0') + ' to play';
  };

  ML.updateLevel = function (lv) {
    if (!lv) return;
    var b = document.getElementById('nav-level'), f = document.getElementById('nav-xp-fill');
    if (b) b.textContent = 'Lv ' + lv.level;
    if (f) f.style.width = lv.pct + '%';
  };

  topbar();
  if (ML.preview) {                              // 👀 student view: always show how to get out
    var bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.innerHTML = '👀 <b>Student view</b>: ' + ML.esc(ML.preview.cls) + ' (' + ML.esc(ML.preview.grade) + '). This is what students see; nothing is saved. ' +
      '<a class="btn small" href="/exit-student-view">Exit student view</a>';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  var fb = document.getElementById('footer-bug');
  if (fb) { if (window.MLBugs) fb.addEventListener('click', function () { window.MLBugs.open(); }); else fb.remove(); }
  if (ML.data && ML.data.arcade_state && ML.path !== '/arcade') ML.arcadePill(ML.data.arcade_state);
  fixLinks(document);
  window.addEventListener('load', function () {
    if (window.showRewards && ML.data && ML.data.rewards) window.showRewards(ML.data.rewards);
  });
  window.ML = ML;
})();
