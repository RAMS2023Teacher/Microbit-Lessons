/* Connects the pages to the Apps Script server.
 *  - fetch('/api/...') becomes google.script.run.api(path, body), one request at a time, with back-to-back saves
 *    to the same place merged so a slow save can never overwrite a newer one.
 *  - links like /lessons/x become ?p=/lessons/x on this web app's address.
 *  - draws the top bar. */
(function () {
  'use strict';
  var ML = window.ML || {};

  function run(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (ok, no) {
      var r = google.script.run.withSuccessHandler(ok).withFailureHandler(no);
      r[name].apply(r, args);
    });
  }
  ML.run = run;

  // ------------------------------------------------------------ fetch
  var queue = Promise.resolve(), pending = null;
  function apiCall(path, body) {
    var key = path + '|' + (body.i === undefined ? '' : body.i);
    if (pending && pending.key === key && !pending.started && !body.submit && !/quiz|partner/.test(path)) {
      Object.keys(body).forEach(function (k) { pending.body[k] = body[k]; });      // merge saves that haven't started yet
      return pending.promise;
    }
    var job = { key: key, body: body, started: false };
    job.promise = queue = queue.catch(function () {}).then(function () {
      job.started = true;
      if (pending === job) pending = null;
      return run('api', path, JSON.stringify(job.body));
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
  ML.go = function (path) { window.top.location.href = ML.href(path); };
  // A sandboxed frame on another origin may set top.location.href but can't call top.location.reload().
  ML.reload = function () { ML.go(ML.path || '/'); };
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
    h.push('<a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>Maker Lab</a><nav>');
    (ML.nav || []).forEach(function (n) {
      var here = n[0] === ML.path || (n[0] !== '/' && ML.path.indexOf(n[0]) === 0);
      h.push('<a href="' + n[0] + '"' + (here ? ' class="here"' : '') + '>' + ML.esc(n[1]) + '</a>');
    });
    if (!ML.teacher && d.level) {
      h.push('<a class="usermenu-lite" href="/me" title="My robot &amp; badges"><span class="nav-avatar" data-avatar="' + ML.avatarAttr(d.avatar) +
        '" data-size="30"></span><span class="nav-xp"><b id="nav-level">Lv ' + d.level.level + '</b><span class="nav-xp-bar"><i id="nav-xp-fill" style="width:' +
        d.level.pct + '%"></i></span></span> ' + ML.esc(d.name || '') + '</a>');
    }
    h.push('</nav>');
    bar.innerHTML = h.join('');
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
  if (ML.data && ML.data.arcade_state && ML.path !== '/arcade') ML.arcadePill(ML.data.arcade_state);
  fixLinks(document);
  window.addEventListener('load', function () {
    if (window.showRewards && ML.data && ML.data.rewards) window.showRewards(ML.data.rewards);
  });
  window.ML = ML;
})();
