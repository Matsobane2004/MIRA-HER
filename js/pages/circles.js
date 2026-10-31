// All circles
window.pageInit = function () {
  const { qs, qsa, esc, icon, toast } = MIRA;
  let filter = 'all';

  function render() {
    const circles = Store.listCircles().filter((c) => filter === 'all' || c.joined);
    qs('#circleGrid').innerHTML = circles.length
      ? circles.map((c) => `<div class="card circle-card hover-lift">
          <div class="tile-icon">${icon(c.icon)}</div>
          <h3>${esc(c.name)}</h3>
          <p>${esc(c.description)}</p>
          <div class="meta"><span>${icon('users')} ${c.members.toLocaleString('en-ZA')} members</span><span>${icon('chat-circle')} ${c.postCount} posts</span></div>
          <div class="actions">
            <a class="btn btn-purple btn-sm" href="circle.html?id=${encodeURIComponent(c.id)}">Open</a>
            ${c.joined
              ? `<button class="btn btn-ghost btn-sm" data-leave="${esc(c.id)}">${icon('check')} Joined</button>`
              : `<button class="btn btn-outline btn-sm" data-join="${esc(c.id)}">Join circle</button>`}
          </div>
        </div>`).join('')
      : `<div class="card empty" style="grid-column:1/-1">${icon('users-three')}<h4>You haven’t joined any circles yet</h4><p>Switch to “All circles” to find your people.</p></div>`;
  }

  qs('#circleGrid').addEventListener('click', (e) => {
    const join = e.target.closest('[data-join]');
    const leave = e.target.closest('[data-leave]');
    if (join) { const c = Store.joinCircle(join.dataset.join); toast(`You joined ${c.name}.`); render(); }
    if (leave) { const c = Store.leaveCircle(leave.dataset.leave); toast(`You left ${c.name}.`); render(); }
  });

  qsa('[data-filter]').forEach((t) => t.addEventListener('click', () => {
    filter = t.dataset.filter;
    qsa('[data-filter]').forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t); });
    render();
  }));

  render();
};
