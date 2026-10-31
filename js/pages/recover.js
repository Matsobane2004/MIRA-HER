// Reset password with a recovery code
window.pageInit = function () {
  const { qs, setBusy, showError, toast } = MIRA;
  const form = qs('#recoverForm');
  const errorBox = qs('#recoverError');
  let newCode = '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showError(errorBox, '');
    const alias = form.alias.value.trim();
    const code = form.code.value.trim();
    const p1 = form.newPassword.value;
    const p2 = form.newPassword2.value;
    if (!alias || !code) { showError(errorBox, 'Please enter your alias and recovery code.'); return; }
    if (p1.length < 8) { showError(errorBox, 'Your new password needs at least 8 characters.'); return; }
    if (p1 !== p2) { showError(errorBox, 'The two passwords don’t match.'); return; }
    const btn = form.querySelector('button[type=submit]');
    setBusy(btn, true, 'Checking…');
    setTimeout(() => {
      try {
        const result = Store.recover({ alias, recoveryCode: code, newPassword: p1 });
        newCode = result.recoveryCode;
        qs('#newCode').textContent = newCode;
        qs('#resetStep').hidden = true;
        qs('#doneStep').hidden = false;
      } catch (err) {
        showError(errorBox, err.message);
      } finally {
        setBusy(btn, false);
      }
    }, 30);
  });

  qs('#copyNew').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(newCode); toast('Recovery code copied.'); }
    catch { toast('Couldn’t copy automatically. Please write the code down.', 'error'); }
  });

  qs('#savedNew').addEventListener('change', (e) => {
    const link = qs('#continueBtn');
    link.style.pointerEvents = e.target.checked ? 'auto' : 'none';
    link.style.opacity = e.target.checked ? '1' : '.6';
    link.setAttribute('aria-disabled', String(!e.target.checked));
  });
};
