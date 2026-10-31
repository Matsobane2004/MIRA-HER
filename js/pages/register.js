// Join anonymously: 4 steps (alias, topics, password, recovery code)
window.pageInit = function () {
  const { qs, qsa, esc, icon, avatar, AVATARS, setBusy, showError, toast } = MIRA;
  const ADJECTIVES = ['Brave', 'Quiet', 'Gentle', 'Golden', 'Wild', 'Still', 'Sunny', 'Kind', 'Bright', 'Soft', 'Bold', 'Calm', 'Rising', 'Velvet', 'Silver', 'Free'];
  const NOUNS = ['Lily', 'River', 'Protea', 'Marula', 'Jasmine', 'Ember', 'Willow', 'Sparrow', 'Orchid', 'Harbour', 'Iris', 'Fynbos', 'Moon', 'Meadow', 'Clover', 'Dawn'];
  const state = { step: 1, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)].id, topics: new Set(), areas: new Set(), code: '' };
  const errorBox = qs('#regError');
  const aliasInput = qs('#alias');

  // ---------- Step 1 ----------
  function randomAlias() {
    for (let i = 0; i < 20; i++) {
      let name = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + NOUNS[Math.floor(Math.random() * NOUNS.length)];
      if (i > 5) name += Math.floor(Math.random() * 90 + 10);
      if (Store.aliasAvailable(name).available) return name;
    }
    return `Member${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  function checkAlias() {
    const hint = qs('#aliasHint');
    const result = Store.aliasAvailable(aliasInput.value);
    if (result.available) { hint.className = 'hint good'; hint.innerHTML = `${icon('check-circle')} That alias is free.`; return true; }
    hint.className = 'hint bad';
    hint.innerHTML = `${icon('warning-circle')} ${esc(result.reason || 'That alias is taken. Try another one.')}`;
    return false;
  }
  aliasInput.value = randomAlias();
  checkAlias();
  aliasInput.addEventListener('input', checkAlias);
  qs('#shuffle').addEventListener('click', () => { aliasInput.value = randomAlias(); checkAlias(); });

  const grid = qs('#avatarGrid');
  function renderAvatars() {
    grid.innerHTML = AVATARS.map((a) => `<button type="button" class="avatar-option${a.id === state.avatar ? ' on' : ''}" data-avatar="${a.id}" aria-label="${a.label}" aria-pressed="${a.id === state.avatar}">${avatar(a.id, 'lg')}</button>`).join('');
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-avatar]');
    if (!b) return;
    state.avatar = b.dataset.avatar;
    renderAvatars();
  });
  renderAvatars();

  // ---------- Step 2 ----------
  const topicIcons = { 'Safety & Abuse': 'shield-check', 'Mental Wellbeing': 'brain', Relationships: 'heart', Motherhood: 'baby', 'Reproductive Health': 'flower-lotus', 'Money & Independence': 'wallet', Careers: 'briefcase', 'Women in Tech': 'laptop', 'Student Life': 'student', 'Staying Safe in SA': 'map-pin' };
  ['Mental Wellbeing', 'Women in Tech'].forEach((t) => state.topics.add(t));
  function renderChips() {
    qs('#topicChips').innerHTML = Store.TOPICS.map((t) => `<button type="button" class="chip${state.topics.has(t) ? ' on' : ''}" data-topic="${esc(t)}" aria-pressed="${state.topics.has(t)}">${icon(topicIcons[t] || 'circle')} ${esc(t)}</button>`).join('');
    qs('#areaChips').innerHTML = Store.AREAS.map((a) => `<button type="button" class="chip${state.areas.has(a.id) ? ' on' : ''}" data-area="${a.id}" aria-pressed="${state.areas.has(a.id)}">${icon('map-pin')} ${esc(a.name)}</button>`).join('');
  }
  qs('#topicChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    const t = b.dataset.topic;
    if (state.topics.has(t)) state.topics.delete(t); else state.topics.add(t);
    renderChips();
  });
  qs('#areaChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (!b) return;
    const a = b.dataset.area;
    if (state.areas.has(a)) state.areas.delete(a); else state.areas.add(a);
    renderChips();
  });
  renderChips();

  // ---------- Step 3 ----------
  const pw = qs('#password');
  pw.addEventListener('input', () => {
    const v = pw.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const levels = [['0%', 'var(--red)', ''], ['25%', 'var(--red)', 'Too weak'], ['50%', 'var(--amber)', 'Okay'], ['75%', 'var(--green)', 'Strong'], ['100%', 'var(--green)', 'Very strong']];
    const [w, color, label] = levels[Math.min(score, 4)];
    const bar = qs('#strengthBar');
    bar.style.width = v ? w : '0%';
    bar.style.background = color;
    qs('#strengthHint').textContent = v.length && v.length < 8 ? `${8 - v.length} more character${8 - v.length === 1 ? '' : 's'} needed` : label || ' ';
  });

  // ---------- Step 4 ----------
  qs('#copyCode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.code); toast('Recovery code copied.'); }
    catch { toast('Couldn’t copy automatically. Please write the code down.', 'error'); }
  });
  qs('#downloadCode').addEventListener('click', () => {
    const blob = new Blob([`MIRA Her recovery code\n\nAlias: ${aliasInput.value}\nRecovery code: ${state.code}\n\nKeep this private. You need it to reset your password.\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mira-her-recovery-code.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  qs('#savedCode').addEventListener('change', (e) => { qs('#nextBtn').disabled = !e.target.checked; });

  // ---------- Navigation ----------
  function show(step) {
    state.step = step;
    qsa('[data-step]').forEach((s) => { s.hidden = Number(s.dataset.step) !== step; });
    qsa('.progress div').forEach((d, i) => d.classList.toggle('on', i < step));
    qs('#backBtn').style.visibility = step === 1 || step === 4 ? 'hidden' : 'visible';
    const next = qs('#nextBtn');
    next.innerHTML = step === 3 ? 'Create my account' : step === 4 ? `Enter MIRA Her ${icon('arrow-right')}` : 'Continue';
    next.disabled = step === 4 && !qs('#savedCode').checked;
    qs('#loginLink').hidden = step === 4;
    showError(errorBox, '');
    window.scrollTo(0, 0);
  }

  qs('#backBtn').addEventListener('click', () => show(Math.max(1, state.step - 1)));
  qs('#nextBtn').addEventListener('click', () => {
    showError(errorBox, '');
    if (state.step === 1) {
      if (!checkAlias()) { showError(errorBox, 'Please choose an alias that is free.'); return; }
      show(2);
    } else if (state.step === 2) {
      show(3);
    } else if (state.step === 3) {
      if (pw.value.length < 8) { showError(errorBox, 'Your password needs at least 8 characters.'); return; }
      if (pw.value !== qs('#password2').value) { showError(errorBox, 'The two passwords don’t match.'); return; }
      if (!qs('#agree').checked) { showError(errorBox, 'Please agree to the community guidelines to join.'); return; }
      const btn = qs('#nextBtn');
      setBusy(btn, true, 'Creating your account…');
      setTimeout(() => {
        try {
          const { recoveryCode } = Store.register({ alias: aliasInput.value, password: pw.value, avatar: state.avatar, topics: [...state.topics], areas: [...state.areas], agreed: true });
          state.code = recoveryCode;
          qs('#codeBox').textContent = recoveryCode;
          setBusy(btn, false);
          show(4);
        } catch (err) {
          setBusy(btn, false);
          showError(errorBox, err.message);
          if (err.status === 409) show(1);
        }
      }, 30);
    } else {
      location.href = 'dashboard.html';
    }
  });

  show(1);
};
