// Home dashboard
window.pageInit = function (user) {
  const { qs, esc, icon, toast, postCard, bindPosts, MOODS, ALERT_COLORS, timeAgo, confirmed, fmtDate, fmtTime } = MIRA;

  const hour = new Date().getHours();
  qs('#greeting').textContent = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${user.alias}`;
  qs('#today').textContent = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ----- Mood check-in -----
  function renderCheckin() {
    const today = Store.listCheckins().find((c) => c.day === Store.dayKey());
    qs('#moods').innerHTML = MOODS.map((m) => `<button class="mood-btn${today && today.mood === m.v ? ' on' : ''}" data-mood="${m.v}" aria-pressed="${!!today && today.mood === m.v}">${icon(m.icon)}<span>${m.label}</span></button>`).join('');
    qs('#checkinNote').textContent = today
      ? `You checked in today as “${MOODS[today.mood - 1].label}”. You can change it anytime. See your pattern in My Journal.`
      : 'Your check-in is private. It helps you spot patterns over time.';
    qs('#lowMood').hidden = !(today && today.mood <= 2);
  }
  qs('#moods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mood]');
    if (!b) return;
    Store.checkIn(Number(b.dataset.mood));
    renderCheckin();
    toast('Check-in saved. Thank you for checking in with yourself.');
  });
  renderCheckin();

  // ----- Feed -----
  const feedEl = qs('#feed');
  const posts = Store.feed();
  feedEl.innerHTML = posts.length
    ? posts.map((p) => postCard(p)).join('')
    : `<div class="card empty">${icon('chats-circle')}<h4>Your feed is quiet</h4><p>Join a circle to see posts from women going through the same things.</p><a class="btn btn-purple btn-sm mt-16" href="circles.html">Browse circles</a></div>`;
  bindPosts(feedEl);

  // ----- Alerts near me -----
  const alerts = Store.listAlerts(3);
  const near = alerts.filter((a) => a.nearMine);
  const shown = (near.length ? near : alerts).slice(0, 3);
  qs('#alertTitle').textContent = near.length ? `${near.length} alert${near.length === 1 ? '' : 's'} near your areas` : 'Recent safety alerts';
  qs('#alertList').innerHTML = shown.length
    ? shown.map((a) => `<a class="alert-row" style="text-decoration:none;color:inherit" href="alerts.html#${esc(a.id)}"><i class="dot" style="background:${ALERT_COLORS[a.type]};margin-top:5px"></i><span><b>${esc(a.typeLabel)}</b> · ${esc(a.place)}<small>${timeAgo(a.createdAt)} · ${confirmed(a.confirmations)}</small></span></a>`).join('')
    : '<p class="muted small">No alerts in the last few days. Stay safe out there.</p>';
  if (!user.areas.length) qs('#alertList').insertAdjacentHTML('beforeend', '<p class="small mt-8"><a href="settings.html#areas">Choose the areas you travel through</a> to see alerts near you.</p>');

  // ----- Suggested circles -----
  function renderSuggested() {
    const circles = Store.listCircles().filter((c) => !c.joined)
      .sort((a, b) => (user.topics.includes(b.name) - user.topics.includes(a.name)) || b.members - a.members)
      .slice(0, 3);
    qs('#suggested').innerHTML = circles.length
      ? circles.map((c) => `<div class="list-row"><span class="row" style="flex-wrap:nowrap"><span class="tile-icon" style="width:36px;height:36px;font-size:18px;margin:0;border-radius:10px">${icon(c.icon)}</span><span><b>${esc(c.name)}</b><small>${c.members.toLocaleString('en-ZA')} members</small></span></span><button class="btn btn-ghost btn-sm" data-join="${esc(c.id)}">Join</button></div>`).join('')
      : '<p class="muted small">You’ve joined every circle. Wonderful!</p>';
  }
  qs('#suggested').addEventListener('click', (e) => {
    const b = e.target.closest('[data-join]');
    if (!b) return;
    const c = Store.joinCircle(b.dataset.join);
    toast(`You joined ${c.name}.`);
    renderSuggested();
  });
  renderSuggested();

  // ----- Sessions -----
  function renderSessions() {
    const sessions = Store.listWorkshops().slice(0, 3);
    qs('#sessions').innerHTML = sessions.map((w) => `<div class="event"><div class="date"><b>${new Date(w.at).getDate()}</b><span>${new Date(w.at).toLocaleDateString('en-ZA', { month: 'short' })}</span></div>
      <div class="grow"><b class="small" style="font-size:14px">${esc(w.title)}</b><small>${fmtDate(w.at)} · ${fmtTime(w.at)} · Online</small></div>
      <button class="btn ${w.going ? 'btn-purple' : 'btn-ghost'} btn-sm" data-rsvp="${esc(w.id)}" aria-pressed="${w.going}">${w.going ? icon('check') + ' Going' : 'RSVP'}</button></div>`).join('');
  }
  qs('#sessions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rsvp]');
    if (!b) return;
    const w = Store.toggleRsvp(b.dataset.rsvp);
    toast(w.going ? `You’re going to “${w.title}”.` : 'RSVP removed.');
    renderSessions();
  });
  renderSessions();
};
