// Private chat between a member and a peer listener.
// Works across two tabs: each tab has its own login, and the shared data updates live.
window.pageInit = function (user) {
  const { qs, esc, icon, avatar, fmtTime, toast, confirmBox, showSupport, param, text } = MIRA;
  const id = param('id');
  let shownCount = -1;
  let lastStatus = null;
  let rated = false;
  let timer = null;

  if (!id) { location.replace('listener.html'); return; }
  try { Store.getChat(id); } catch (err) {
    qs('main').innerHTML = `<div class="card empty">${icon('lock-key')}<h4>This conversation isn’t available</h4><p>${esc(err.message)}</p><a class="btn btn-purple btn-sm mt-16" href="listener.html">Back</a></div>`;
    return;
  }

  function render() {
    let chat;
    try { chat = Store.getChat(id); } catch (err) {
      qs('main').innerHTML = `<div class="card empty">${icon('lock-key')}<h4>This conversation isn’t available</h4><p>${esc(err.message)}</p><a class="btn btn-purple btn-sm mt-16" href="listener.html">Back</a></div>`;
      clearInterval(timer);
      return;
    }
    const isMember = chat.role === 'member';
    const observer = chat.role === 'observer';
    qs('#backLink').href = observer ? 'admin.html#escalations' : isMember ? 'listener.html' : 'listener.html#hub';
    qs('.chat-head .actions').hidden = observer;
    qs('#chatForm').hidden = observer;

    // Header
    if (chat.partner) {
      qs('#partnerAvatar').innerHTML = avatar(chat.partner.avatar);
      qs('#partnerName').textContent = chat.partner.alias;
      qs('#partnerBadge').innerHTML = chat.partner.isBot
        ? `<span class="role-badge bot">${icon('robot')} Demo listener (automated)</span>`
        : isMember ? `<span class="role-badge">${icon('seal-check')} Trained peer listener</span>` : `<span class="role-badge">${icon('mask-happy')} Anonymous member · “${esc(chat.topic)}”${observer ? ' · you are reviewing as a moderator' : ''}</span>`;
    }
    qs('#escalateLabel').textContent = chat.escalated ? 'Help requested' : isMember ? 'Request professional help' : 'Escalate to the team';
    qs('#escalateBtn').disabled = chat.escalated || chat.status !== 'active';
    qs('#endBtn').disabled = chat.status === 'ended';

    // Messages (only redraw when something changed)
    if (chat.messages.length !== shownCount || chat.status !== lastStatus) {
      const box = qs('#msgs');
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
      box.innerHTML = chat.messages.map((m) => {
        if (m.from === 'system') return `<div class="msg system">${esc(m.body)}</div>`;
        const mine = m.from === chat.role;
        return `<div class="msg ${mine ? 'mine' : 'theirs'}">${text(m.body)}<small>${fmtTime(m.at)}</small></div>`;
      }).join('');
      const last = chat.messages[chat.messages.length - 1];
      if (chat.status === 'active' && chat.partner && chat.partner.isBot && last && last.from === 'member') {
        box.insertAdjacentHTML('beforeend', `<div class="typing">${esc(chat.partner.alias)} is typing <span></span><span></span><span></span></div>`);
      }
      if (nearBottom || shownCount === -1 || (last && last.from === chat.role)) box.scrollTop = box.scrollHeight;
      shownCount = chat.messages.length;
    }

    // Waiting / ended overlays
    qs('#waiting').hidden = !(chat.status === 'waiting' && isMember);
    const input = qs('#chatInput');
    input.disabled = chat.status !== 'active';
    qs('#chatForm button').disabled = chat.status !== 'active';
    if (chat.status === 'active' && lastStatus === 'waiting') input.focus();

    if (chat.status === 'ended' && lastStatus !== 'ended') {
      if (isMember && !chat.rating && !rated) {
        qs('#endedInner').innerHTML = `<div class="pulse" style="animation:none">${icon('hand-heart')}</div>
          <h3 style="color:var(--purple)">Thank you for reaching out</h3>
          <p class="muted mt-8">How helpful was this conversation? Your rating is anonymous.</p>
          <div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">${icon('star')}</button>`).join('')}</div>
          <div class="row" style="justify-content:center"><a class="btn btn-coral" href="dashboard.html">Back to home</a><button class="btn btn-ghost" id="viewChat">View conversation</button></div>`;
        qs('#ended').hidden = false;
        qs('#stars').addEventListener('click', (e) => {
          const b = e.target.closest('[data-star]');
          if (!b) return;
          Store.rateChat(id, b.dataset.star);
          rated = true;
          [...qs('#stars').children].forEach((s) => s.classList.toggle('on', Number(s.dataset.star) <= Number(b.dataset.star)));
          toast('Thank you for your feedback.');
        });
        qs('#viewChat').addEventListener('click', () => { qs('#ended').hidden = true; });
      } else if (lastStatus === 'active') {
        qs('#endedInner').innerHTML = `<div class="pulse" style="animation:none">${icon('check-circle')}</div><h3 style="color:var(--purple)">This conversation has ended</h3>
          <div class="row mt-16" style="justify-content:center"><a class="btn btn-coral" href="${isMember ? 'dashboard.html' : 'listener.html#hub'}">${isMember ? 'Back to home' : 'Back to the Listener Hub'}</a><button class="btn btn-ghost" id="viewChat">View conversation</button></div>`;
        qs('#ended').hidden = false;
        qs('#viewChat').addEventListener('click', () => { qs('#ended').hidden = true; });
      }
    }
    lastStatus = chat.status;
  }

  qs('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = qs('#chatInput');
    if (!input.value.trim()) return;
    try {
      const body = input.value;
      Store.sendChatMessage(id, body);
      input.value = '';
      render();
      if (Store.hasCrisisLanguage(body) && Store.getChat(id).role === 'member') showSupport();
    } catch (err) { toast(err.message, 'error'); }
  });

  qs('#endBtn').addEventListener('click', async () => {
    if (await confirmBox('End this conversation?', 'You can always start a new one later.', 'End chat')) {
      Store.endChat(id);
      render();
    }
  });

  qs('#escalateBtn').addEventListener('click', async () => {
    const isMember = Store.getChat(id).role === 'member';
    const ok = await confirmBox(
      isMember ? 'Ask for professional help?' : 'Escalate this conversation?',
      isMember ? 'We’ll let the MIRA Her support team know you’d like help from a professional. Your listener stays with you.' : 'A moderator will be alerted to follow up with professional support.',
      isMember ? 'Yes, ask for help' : 'Escalate'
    );
    if (!ok) return;
    Store.escalateChat(id);
    render();
    if (isMember) showSupport(); else toast('The team has been alerted.');
  });

  qs('#cancelWait').addEventListener('click', () => {
    Store.endChat(id);
    location.href = 'listener.html';
  });

  render();
  timer = setInterval(render, 1500);
  Store.onExternalChange(render);
  if (user.role === 'listener' || user.role === 'moderator') { Store.heartbeat(); setInterval(Store.heartbeat, 10000); }
};
