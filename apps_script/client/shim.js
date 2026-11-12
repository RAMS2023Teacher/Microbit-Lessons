/* Makes the Flask site's browser code work inside Google Apps Script.
 *  - fetch('/api/...') becomes google.script.run.api(path, body), one request at a time, with
 *    queued saves to the same place merged so a slow save can never overwrite a newer one.
 *  - the micro:bit firmware for .hex files comes from the teacher's Drive (then cached in the browser).
 *  - links like /lessons/x become ?p=/lessons/x on this web app's address.
 *  - lesson pages are filled in with the student's saved work before the lesson code starts. */
(function () {
  'use strict';
  var ML = window.ML || {};
  window.MAKERLAB_NO_USB = true;

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
    // merge back-to-back saves to the same lesson that haven't started yet
    if (pending && pending.path === path && /\/save$/.test(path) && !pending.started) {
      Object.keys(body).forEach(function (k) { pending.body[k] = body[k]; });
      return pending.promise;
    }
    var job = { path: path, body: body, started: false };
    job.promise = queue = queue.catch(function () {}).then(function () {
      job.started = true;
      if (pending === job) pending = null;
      return run('api', path, JSON.stringify(job.body));
    });
    pending = job;
    return job.promise;
  }
  function response(status, body) {
    return { ok: status < 400, status: status, json: function () { return Promise.resolve(body); },
             text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); } };
  }
  function firmware(name) {
    var key = 'ml-firmware-' + name;
    try { var kept = localStorage.getItem(key); if (kept) return Promise.resolve(kept); } catch (e) { /* no storage */ }
    return run('firmwareInfo', name).then(function (info) {
      var parts = [];
      for (var i = 0; i < info.parts; i++) parts.push(run('firmwarePart', name, i));
      return Promise.all(parts);
    }).then(function (parts) {
      var text = parts.join('');
      try { localStorage.setItem(key, text); } catch (e) { /* full or blocked: fetch again next time */ }
      return text;
    });
  }
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    url = String(url);
    var fw = /micropython-(v1|v2)\.hex$/.exec(url);
    if (fw) return firmware(fw[1]).then(function (t) { return response(200, t); });
    if (url.indexOf('/api/') === 0) {
      var body = {};
      try { body = opts && opts.body ? JSON.parse(opts.body) : {}; } catch (e) { body = {}; }
      if (!opts || !opts.method || opts.method === 'GET') body = {};
      return apiCall(url, body).then(function (r) { return response(r.status, r.body); },
        function (e) { return response(500, { ok: false, error: (e && e.message) || 'Could not reach Maker Lab.' }); });
    }
    return realFetch(url, opts);
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
  // In-page links (#challenge, the lesson's side menu) would follow <base target="_top"> and load this
  // frame's own address in the whole window: a blank page. Keep them inside the page instead.
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!a || ev.defaultPrevented) return;
    var id = a.getAttribute('href').slice(1);
    ev.preventDefault();
    if (!id) return;
    if (location.hash !== '#' + id) location.hash = id;      // lesson.js shows that part of the lesson
    var el = document.getElementById(id);
    if (el && !el.hidden && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }, true);
  new MutationObserver(function () { fixLinks(document); }).observe(document.documentElement, { childList: true, subtree: true });

  // ------------------------------------------------------------ helpers for pages.js
  ML.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  ML.avatarAttr = function (a) { return ML.esc(JSON.stringify(a || {})); };

  // ------------------------------------------------------------ top bar
  function topbar() {
    var bar = document.getElementById('topbar'), d = ML.data || {}, h = [];
    h.push('<a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>micro:bit Maker Lab</a><nav>');
    (ML.nav || []).forEach(function (n) { h.push('<a href="' + n[0] + '">' + ML.esc(n[1]) + '</a>'); });
    if (!ML.teacher && d.level) {
      h.push('<a class="usermenu-lite" href="/me" title="My robot &amp; badges"><span class="nav-avatar" data-avatar="' + ML.avatarAttr(d.avatar) +
        '" data-size="30"></span><span class="nav-xp"><b id="nav-level">Lv ' + d.level.level + '</b><span class="nav-xp-bar"><i id="nav-xp-fill" style="width:' +
        d.level.pct + '%"></i></span></span> ' + ML.esc(d.name || '') + '</a>');
    }
    h.push('</nav>');
    bar.innerHTML = h.join('');
  }

  // ------------------------------------------------------------ lesson pages: put the student's work back
  function lessonPage() {
    var S = window.STATE || {}, d = ML.data || {}, $ = function (id) { return document.getElementById(id); };
    var set = function (id, v) { var el = $(id); if (el && v != null) el.value = v; };
    set('warmup-answer', S.warmup_answer);
    set('debug-reflection', S.debug_reflection);
    set('challenge-response', S.challenge_response);
    var editors = { 'ed-code': S.code, 'ed-practice': S.practice_code, 'ed-debug': S.debug_code, 'ed-challenge': S.challenge_code };
    Object.keys(editors).forEach(function (id) {
      var src = document.querySelector('#' + id + ' .ed-source');
      if (src && editors[id] != null) src.value = editors[id];
    });
    if ($('reflection')) $('reflection').hidden = !S.debug_solved;
    if ($('challenge-status') && S.challenge_submitted) $('challenge-status').textContent = 'Submitted ✓ (you can resubmit)';
    if ($('lesson-xp')) $('lesson-xp').textContent = d.lesson_xp || 0;
    var xpMax = document.querySelector('.xp-chip');
    if (xpMax) xpMax.innerHTML = '⚡ <b id="lesson-xp">' + (d.lesson_xp || 0) + '</b> / ' + (d.xp_possible || 0) + ' XP';
    if ($('lesson-stars')) $('lesson-stars').textContent = '★'.repeat(d.stars || 0) + '☆'.repeat(3 - (d.stars || 0));
    var head = document.querySelector('.lesson-head');
    if (S.feedback && head) {
      var fb = document.createElement('div');
      fb.className = 'card feedback-note';
      fb.innerHTML = '<b>💬 Feedback from your teacher</b><div></div>';
      fb.lastChild.textContent = S.feedback;
      head.insertAdjacentElement('afterend', fb);
    }
    if ($('timer')) $('timer').hidden = !ML.teacher;      // the lesson timer is only for the teacher
    if (ML.teacher && $('partner-box')) $('partner-box').remove();      // partners are for students
    if (ML.teacher && $('lesson')) $('lesson').dataset.teacher = '1';   // no first-visit tour for the teacher
    if (ML.teacher) {
      var rewards = document.querySelector('.lesson-rewards');
      if (rewards) rewards.remove();
      var overview = $('overview');
      if (d.teacher_key && overview) overview.insertAdjacentHTML('beforebegin', d.teacher_key);
      var std = document.querySelector('.standards-box');
      if (std) std.open = true;
    }
    var box = document.querySelector('.video-box'), v = d.video;
    if (box && v) {
      box.textContent = '';
      if (v.kind === 'iframe') {
        var f = box.appendChild(document.createElement('iframe'));
        f.src = v.src; f.title = 'Lesson video'; f.allow = 'encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
      } else if (v.kind === 'video') {
        var vid = box.appendChild(document.createElement('video')); vid.src = v.src; vid.controls = true;
      } else {
        var a = box.appendChild(document.createElement('a')); a.href = v.src; a.target = '_blank'; a.rel = 'noopener';
        a.className = 'video-link'; a.textContent = '▶ Watch the lesson video';
      }
    } else if (box && ML.teacher) {
      var ph = box.querySelector('.video-placeholder');
      if (ph) ph.insertAdjacentHTML('beforeend', '<small>Add one on the <a href="/teacher/videos">Videos</a> page.</small>');
    }
  }

  topbar();
  if (ML.page === 'lesson') lessonPage();
  fixLinks(document);
  window.addEventListener('load', function () {
    if (window.showRewards && ML.data && ML.data.rewards) window.showRewards(ML.data.rewards);
  });
  window.ML = ML;
})();
