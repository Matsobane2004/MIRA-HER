// One circle: posts, composer and sorting
window.pageInit = function () {
  const { qs, qsa, esc, icon, toast, postCard, bindPosts, showSupport, param } = MIRA;
  const id = param('id');
  let sort = 'recent';
  let data;

  try { data = Store.getCircle(id, sort); } catch (err) {
    qs('main').innerHTML = `<div class="card empty">${icon('compass')}<h4>We couldn’t find that circle</h4><p>${esc(err.message)}</p><a class="btn btn-purple btn-sm mt-16" href="circles.html">Back to circles</a></div>`;
    return;
  }
  document.title = `${data.circle.name} · MIRA Her`;

  function renderHeader() {
    const c = data.circle;
    qs('#circleHero').innerHTML = `<div class="circle-hero"><div class="tile-icon">${icon(c.icon)}</div>
      <div class="grow"><h1>${esc(c.name)}</h1><p>${esc(c.description)}</p></div>
      ${c.joined ? `<button class="btn btn-ghost" id="leaveBtn">${icon('check')} Joined</button>` : `<button class="btn btn-coral" id="joinBtn">${icon('plus-circle')} Join this circle</button>`}</div>`;
    qs('#aboutText').textContent = c.description;
    qs('#memberCount').textContent = c.members.toLocaleString('en-ZA');
    qs('#postCount').textContent = c.postCount;
    const joinBtn = qs('#joinBtn');
    const leaveBtn = qs('#leaveBtn');
    if (joinBtn) joinBtn.addEventListener('click', () => { Store.joinCircle(id); toast(`Welcome to ${c.name}.`); refresh(); });
    if (leaveBtn) leaveBtn.addEventListener('click', () => { Store.leaveCircle(id); toast(`You left ${c.name}.`); refresh(); });
  }

  function renderComposer() {
    const area = qs('#composerArea');
    if (!data.circle.joined) {
      area.innerHTML = `<div class="notice mb-16"><i class="ph-fill ph-users-three"></i><div>Join this circle to share a post or reply. You can read everything first.</div></div>`;
      return;
    }
    area.innerHTML = `<form class="composer" id="composer">
      <label class="sr-only" for="postText">Write a post</label>
      <textarea id="postText" maxlength="2000" placeholder="Share what’s on your mind. You’re anonymous here."></textarea>
      <div class="composer-foot">
        <label class="check"><input type="checkbox" id="twToggle"> <span>Add a trigger warning</span></label>
        <div class="row"><span class="char-count" id="charCount">0 / 2000</span><button class="btn btn-purple" type="submit">${icon('paper-plane-tilt')} Post anonymously</button></div>
      </div></form>`;
    const text = qs('#postText');
    text.addEventListener('input', () => { qs('#charCount').textContent = `${text.value.length} / 2000`; });
    qs('#composer').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const { crisis } = Store.createPost(id, { body: text.value, triggerWarning: qs('#twToggle').checked });
        text.value = '';
        qs('#charCount').textContent = '0 / 2000';
        qs('#twToggle').checked = false;
        toast('Posted anonymously.');
        sort = 'recent';
        qsa('[data-sort]').forEach((t) => { t.classList.toggle('on', t.dataset.sort === 'recent'); t.setAttribute('aria-selected', t.dataset.sort === 'recent'); });
        refresh();
        if (crisis) showSupport();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function renderPosts() {
    const empty = sort === 'unanswered' ? 'Every post here has a reply. Lovely.' : 'No posts yet. Be the first to share.';
    qs('#posts').innerHTML = data.posts.length
      ? data.posts.map((p) => postCard(p, { showCircle: false })).join('')
      : `<div class="card empty">${icon('chat-circle-dots')}<h4>${empty}</h4></div>`;
  }

  function refresh() {
    data = Store.getCircle(id, sort);
    renderHeader();
    renderComposer();
    renderPosts();
  }

  qsa('[data-sort]').forEach((t) => t.addEventListener('click', () => {
    sort = t.dataset.sort;
    qsa('[data-sort]').forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t); });
    data = Store.getCircle(id, sort);
    renderPosts();
  }));

  bindPosts(qs('#posts'));
  refresh();

  // Jump to a post from a notification link (#post-…)
  if (location.hash.startsWith('#post-')) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 2500);
    }
  }
};
