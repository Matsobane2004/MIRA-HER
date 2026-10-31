// Mentorship: mentors, requests and workshops
window.pageInit = function () {
  const { qs, qsa, esc, icon, toast, modal, timeAgo, agoLower, fmtDate, fmtTime } = MIRA;
  let field = 'all';
  const GOALS = ['CV and job applications', 'Interview practice', 'Choosing a tech career', 'Learning to code', 'Getting certified', 'Starting a business', 'Leadership and confidence'];

  qs('#fieldTabs').innerHTML = [['all', 'All']].concat(Object.entries(Store.MENTOR_FIELDS))
    .map(([k, v]) => `<button class="tab${k === 'all' ? ' on' : ''}" data-field="${k}" role="tab" aria-selected="${k === 'all'}">${esc(v)}</button>`).join('');
  qs('#fieldTabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-field]');
    if (!t) return;
    field = t.dataset.field;
    qsa('[data-field]').forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t); });
    render();
  });

  function render() {
    const { mentors, requests } = Store.listMentors();
    const list = mentors.filter((m) => field === 'all' || m.field === field);
    qs('#mentors').innerHTML = list.length ? list.map((m, i) => `<div class="card mentor-card hover-lift">
        <div class="head"><div class="tile-icon${i % 2 ? ' coral' : ''}">${icon(m.icon)}</div><div><h3>${esc(m.alias)}</h3><div class="sub">${esc(m.title)} · ${m.years} years</div></div></div>
        <p>${esc(m.bio)}</p>
        <div class="skill-tags">${m.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}<span class="tag grey">${icon('translate')} ${m.languages.map(esc).join(', ')}</span></div>
        ${m.requested ? `<button class="btn btn-ghost btn-block" disabled>${icon('check')} Request sent</button>` : `<button class="btn btn-purple btn-block" data-request="${esc(m.id)}">Request mentorship</button>`}
      </div>`).join('') : `<div class="card empty" style="grid-column:1/-1">${icon('graduation-cap')}<h4>No mentors in this field yet</h4></div>`;

    qs('#requests').innerHTML = requests.length
      ? requests.map((r) => `<div class="list-row"><span><b>${esc(r.mentorAlias)}</b><small>${esc(r.goal)} · sent ${agoLower(r.createdAt)}</small></span><span class="tag amber">${icon('hourglass')} Waiting for a reply</span></div>`).join('')
      : '<p class="muted small">You haven’t asked a mentor yet. Mentors usually reply within 48 hours.</p>';
  }

  qs('#mentors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-request]');
    if (!b) return;
    const mentor = Store.listMentors().mentors.find((m) => m.id === b.dataset.request);
    const m = modal(`<h3>${icon('graduation-cap')} Ask ${esc(mentor.alias)} to mentor you</h3>
      <p class="muted mb-16">${esc(mentor.title)} · ${mentor.years} years in ${esc(mentor.fieldLabel)}</p>
      <form>
        <div class="field"><label for="goal">What would you like help with?</label><select id="goal">${GOALS.map((g) => `<option>${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label for="msg">A short message <span class="muted small">(optional)</span></label><textarea id="msg" maxlength="600" placeholder="Tell her a little about where you are now and what you’re hoping for."></textarea></div>
        <p class="hint">Don’t include your real name or contact details yet.</p>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-coral" type="submit">Send request</button></div>
      </form>`);
    m.el.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      try {
        Store.requestMentor(mentor.id, { goal: m.el.querySelector('#goal').value, message: m.el.querySelector('#msg').value });
        m.close();
        toast(`Request sent to ${mentor.alias}.`);
        render();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  function renderWorkshops() {
    qs('#workshopList').innerHTML = Store.listWorkshops().map((w) => `<div class="event">
      <div class="date"><b>${new Date(w.at).getDate()}</b><span>${new Date(w.at).toLocaleDateString('en-ZA', { month: 'short' })}</span></div>
      <div class="grow"><b>${esc(w.title)}</b><small>${esc(w.kind)} with ${esc(w.host)}</small><small>${fmtDate(w.at)} · ${fmtTime(w.at)} · Online · ${w.attendees} going</small></div>
      <button class="btn ${w.going ? 'btn-purple' : 'btn-ghost'} btn-sm" data-rsvp="${esc(w.id)}" aria-pressed="${w.going}">${w.going ? `${icon('check')} Going` : 'RSVP'}</button></div>`).join('');
  }
  qs('#workshopList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rsvp]');
    if (!b) return;
    const w = Store.toggleRsvp(b.dataset.rsvp);
    toast(w.going ? `You’re going to “${w.title}”. The link will appear here before it starts.` : 'RSVP removed.');
    renderWorkshops();
  });

  render();
  renderWorkshops();
  if (location.hash === '#workshops') qs('#workshops').scrollIntoView();
};
