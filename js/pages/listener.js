// Talk to a listener: start a chat, see past chats; listeners also see the queue
window.pageInit = function (user) {
  const { qs, esc, icon, avatar, timeAgo, agoLower, fmtDate, toast } = MIRA;
  const isListener = user.role === 'listener' || user.role === 'moderator';

  qs('#topic').innerHTML = Store.CHAT_TOPICS.map((t) => `<option>${esc(t)}</option>`).join('');

  function renderMine() {
    const { active, history } = Store.myChats();
    const activeCard = qs('#activeCard');
    if (active) {
      activeCard.hidden = false;
      qs('#startCard').hidden = true;
      activeCard.innerHTML = `<div class="row" style="flex-wrap:nowrap;gap:16px">
        <div class="tile-icon green" style="margin:0">${icon('chat-circle-dots')}</div>
        <div style="flex:1"><h3>${active.status === 'waiting' ? 'We’re finding a listener for you' : 'Your conversation is open'}</h3>
        <p class="muted small">“${esc(active.topic)}” · started ${agoLower(active.createdAt)}</p></div>
        <a class="btn btn-coral" href="chat.html?id=${encodeURIComponent(active.id)}">${active.status === 'waiting' ? 'Go to chat' : 'Continue chat'}</a></div>`;
    } else {
      activeCard.hidden = true;
      qs('#startCard').hidden = false;
    }
    qs('#history').innerHTML = history.length
      ? history.map((c) => `<div class="list-row"><span class="row" style="flex-wrap:nowrap">${c.partner ? avatar(c.partner.avatar, 'sm') : ''}<span><b>${esc(c.topic)}</b><small>${fmtDate(c.createdAt)} · with ${esc(c.partner ? c.partner.alias : 'a listener')}${c.rating ? ` · ${'★'.repeat(c.rating)}` : ''}</small></span></span>
          <a class="btn btn-ghost btn-sm" href="chat.html?id=${encodeURIComponent(c.id)}">View</a></div>`).join('')
      : '<p class="muted small">No past conversations yet.</p>';
  }

  qs('#startForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const chat = Store.startChat(qs('#topic').value);
      location.href = `chat.html?id=${encodeURIComponent(chat.id)}`;
    } catch (err) { toast(err.message, 'error'); }
  });

  function renderHub() {
    const queue = Store.chatQueue();
    const { listening } = Store.myChats();
    qs('#queue').innerHTML = queue.length
      ? queue.map((q) => `<div class="queue-item">${avatar(q.member.avatar, 'sm')}<div class="grow"><b>${esc(q.member.alias)}</b><small>“${esc(q.topic)}” · waiting ${timeAgo(q.createdAt).replace(' ago', '')}</small></div>
          <button class="btn btn-coral btn-sm" data-accept="${esc(q.id)}">Accept</button></div>`).join('')
      : `<p class="muted small">${icon('check-circle')} Nobody is waiting right now.</p>`;
    qs('#listening').innerHTML = listening.length
      ? listening.map((c) => `<div class="queue-item">${avatar(c.partner.avatar, 'sm')}<div class="grow"><b>${esc(c.partner.alias)}</b><small>“${esc(c.topic)}”${c.escalated ? ' · <span style="color:var(--coral-700)">needs professional help</span>' : ''}</small></div>
          <a class="btn btn-ghost btn-sm" href="chat.html?id=${encodeURIComponent(c.id)}">Open</a></div>`).join('')
      : '<p class="muted small">No open conversations.</p>';
  }

  if (isListener) {
    qs('#hub').hidden = false;
    qs('#queue').addEventListener('click', (e) => {
      const b = e.target.closest('[data-accept]');
      if (!b) return;
      try {
        const chat = Store.acceptChat(b.dataset.accept);
        location.href = `chat.html?id=${encodeURIComponent(chat.id)}`;
      } catch (err) { toast(err.message, 'error'); renderHub(); }
    });
    Store.heartbeat();
    setInterval(Store.heartbeat, 10000);
    setInterval(renderHub, 3000);
    Store.onExternalChange(renderHub);
    renderHub();
    if (location.hash === '#hub') qs('#hub').scrollIntoView();
  }

  renderMine();
  Store.onExternalChange(renderMine);
};
