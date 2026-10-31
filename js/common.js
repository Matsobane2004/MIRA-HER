/* =============================================================================
   MIRA Her – shared page code (js/common.js)
   Loaded on every page after store.js. It:
   - checks the login for protected pages (body data-auth="required")
   - draws the top bar, sidebar and footer so every page looks the same
   - wires up Quick Exit (button + Esc key), notifications, the user menu
   - provides helpers the page scripts use (MIRA.toast, MIRA.modal, MIRA.postCard...)
   Each page script defines window.pageInit(user), which runs once the page is ready.
   ============================================================================= */
(function () {
  'use strict';

  const EXIT_URL = 'https://www.google.com/search?q=weather+today';

  const AVATARS = [
    { id: 'lotus', icon: 'flower-lotus', bg: '#FFE3DF', fg: '#E8553F', label: 'Lotus' },
    { id: 'butterfly', icon: 'butterfly', bg: '#EDE3FA', fg: '#5B2A86', label: 'Butterfly' },
    { id: 'moon', icon: 'moon-stars', bg: '#E3E7FA', fg: '#3D4DA8', label: 'Moon' },
    { id: 'sun', icon: 'sun', bg: '#FFF1D6', fg: '#B76E00', label: 'Sun' },
    { id: 'flower', icon: 'flower', bg: '#FCE4F1', fg: '#B4307A', label: 'Flower' },
    { id: 'sparkle', icon: 'sparkle', bg: '#E2F5EF', fg: '#1F8A6A', label: 'Sparkle' },
    { id: 'plant', icon: 'plant', bg: '#E6F4E1', fg: '#3E7F2E', label: 'Plant' },
    { id: 'feather', icon: 'feather', bg: '#EFEAF5', fg: '#6E6280', label: 'Feather' },
    { id: 'tulip', icon: 'flower-tulip', bg: '#FFE6E9', fg: '#C2334D', label: 'Tulip' },
    { id: 'heart', icon: 'heart', bg: '#FFE3DF', fg: '#F2604F', label: 'Heart' }
  ];

  const MOODS = [
    { v: 1, label: 'Struggling', icon: 'smiley-sad', color: '#7C5BAF' },
    { v: 2, label: 'Low', icon: 'smiley-nervous', color: '#9B7BC8' },
    { v: 3, label: 'Okay', icon: 'smiley-meh', color: '#C2A9E2' },
    { v: 4, label: 'Good', icon: 'smiley', color: '#FF9C8F' },
    { v: 5, label: 'Great', icon: 'smiley-wink', color: '#FF7A6B' }
  ];

  const ALERT_COLORS = { harassment: '#E5484D', followed: '#E5484D', assault: '#B4233A', theft: '#F08C2E', transport: '#8E5BD0', area: '#6E6280' };

  const REACTIONS = [
    { type: 'relate', icon: 'hand-heart', label: 'I relate' },
    { type: 'strength', icon: 'hand-fist', label: 'Sending strength' },
    { type: 'helpful', icon: 'lightbulb', label: 'Helpful' }
  ];

  const REPORT_REASONS = ['Harassment or bullying', 'Shares someone’s personal information', 'Hate speech or discrimination', 'Spam or a scam', 'False or misleading', 'Something else'];

  // Logo: a speech bubble (a safe space to talk) holding a heart (support)
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mhLogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A7A"/><stop offset="1" stop-color="#B98AE8"/></linearGradient></defs><path d="M12 5h24a8 8 0 0 1 8 8v15a8 8 0 0 1-8 8H24l-9 7.5V36h-3a8 8 0 0 1-8-8V13a8 8 0 0 1 8-8z" fill="url(#mhLogo)"/><path d="M24 30.5c-.5 0-9.5-5.4-9.5-11.6a5 5 0 0 1 9.5-2.3 5 5 0 0 1 9.5 2.3c0 6.2-9 11.6-9.5 11.6z" fill="#fff"/></svg>';

  const APP_NAV = [
    { href: 'dashboard.html', page: 'dashboard', icon: 'house', label: 'Home' },
    { href: 'circles.html', page: 'circles', icon: 'users-three', label: 'Circles' },
    { href: 'listener.html', page: 'listener', icon: 'headset', label: 'Talk to a Listener' },
    { href: 'alerts.html', page: 'alerts', icon: 'map-pin-area', label: 'Safety Alerts' },
    { href: 'safety.html', page: 'safety', icon: 'shield-check', label: 'Safety Toolkit' },
    { href: 'health.html', page: 'health', icon: 'heartbeat', label: 'Health & Body' },
    { href: 'mentorship.html', page: 'mentorship', icon: 'graduation-cap', label: 'Mentorship' },
    { href: 'journal.html', page: 'journal', icon: 'notebook', label: 'My Journal' }
  ];

  const ROLE_LABELS = { member: 'Anonymous member', listener: 'Trained peer listener', moderator: 'Moderator' };

  /* ---------- Small helpers ---------- */
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, extra = '') => `<i class="ph-fill ph-${name}${extra ? ' ' + extra : ''}" aria-hidden="true"></i>`;
  const param = (name) => new URLSearchParams(location.search).get(name);
  const text = (s) => esc(s).replace(/\n/g, '<br>');

  function avatar(id, size = 'md') {
    const a = AVATARS.find((x) => x.id === id) || AVATARS[7];
    return `<span class="avatar avatar-${size}" style="background:${a.bg};color:${a.fg}">${icon(a.icon)}</span>`;
  }

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'Just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} days ago`;
    return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }
  // Lower-case version for the middle of a sentence ("reported just now")
  const agoLower = (ts) => { const t = timeAgo(ts); return /^(Just now|Yesterday)$/.test(t) ? t.toLowerCase() : t; };
  const confirmed = (n) => `${n} ${n === 1 ? 'woman' : 'women'} confirmed`;
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  // Only allow redirects to our own pages (prevents open redirects)
  function safeNext(next) {
    return /^[a-z0-9-]+\.html([?#][^:]*)?$/i.test(next || '') ? next : null;
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> ${label || 'Please wait…'}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  function showError(el, message) {
    if (!el) return;
    if (!message) { el.hidden = true; el.innerHTML = ''; return; }
    el.innerHTML = `${icon('warning-circle')} <span>${esc(message)}</span>`;
    el.hidden = false;
  }

  let toastWrap = null;
  function toast(message, kind = 'success') {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      toastWrap.setAttribute('role', 'status');
      toastWrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastWrap);
    }
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.innerHTML = `${icon(kind === 'error' ? 'warning-circle' : 'check-circle')} <span>${esc(message)}</span>`;
    toastWrap.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }

  function modal(html, { wide = false } = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${wide ? 'style="max-width:620px"' : ''}><button class="modal-close" aria-label="Close">${icon('x')}</button>${html}</div>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('.modal-close') || e.target.closest('[data-close]')) close();
    });
    const first = backdrop.querySelector('input, textarea, select, button:not(.modal-close)');
    if (first) setTimeout(() => first.focus(), 30);
    return { el: backdrop.querySelector('.modal'), close };
  }

  function confirmBox(title, message, okLabel = 'Yes, continue', danger = false) {
    return new Promise((resolve) => {
      const m = modal(`<h3>${esc(title)}</h3><p class="muted">${esc(message)}</p>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-purple'}" data-ok>${esc(okLabel)}</button></div>`);
      let answered = false;
      m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
      const observer = new MutationObserver(() => { if (!document.body.contains(m.el)) { observer.disconnect(); if (!answered) resolve(false); } });
      observer.observe(document.body, { childList: true });
    });
  }

  // Shown when someone writes something that suggests they may be in crisis
  function showSupport() {
    modal(`<div class="support-modal">${icon('hand-heart')}
      <h3>You don’t have to carry this alone</h3>
      <p>It sounds like you might be going through something really painful. A trained peer listener can talk with you right now, and these free lines are open 24/7.</p>
      <div class="support-actions">
        <a class="btn btn-coral" href="listener.html">${icon('headset')} Talk to a listener now</a>
        <a class="btn btn-outline" href="tel:0800567567">${icon('phone')} Suicide Crisis Line · 0800 567 567</a>
        <a class="btn btn-outline" href="tel:0800428428">${icon('phone')} GBV Command Centre · 0800 428 428</a>
      </div>
      <p class="small mt-16" style="margin-bottom:0">In immediate danger? Call <b>10111</b>, or <b>112</b> from a cellphone.</p></div>`);
  }

  function reportDialog(kind, id) {
    const m = modal(`<h3>${icon('flag')} Report this ${kind === 'alert' ? 'alert' : 'post'}</h3>
      <p class="muted mb-16">Reports are anonymous. A moderator will review it.</p>
      <form>${REPORT_REASONS.map((r, i) => `<label class="radio"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}> ${esc(r)}</label>`).join('')}
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-coral" type="submit">Send report</button></div></form>`);
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const reason = new FormData(e.target).get('reason');
      try {
        if (kind === 'alert') Store.reportAlert(id, reason); else Store.reportPost(id, reason);
        m.close();
        toast('Thank you. A moderator will review this.');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---------- Posts (used on the dashboard and circle pages) ---------- */
  function roleBadge(author) {
    if (author.isBot) return `<span class="role-badge bot">${icon('robot')} Demo listener</span>`;
    if (author.role === 'moderator') return `<span class="role-badge">${icon('seal-check')} Moderator</span>`;
    if (author.role === 'listener') return `<span class="role-badge">${icon('headset')} Peer listener</span>`;
    return '';
  }

  function postCard(p, { showCircle = true } = {}) {
    return `<article class="post" id="post-${esc(p.id)}" data-id="${esc(p.id)}">
      <header class="post-head">${avatar(p.author.avatar)}
        <div class="post-meta"><div><b>${esc(p.author.alias)}</b>${roleBadge(p.author)}</div>
          <small>${timeAgo(p.createdAt)}${showCircle ? ` · <a href="circle.html?id=${encodeURIComponent(p.circleId)}">${esc(p.circleName)}</a>` : ''}</small></div>
        ${p.mine ? `<button class="icon-btn subtle" data-act="delete" title="Delete your post" aria-label="Delete your post">${icon('trash')}</button>` : ''}
      </header>
      ${p.triggerWarning ? `<div class="tw">${icon('warning')} <span>Trigger warning: this post may mention something upsetting.</span> <button class="link" data-act="reveal">Show post</button></div>` : ''}
      <div class="post-body${p.triggerWarning ? ' is-hidden' : ''}">${text(p.body)}</div>
      <footer class="reacts">
        ${REACTIONS.map((r) => `<button class="react${p.myReactions.includes(r.type) ? ' on' : ''}" data-act="react" data-type="${r.type}" aria-pressed="${p.myReactions.includes(r.type)}">${icon(r.icon)} ${r.label} <span>${p.reactions[r.type] || ''}</span></button>`).join('')}
        <button class="react" data-act="replies">${icon('chat-circle')} <em class="reply-label" style="font-style:normal">${replyLabel(p.replyCount)}</em></button>
        ${p.mine ? '' : `<button class="react subtle push-right" data-act="report" title="Report this post">${icon('flag')} Report</button>`}
      </footer>
      <div class="replies" hidden></div>
    </article>`;
  }
  const replyLabel = (n) => (n ? `${n} ${n === 1 ? 'reply' : 'replies'}` : 'Reply');

  function replyHTML(r) {
    return `<div class="reply">${avatar(r.author.avatar, 'sm')}<div class="reply-bubble"><b>${esc(r.author.alias)}</b>${roleBadge(r.author)}<small>${timeAgo(r.createdAt)}</small><div>${text(r.body)}</div></div></div>`;
  }

  function updateReacts(card, p) {
    REACTIONS.forEach((r) => {
      const b = card.querySelector(`[data-type="${r.type}"]`);
      if (!b) return;
      const on = p.myReactions.includes(r.type);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      b.querySelector('span').textContent = p.reactions[r.type] || '';
    });
  }

  function openReplies(card, id) {
    const box = card.querySelector('.replies');
    if (!box.hidden) { box.hidden = true; return; }
    const replies = Store.listReplies(id);
    box.hidden = false;
    box.innerHTML = `<div class="reply-list">${replies.length ? replies.map(replyHTML).join('') : '<p class="muted small">No replies yet. Offer some kindness.</p>'}</div>
      <form class="reply-form"><label class="sr-only" for="reply-${esc(id)}">Write a reply</label><input id="reply-${esc(id)}" name="replyText" maxlength="1000" autocomplete="off" placeholder="Write a supportive reply…" required>
      <button class="btn btn-purple btn-sm" type="submit">${icon('paper-plane-tilt')} Reply</button></form>`;
    const form = box.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.elements.namedItem('replyText');
      try {
        const { reply, replyCount, crisis } = Store.createReply(id, input.value);
        input.value = '';
        const list = box.querySelector('.reply-list');
        if (list.querySelector('p.muted')) list.innerHTML = '';
        list.insertAdjacentHTML('beforeend', replyHTML(reply));
        card.querySelector('.reply-label').textContent = replyLabel(replyCount);
        if (crisis) showSupport();
      } catch (err) { toast(err.message, 'error'); }
    });
    form.elements.namedItem('replyText').focus();
  }

  function bindPosts(container) {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('.post');
      if (!card) return;
      const id = card.dataset.id;
      try {
        switch (btn.dataset.act) {
          case 'react': updateReacts(card, Store.react(id, btn.dataset.type)); break;
          case 'reveal':
            card.querySelector('.post-body').classList.remove('is-hidden');
            btn.closest('.tw').querySelector('span').textContent = 'Trigger warning: this post may mention something upsetting.';
            btn.remove();
            break;
          case 'replies': openReplies(card, id); break;
          case 'report': reportDialog('post', id); break;
          case 'delete':
            if (await confirmBox('Delete this post?', 'It will be removed for everyone. This can’t be undone.', 'Delete post', true)) {
              Store.deletePost(id);
              card.remove();
              toast('Your post was deleted.');
            }
            break;
          default: break;
        }
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---------- Quick Exit ---------- */
  function quickExit() {
    try {
      const u = Store.me();
      if (!u || u.settings.logoutOnExit !== false) Store.logout();
    } catch { /* leave anyway */ }
    document.title = 'Weather';
    document.body.innerHTML = '';
    window.location.replace(EXIT_URL);
  }

  /* ---------- Page chrome ---------- */
  const quickExitBtn = () => `<button class="quick-exit" data-quick-exit title="Leave this site instantly (Esc)">${icon('x-circle')} <span class="label">Quick Exit</span> <kbd>Esc</kbd></button>`;

  function renderPublicChrome(user, page) {
    const links = [['about.html', 'About', 'about'], ['guidelines.html', 'Guidelines', 'guidelines'], ['privacy.html', 'Privacy', 'privacy'], ['help.html', 'Get Help', 'help']];
    const header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML = `<a class="brand" href="index.html">${LOGO}<span>MIRA <em>Her</em></span></a>
      <nav class="public-nav" aria-label="Main">${links.map(([h, l, p]) => `<a href="${h}" class="${page === p ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <div class="topbar-actions">
        ${user
          ? `<a class="btn btn-light btn-sm" href="dashboard.html">${icon('house')} My space</a>`
          : `<a class="pill-link" href="login.html">${icon('sign-in')} <span>Log in</span></a><a class="btn btn-coral btn-sm" href="register.html">Join anonymously</a>`}
        ${quickExitBtn()}
      </div>`;
    document.body.prepend(header);

    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.innerHTML = `<div class="footer-inner">
        <div><a class="brand" href="index.html">${LOGO}<span>MIRA <em>Her</em></span></a>
          <p>Anonymous peer support by women, for women. Built for the Women Empowerment Through Technology Hackathon 2026.</p></div>
        <div><h4>MIRA Her</h4><a href="about.html">About us</a><a href="guidelines.html">Community guidelines</a><a href="privacy.html">Privacy & safety</a></div>
        <div><h4>Get support</h4><a href="help.html">Get help now</a><a href="register.html">Join anonymously</a><a href="login.html">Log in</a></div>
        <div><h4>Emergency</h4><a href="tel:10111">Police: 10111</a><a href="tel:112">From a cellphone: 112</a><a href="tel:0800428428">GBV Command Centre: 0800 428 428</a></div>
      </div>
      <div class="footer-bottom"><span>© 2026 MIRA Her. A student prototype.</span><span>${icon('lock-key')} Press Esc at any time to leave quickly.</span></div>`;
    document.body.appendChild(footer);
  }

  function renderAuthChrome() {
    const header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML = `<a class="brand" href="index.html">${LOGO}<span>MIRA <em>Her</em></span></a>
      <div class="topbar-actions"><a class="pill-link" href="help.html">${icon('lifebuoy')} <span>Get Help Now</span></a>${quickExitBtn()}</div>`;
    document.body.prepend(header);
  }

  function renderAppChrome(user, page) {
    const header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML = `<a class="brand" href="dashboard.html">${LOGO}<span>MIRA <em>Her</em></span></a>
      <div class="topbar-actions">
        <div class="dropdown-wrap">
          <button class="icon-btn" id="bellBtn" aria-label="Notifications" aria-haspopup="true">${icon('bell')}<span class="badge-count" id="bellCount" hidden>0</span></button>
          <div class="dropdown notif-menu" id="notifMenu" hidden>
            <div class="notif-head"><h4>Notifications</h4><button class="link small" id="markRead">Mark all as read</button></div>
            <div class="notif-list" id="notifList"></div>
          </div>
        </div>
        <a class="pill-link" href="help.html">${icon('lifebuoy')} <span>Get Help Now</span></a>
        <div class="dropdown-wrap">
          <button class="user-btn" id="userBtn" aria-haspopup="true">${avatar(user.avatar, 'sm')}<span class="alias">${esc(user.alias)}</span>${icon('caret-down')}</button>
          <div class="dropdown" id="userMenu" hidden>
            <a href="settings.html">${icon('gear')} Settings</a>
            <a href="safety.html#plan">${icon('shield-check')} My safety plan</a>
            ${user.role === 'moderator' ? `<a href="admin.html">${icon('gavel')} Moderator dashboard</a>` : ''}
            <hr><button class="item" id="logoutBtn">${icon('sign-out')} Log out</button>
          </div>
        </div>
        ${quickExitBtn()}
      </div>`;

    const strip = document.createElement('div');
    strip.className = 'privacy-strip';
    strip.innerHTML = `${icon('lock-key')} You are anonymous. No real names, no phone numbers shown.`;

    const layout = document.createElement('div');
    layout.className = 'app-layout';
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    const extra = [];
    if (user.role === 'listener' || user.role === 'moderator') extra.push({ href: 'listener.html#hub', page: 'hub', icon: 'chats-circle', label: 'Listener Hub' });
    if (user.role === 'moderator') extra.push({ href: 'admin.html', page: 'admin', icon: 'gavel', label: 'Moderation' });
    const link = (n) => `<a href="${n.href}" class="${n.page === page ? 'on' : ''}"${n.page === page ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`;
    sidebar.innerHTML = `<div class="me">${avatar(user.avatar)}<div><b>${esc(user.alias)}</b><small>${ROLE_LABELS[user.role] || ''}</small></div></div>
      <nav class="nav" aria-label="App">${APP_NAV.map(link).join('')}
        ${extra.length ? `<div class="nav-label">Team</div>${extra.map(link).join('')}` : ''}
        <a href="settings.html" class="${page === 'settings' ? 'on' : ''}">${icon('gear')}<span>Settings</span></a></nav>
      <div class="sidebar-help"><b>${icon('lifebuoy')} In danger right now?</b>Call <a href="tel:10111">10111</a> or the GBV Command Centre on <a href="tel:0800428428">0800 428 428</a>.</div>`;

    const main = qs('main');
    main.classList.add('main');
    main.id = 'main';
    layout.append(sidebar, main);
    document.body.prepend(header, strip, layout);

    // Dropdowns
    const toggle = (btnId, menuId, onOpen) => {
      const btn = qs(`#${btnId}`);
      const menu = qs(`#${menuId}`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = menu.hidden;
        qsa('.dropdown').forEach((d) => { d.hidden = true; });
        menu.hidden = !open;
        if (open && onOpen) onOpen();
      });
      menu.addEventListener('click', (e) => e.stopPropagation());
    };
    toggle('bellBtn', 'notifMenu', renderNotifications);
    toggle('userBtn', 'userMenu');
    document.addEventListener('click', () => qsa('.dropdown').forEach((d) => { d.hidden = true; }));
    qs('#logoutBtn').addEventListener('click', () => { Store.logout(); location.href = 'index.html'; });
    qs('#markRead').addEventListener('click', () => { Store.markAllRead(); renderNotifications(); });

    updateBell();
    setInterval(updateBell, 5000);
    Store.onExternalChange(updateBell);
  }

  function updateBell() {
    const el = qs('#bellCount');
    if (!el) return;
    const { unread } = Store.listNotifications();
    el.textContent = unread > 9 ? '9+' : unread;
    el.hidden = unread === 0;
  }

  function renderNotifications() {
    const { notifications } = Store.listNotifications();
    qs('#notifList').innerHTML = notifications.length
      ? notifications.map((n) => `<a class="notif-item${n.read ? '' : ' unread'}" href="${esc(n.link)}"><span class="ni-icon">${icon(n.icon || 'bell')}</span><span><span class="ni-text">${esc(n.text)}</span><small>${timeAgo(n.createdAt)}</small></span></a>`).join('')
      : `<div class="notif-empty">${icon('bell')} <br>You’re all caught up.</div>`;
    qsa('.notif-item', qs('#notifList')).forEach((a) => a.addEventListener('click', () => { try { Store.markAllRead(); } catch { /* ignore */ } }));
    setTimeout(() => { try { Store.markAllRead(); updateBell(); } catch { /* ignore */ } }, 1500);
  }

  /* ---------- Global behaviour ---------- */
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-quick-exit]')) { e.preventDefault(); quickExit(); }
      const pw = e.target.closest('.pw-toggle');
      if (pw) {
        const input = pw.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        pw.innerHTML = icon(show ? 'eye-slash' : 'eye');
        pw.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openModal = qs('.modal-backdrop');
      if (openModal) { openModal.remove(); return; } // first Esc closes a dialog
      const openMenu = qsa('.dropdown').find((d) => !d.hidden);
      if (openMenu) { openMenu.hidden = true; return; }
      quickExit();
    });
  }

  function boot() {
    const b = document.body.dataset;
    const user = Store.me();
    if (b.auth === 'required' && !user) {
      const here = location.pathname.split('/').pop() + location.search + location.hash;
      location.replace(`login.html?next=${encodeURIComponent(here)}`);
      return;
    }
    if (b.auth === 'guest' && user) { location.replace('dashboard.html'); return; }
    if (b.role && user && !b.role.split(',').includes(user.role)) { location.replace('dashboard.html'); return; }

    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'Skip to content';

    if (b.shell === 'app') renderAppChrome(user, b.page);
    else if (b.shell === 'auth') renderAuthChrome();
    else renderPublicChrome(user, b.page);
    document.body.prepend(skip);
    const main = qs('main');
    if (main && !main.id) main.id = 'main';

    bindGlobal();
    document.body.classList.add('ready');
    if (typeof window.pageInit === 'function') {
      try { window.pageInit(user); } catch (err) { console.error(err); toast(err.message || 'Something went wrong loading this page.', 'error'); }
    }
  }

  window.MIRA = {
    AVATARS, MOODS, ALERT_COLORS, REACTIONS, LOGO,
    qs, qsa, esc, icon, param, text, avatar, timeAgo, agoLower, confirmed, fmtDate, fmtTime, safeNext,
    setBusy, showError, toast, modal, confirmBox, showSupport, reportDialog,
    postCard, bindPosts, roleBadge, quickExit
  };

  document.addEventListener('DOMContentLoaded', boot);
})();
