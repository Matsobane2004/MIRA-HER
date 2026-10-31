// Log in page
window.pageInit = function () {
  const { qs, qsa, setBusy, showError, safeNext, param, confirmBox, toast } = MIRA;
  const form = qs('#loginForm');
  const errorBox = qs('#loginError');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showError(errorBox, '');
    const alias = form.alias.value.trim();
    const password = form.password.value;
    if (!alias || !password) { showError(errorBox, 'Please enter your alias and password.'); return; }
    const btn = form.querySelector('button[type=submit]');
    setBusy(btn, true, 'Logging in…');
    // Let the button repaint before hashing the password
    setTimeout(() => {
      try {
        Store.login(alias, password);
        location.href = safeNext(param('next')) || 'dashboard.html';
      } catch (err) {
        showError(errorBox, err.message);
        setBusy(btn, false);
        form.password.select();
      }
    }, 30);
  });

  qsa('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    const [alias, password] = b.dataset.demo.split('|');
    form.alias.value = alias;
    form.password.value = password;
    form.querySelector('button[type=submit]').focus();
  }));

  qs('#resetDemo').addEventListener('click', async () => {
    if (await confirmBox('Reset demo data?', 'This clears every account, post and alert made on this device and restores the original demo content.', 'Reset everything', true)) {
      Store.resetDemo();
      toast('Demo data restored.');
    }
  });

  form.alias.focus();
};
