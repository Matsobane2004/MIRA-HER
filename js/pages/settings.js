// Settings: profile, topics, alerts, privacy, password, recovery code, delete account
window.pageInit = function (user) {
  const { qs, esc, icon, avatar, AVATARS, toast, modal, confirmBox, showError, setBusy } = MIRA;
  let me = user;
  const save = (patch, message = 'Saved.') => {
    try { me = Store.updateMe(patch); toast(message); render(); } catch (err) { toast(err.message, 'error'); }
  };

  qs('#radius').innerHTML = Store.RADII.map((r) => `<option value="${r}">Within ${r} km</option>`).join('');

  function render() {
    qs('#currentAvatar').innerHTML = avatar(me.avatar, 'lg');
    qs('#aliasLabel').textContent = me.alias;
    qs('#avatarGrid').innerHTML = AVATARS.map((a) => `<button type="button" class="avatar-option${a.id === me.avatar ? ' on' : ''}" data-avatar="${a.id}" aria-label="${a.label}" aria-pressed="${a.id === me.avatar}">${avatar(a.id, 'md')}</button>`).join('');
    qs('#topicChips').innerHTML = Store.TOPICS.map((t) => `<button type="button" class="chip${me.topics.includes(t) ? ' on' : ''}" data-topic="${esc(t)}" aria-pressed="${me.topics.includes(t)}">${esc(t)}</button>`).join('');
    qs('#areaChips').innerHTML = Store.AREAS.map((a) => `<button type="button" class="chip${me.areas.includes(a.id) ? ' on' : ''}" data-area="${a.id}" aria-pressed="${me.areas.includes(a.id)}">${esc(a.name)}</button>`).join('');
    qs('#nearbyAlerts').checked = me.settings.nearbyAlerts !== false;
    qs('#radius').value = String(me.settings.alertRadiusKm || 3);
    qs('#logoutOnExit').checked = me.settings.logoutOnExit !== false;
  }

  qs('#avatarGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-avatar]');
    if (b) save({ avatar: b.dataset.avatar }, 'Avatar updated.');
  });
  qs('#topicChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    const set = new Set(me.topics);
    if (set.has(b.dataset.topic)) set.delete(b.dataset.topic); else set.add(b.dataset.topic);
    save({ topics: [...set] }, 'Topics saved.');
  });
  qs('#areaChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (!b) return;
    const set = new Set(me.areas);
    if (set.has(b.dataset.area)) set.delete(b.dataset.area); else set.add(b.dataset.area);
    save({ areas: [...set] }, 'Areas saved.');
  });
  qs('#nearbyAlerts').addEventListener('change', (e) => save({ settings: { nearbyAlerts: e.target.checked } }, 'Alert settings saved.'));
  qs('#radius').addEventListener('change', (e) => save({ settings: { alertRadiusKm: Number(e.target.value) } }, 'Alert settings saved.'));
  qs('#logoutOnExit').addEventListener('change', (e) => save({ settings: { logoutOnExit: e.target.checked } }, 'Quick Exit setting saved.'));

  qs('#pwForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const errorBox = qs('#pwError');
    showError(errorBox, '');
    const btn = e.target.querySelector('button[type=submit]');
    setBusy(btn, true, 'Saving…');
    setTimeout(() => {
      try {
        Store.changePassword(qs('#currentPw').value, qs('#newPw').value);
        qs('#currentPw').value = '';
        qs('#newPw').value = '';
        toast('Password changed.');
      } catch (err) { showError(errorBox, err.message); }
      setBusy(btn, false);
    }, 30);
  });

  qs('#newCodeBtn').addEventListener('click', () => {
    const m = modal(`<h3>${icon('key')} Make a new recovery code</h3><p class="muted mb-16">Enter your password to continue.</p>
      <form><div class="form-error" hidden></div><div class="field"><label for="rcPw">Password</label><input id="rcPw" type="password" autocomplete="current-password"></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-purple" type="submit">Continue</button></div></form>`);
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const code = Store.newRecoveryCode(m.el.querySelector('#rcPw').value);
        m.el.innerHTML = `<button class="modal-close" aria-label="Close">${icon('x')}</button><h3>${icon('check-circle')} Your new recovery code</h3>
          <p class="muted">Save it somewhere private. Your old code no longer works.</p><div class="code-box">${esc(code)}</div>
          <div class="modal-actions"><button class="btn btn-coral" data-close>I’ve saved it</button></div>`;
      } catch (err) { showError(m.el.querySelector('.form-error'), err.message); }
    });
  });

  qs('#deleteBtn').addEventListener('click', () => {
    const m = modal(`<h3 style="color:var(--red)">${icon('warning')} Delete your account?</h3>
      <p class="muted mb-16">Everything you wrote will be permanently deleted. Type your password to confirm.</p>
      <form><div class="form-error" hidden></div><div class="field"><label for="delPw">Password</label><input id="delPw" type="password" autocomplete="current-password"></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Keep my account</button><button class="btn btn-danger" type="submit">Delete for good</button></div></form>`);
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        Store.deleteAccount(m.el.querySelector('#delPw').value);
        location.href = 'index.html';
      } catch (err) { showError(m.el.querySelector('.form-error'), err.message); }
    });
  });

  qs('#resetBtn').addEventListener('click', async () => {
    if (await confirmBox('Reset demo data?', 'This clears every account, post and alert made on this device, logs you out and restores the original demo content.', 'Reset everything', true)) {
      Store.resetDemo();
      location.href = 'login.html';
    }
  });

  render();
  if (location.hash === '#areas') qs('#areas').scrollIntoView();
};
