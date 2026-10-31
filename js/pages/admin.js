// Moderator dashboard
window.pageInit = function () {
  const { qs, qsa, esc, icon, avatar, timeAgo, toast, confirmBox, text } = MIRA;
  const TABS = ['crisis', 'reports', 'escalations', 'questions'];
  let tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'crisis';

  function renderStats() {
    const s = Store.adminOverview();
    const tiles = [
      ['users-three', s.members, 'Members', ''],
      ['warning', s.crisisOpen, 'Crisis flags open', 'coral'],
      ['flag', s.openReports, 'Open reports', 'amber'],
      ['siren', s.escalations, 'Escalated chats', 'coral'],
      ['first-aid-kit', s.pendingQuestions, 'Health questions waiting', ''],
      ['headset', s.waitingChats, 'Members waiting to talk', 'green'],
      ['chat-circle', s.postsThisWeek, 'Posts this week', ''],
      ['map-pin-area', s.alertsThisWeek, 'Safety alerts this week', 'amber']
    ];
    qs('#stats').innerHTML = tiles.map(([ic, n, label, tone]) => `<div class="stat-tile"><div class="tile-icon ${tone}">${icon(ic)}</div><div><b>${n}</b><span>${label}</span></div></div>`).join('');
    const counts = { crisis: s.crisisOpen, reports: Store.adminReports().length, escalations: s.escalations, questions: s.pendingQuestions };
    qsa('[data-count]').forEach((el) => { const n = counts[el.dataset.count]; el.textContent = n || ''; el.hidden = !n; });
  }

  const empty = (ic, title, sub) => `<div class="card empty">${icon(ic)}<h4>${title}</h4><p>${sub}</p></div>`;
  const who = (a) => (a ? `${avatar(a.avatar, 'sm')}<b>${esc(a.alias)}</b>` : '<b>Unknown</b>');

  function renderPanel() {
    const panel = qs('#panel');
    if (tab === 'crisis') {
      const items = Store.adminCrisis();
      panel.innerHTML = items.length ? items.map((it) => `<div class="mod-item urgent">
          <div class="row-between"><span class="row">${who(it.author)}<span class="muted small">${esc(it.where)} · ${timeAgo(it.createdAt)}</span></span><span class="tag coral">${icon('warning')} Possible crisis</span></div>
          <div class="body">${text(it.body)}</div>
          <div class="row"><a class="btn btn-ghost btn-sm" href="${esc(it.link)}">${icon('eye')} View in circle</a>
          <button class="btn btn-purple btn-sm" data-crisis="${esc(it.kind)}|${esc(it.id)}">${icon('check-circle')} Mark as followed up</button></div>
          <p class="hint mt-8">Reach out with a supportive reply and helplines, or invite her to talk to a listener.</p></div>`).join('')
        : empty('check-circle', 'No open crisis flags', 'Posts that suggest someone may be in danger will appear here first.');
    } else if (tab === 'reports') {
      const items = Store.adminReports();
      panel.innerHTML = items.length ? items.map((r) => `<div class="mod-item">
          <div class="row-between"><span class="row">${who(r.author)}<span class="muted small">${esc(r.where)}</span></span><span class="tag amber">${icon('flag')} Reported ${r.count} time${r.count === 1 ? '' : 's'}</span></div>
          <div class="body">${text(r.body)}</div>
          <p class="small muted mb-8">Reasons: ${[...new Set(r.reasons)].map(esc).join(', ')}</p>
          <div class="row"><button class="btn btn-ghost btn-sm" data-resolve="${esc(r.id)}|keep">${icon('check')} Keep it up</button>
          <button class="btn btn-danger btn-sm" data-resolve="${esc(r.id)}|remove">${icon('trash')} Remove</button></div></div>`).join('')
        : empty('flag', 'No open reports', 'Thank you for keeping the community safe.');
    } else if (tab === 'escalations') {
      const items = Store.adminEscalations();
      panel.innerHTML = items.length ? items.map((c) => `<div class="mod-item urgent">
          <div class="row-between"><span class="row">${who(c.member)}<span class="muted small">“${esc(c.topic)}” · ${timeAgo(c.createdAt)}${c.listener ? ` · with ${esc(c.listener.alias)}` : ''}</span></span><span class="tag ${c.status === 'ended' ? 'grey' : 'green'}">${c.status === 'ended' ? 'Chat ended' : 'Chat open'}</span></div>
          ${c.lastMessage ? `<div class="body">${text(c.lastMessage)}</div>` : ''}
          <div class="row"><a class="btn btn-ghost btn-sm" href="chat.html?id=${encodeURIComponent(c.id)}">${icon('eye')} Open chat</a>
          <button class="btn btn-purple btn-sm" data-escalation="${esc(c.id)}">${icon('hand-heart')} Mark as picked up</button></div></div>`).join('')
        : empty('siren', 'No escalated chats', 'When a member or listener asks for professional help, it appears here.');
    } else {
      const items = Store.adminQuestions();
      panel.innerHTML = items.length ? items.map((q) => `<div class="mod-item">
          <div class="row-between"><b>${icon('question')} Anonymous question</b><span class="muted small">${timeAgo(q.createdAt)}</span></div>
          <div class="body">${text(q.body)}</div>
          <form data-answer="${esc(q.id)}"><label class="sr-only" for="ans-${esc(q.id)}">Answer</label><textarea id="ans-${esc(q.id)}" maxlength="1500" placeholder="Write a clear, kind answer. Suggest visiting a clinic when needed."></textarea>
          <button class="btn btn-purple btn-sm" type="submit">${icon('paper-plane-tilt')} Publish answer</button></form></div>`).join('')
        : empty('first-aid-kit', 'No questions waiting', 'New anonymous health questions will appear here.');
    }
  }

  qs('#panel').addEventListener('click', async (e) => {
    const crisis = e.target.closest('[data-crisis]');
    const resolve = e.target.closest('[data-resolve]');
    const escalation = e.target.closest('[data-escalation]');
    try {
      if (crisis) { const [kind, id] = crisis.dataset.crisis.split('|'); Store.resolveCrisis(kind, id); toast('Marked as followed up.'); }
      if (resolve) {
        const [id, action] = resolve.dataset.resolve.split('|');
        if (action === 'remove' && !(await confirmBox('Remove this content?', 'It will be hidden from everyone.', 'Remove', true))) return;
        Store.resolveReport(id, action);
        toast(action === 'remove' ? 'Content removed.' : 'Report closed. The content stays up.');
      }
      if (escalation) { Store.resolveEscalation(escalation.dataset.escalation); toast('Marked as picked up. The member has been told.'); }
      if (crisis || resolve || escalation) { renderStats(); renderPanel(); }
    } catch (err) { toast(err.message, 'error'); }
  });

  qs('#panel').addEventListener('submit', (e) => {
    const form = e.target.closest('[data-answer]');
    if (!form) return;
    e.preventDefault();
    try {
      Store.answerQuestion(form.dataset.answer, form.querySelector('textarea').value);
      toast('Answer published. The member has been notified.');
      renderStats();
      renderPanel();
    } catch (err) { toast(err.message, 'error'); }
  });

  function selectTab(name) {
    tab = name;
    qsa('[data-tab]').forEach((t) => { t.classList.toggle('on', t.dataset.tab === name); t.setAttribute('aria-selected', t.dataset.tab === name); });
    renderPanel();
  }
  qsa('[data-tab]').forEach((t) => t.addEventListener('click', () => { history.replaceState(null, '', `#${t.dataset.tab}`); selectTab(t.dataset.tab); }));

  renderStats();
  selectTab(tab);
  setInterval(renderStats, 5000);
  Store.onExternalChange(() => { renderStats(); renderPanel(); });
};
