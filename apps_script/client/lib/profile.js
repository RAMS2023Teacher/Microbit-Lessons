/* Avatar builder. */
(function () {
  'use strict';
  const C = window.CATALOG;
  const state = Object.assign({}, window.AVATAR);
  const $ = (id) => document.getElementById(id);
  const csrf = document.querySelector('meta[name=csrf-token]').content;
  let part = document.querySelector('.part-tab').dataset.part;

  function preview() {
    state.name = $('avatar-name').value;
    $('avatar-preview').innerHTML = RobotAvatar.svg(state, 220);
  }

  function options() {
    const box = $('part-options');
    box.innerHTML = '';
    C[part].forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'part-opt' + (state[part] === opt.id ? ' chosen' : '') + (opt.unlocked ? '' : ' locked');
      const look = Object.assign({}, state, { [part]: opt.id });
      b.innerHTML = RobotAvatar.svg(look, 64) + `<span>${opt.unlocked ? '' : '🔒 '}${opt.label}</span>` +
        (opt.unlocked ? '' : `<small>${opt.how}</small>`);
      b.title = opt.unlocked ? opt.label : `${opt.label} — ${opt.how}`;
      b.setAttribute('aria-pressed', state[part] === opt.id);
      b.disabled = !opt.unlocked;
      b.addEventListener('click', () => { state[part] = opt.id; preview(); options(); dirty(); });
      box.appendChild(b);
    });
  }

  function dirty() { $('avatar-status').textContent = 'Not saved yet'; $('avatar-status').className = 'save-status small'; }

  document.querySelectorAll('.part-tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.part-tab').forEach((x) => x.classList.toggle('active', x === t));
    part = t.dataset.part;
    options();
  }));
  $('avatar-name').addEventListener('input', () => { preview(); dirty(); });
  $('avatar-random').addEventListener('click', () => {
    Object.keys(C).forEach((k) => {
      const open = C[k].filter((o) => o.unlocked);
      state[k] = open[Math.floor(Math.random() * open.length)].id;
    });
    preview(); options(); dirty();
  });
  $('avatar-save').addEventListener('click', async () => {
    preview();
    const r = await fetch('/api/avatar', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify(state),
    });
    const d = await r.json().catch(() => ({}));
    $('avatar-status').textContent = d.ok ? 'Saved ✓' : (d.error || 'Could not save.');
    $('avatar-status').className = 'save-status small ' + (d.ok ? 'ok' : 'bad');
    if (d.ok) {
      document.querySelectorAll('.nav-avatar').forEach((el) => { el.dataset.avatar = JSON.stringify(d.avatar); });
      RobotAvatar.renderAll();
      if (window.showRewards) showRewards(d.rewards);
    }
  });
  preview();
  options();
})();
