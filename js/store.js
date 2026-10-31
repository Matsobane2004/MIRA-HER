/* =============================================================================
   MIRA Her – data layer (js/store.js)

   This prototype runs entirely in the browser. There is no server:
   - All data (accounts, posts, alerts...) is saved in localStorage on this device.
   - Your login lives in sessionStorage, so it ends when you close the tab, and
     each tab can be logged in as a different person (handy for demoing chat).

   Every public function below behaves like an API endpoint: it checks who is
   logged in, validates input, and throws a friendly Error when something is
   wrong. To add a real backend later, replace each function's body with a
   fetch() call. The pages won't need to change. See CLAUDE.md.
   ============================================================================= */
(function () {
  'use strict';

  const DB_KEY = 'miraher.db.v1';
  const SESSION_KEY = 'miraher.session';
  const PRESENCE_KEY = 'miraher.presence';
  const ATTEMPTS_KEY = 'miraher.attempts';
  const SESSION_HOURS = 12;
  const HASH_ROUNDS = 2000;
  const BOT_ID = 'bot';

  /* ---------------------------------------------------------------------------
     Lists
     ------------------------------------------------------------------------- */
  const AVATARS = ['lotus', 'butterfly', 'moon', 'sun', 'flower', 'sparkle', 'plant', 'feather', 'tulip', 'heart'];

  // Each topic is also the name of a circle
  const TOPICS = ['Safety & Abuse', 'Mental Wellbeing', 'Relationships', 'Motherhood', 'Reproductive Health',
    'Money & Independence', 'Careers', 'Women in Tech', 'Student Life', 'Staying Safe in SA'];

  // Areas members can follow for safety alerts (approximate centre points)
  const AREAS = [
    { id: 'braamfontein', name: 'Braamfontein', lat: -26.1929, lng: 28.0305 },
    { id: 'cbd', name: 'Joburg CBD (Park Station, Bree)', lat: -26.2005, lng: 28.0400 },
    { id: 'hillbrow', name: 'Hillbrow & Berea', lat: -26.1890, lng: 28.0490 },
    { id: 'rosebank', name: 'Rosebank', lat: -26.1460, lng: 28.0436 },
    { id: 'melville', name: 'Melville & Auckland Park', lat: -26.1800, lng: 28.0050 },
    { id: 'sandton', name: 'Sandton', lat: -26.1076, lng: 28.0567 },
    { id: 'randburg', name: 'Randburg', lat: -26.0940, lng: 28.0010 },
    { id: 'soweto', name: 'Soweto', lat: -26.2485, lng: 27.8540 },
    { id: 'midrand', name: 'Midrand', lat: -25.9890, lng: 28.1280 },
    { id: 'pretoria', name: 'Pretoria CBD', lat: -25.7461, lng: 28.1881 }
  ];

  const ALERT_TYPES = {
    harassment: 'Harassment or catcalling',
    followed: 'Followed or threatened',
    assault: 'Physical or sexual assault',
    theft: 'Theft or robbery',
    transport: 'Unsafe taxi or e-hailing',
    area: 'Poor lighting or unsafe area'
  };
  const HAPPENED = ['Just now', 'Earlier today', 'Yesterday', 'This week'];
  const JOURNAL_TAGS = ['Hopeful', 'Calm', 'Grateful', 'Proud', 'Anxious', 'Sad', 'Tired', 'Angry'];
  const CHAT_TOPICS = ['I just need to talk', 'Something happening at home', 'My relationship', 'Feeling low or anxious',
    'Stress, studies or work', 'Pregnancy or motherhood', 'Something else'];
  const REACTION_TYPES = ['relate', 'strength', 'helpful'];
  const RADII = [1, 2, 3, 5, 10];
  const MENTOR_FIELDS = { software: 'Software Development', data: 'Data', cyber: 'Cybersecurity', design: 'Design', business: 'Entrepreneurship' };

  /* ---------------------------------------------------------------------------
     Errors and small helpers
     ------------------------------------------------------------------------- */
  class StoreError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
  const fail = (message, status) => { throw new StoreError(message, status); };

  const clean = (value, max = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

  function distanceKm(a, b) {
    const R = 6371;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Flags content so a moderator follows up quickly and the writer sees support options.
  // A future version could use an AI model, but a person always makes the final call.
  const CRISIS_PATTERNS = [/\bsuicid/i, /\bkill(ing)? myself\b/i, /\bend(ing)? (my life|it all)\b/i, /\bwant(ed)? to die\b/i,
    /\bno reason to (live|go on)\b/i, /\bhurt(ing)? myself\b/i, /\bself[- ]?harm/i, /\bdon'?t want to (live|be here)\b/i, /\bcan'?t go on\b/i];
  const hasCrisisLanguage = (text) => CRISIS_PATTERNS.some((re) => re.test(String(text || '')));

  function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ---------------------------------------------------------------------------
     Hashing. SHA-256 written in plain JS so it works everywhere, even when the
     page is opened straight from a file. Passwords are salted and hashed many
     times; they are never stored as plain text.
     (A real backend would hash on the server with scrypt or bcrypt.)
     ------------------------------------------------------------------------- */
  const sha256 = (() => {
    const K = new Uint32Array(64);
    const H0 = new Uint32Array(8);
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) >>> 0;
    for (let n = 0, c = 2; n < 64; c++) {
      let prime = true;
      for (let d = 2; d * d <= c; d++) if (c % d === 0) { prime = false; break; }
      if (prime) { if (n < 8) H0[n] = frac(Math.sqrt(c)); K[n] = frac(Math.cbrt(c)); n++; }
    }
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    const encoder = new TextEncoder();
    const W = new Uint32Array(64);
    return function (text) {
      const msg = encoder.encode(String(text));
      const len = msg.length;
      const total = ((len + 9 + 63) >> 6) << 6;
      const buf = new Uint8Array(total);
      buf.set(msg);
      buf[len] = 0x80;
      const view = new DataView(buf.buffer);
      view.setUint32(total - 8, Math.floor((len * 8) / 4294967296));
      view.setUint32(total - 4, (len * 8) >>> 0);
      const H = H0.slice();
      for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
        for (let i = 16; i < 64; i++) {
          const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
          const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
          W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
        }
        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (let i = 0; i < 64; i++) {
          const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
          const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
          h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
      }
      return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
    };
  })();

  function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function randomInt(min, max) { // min inclusive, max exclusive
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return min + (arr[0] % (max - min));
  }
  const newId = (prefix) => `${prefix}_${randomHex(6)}`;

  function hashSecret(secret, salt = randomHex(16)) {
    let hash = sha256(`${salt}|${secret}`);
    for (let i = 1; i < HASH_ROUNDS; i++) hash = sha256(hash + salt);
    return { salt, hash };
  }
  const verifySecret = (secret, stored) => !!stored && hashSecret(String(secret), stored.salt).hash === stored.hash;

  // Recovery codes replace "forgot password" emails, because we never ask for an email
  const WORDS = ['LAVENDER', 'RIVER', 'PROTEA', 'MARULA', 'EMBER', 'SUNRISE', 'JACARANDA', 'BAOBAB', 'AMBER', 'CORAL',
    'MEADOW', 'ORCHID', 'SPARROW', 'HARBOUR', 'VELVET', 'WILLOW', 'FYNBOS', 'LILY', 'SAFFRON', 'MAPLE', 'CLOVER', 'DAWN',
    'STARLING', 'JASMINE', 'KAROO', 'HONEY', 'IRIS', 'PEBBLE', 'THUNDER', 'OCEAN', 'MOONLIGHT', 'ACACIA'];
  function recoveryCode() {
    const w = () => WORDS[randomInt(0, WORDS.length)];
    return `${w()}-${w()}-${randomInt(1000, 10000)}-${w()}-${w()}`;
  }
  const normaliseCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  /* ---------------------------------------------------------------------------
     Storage. The whole "database" is one JSON object in localStorage.
     Every change goes through tx(), which reads the latest copy first, so two
     tabs don't overwrite each other's changes.
     ------------------------------------------------------------------------- */
  let cache = null;
  let cacheRaw = null;
  let memoryOnly = false; // true if the browser blocks localStorage
  let warned = false;

  function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }

  function read() {
    if (memoryOnly && cache) return cache;
    const raw = storageGet(DB_KEY);
    if (raw === null) {
      cache = buildSeed();
      persist(cache);
      return cache;
    }
    if (raw !== cacheRaw) {
      try { cache = JSON.parse(raw); cacheRaw = raw; } catch { cache = buildSeed(); persist(cache); }
    }
    return cache;
  }

  function persist(state) {
    const raw = JSON.stringify(state);
    if (!storageSet(DB_KEY, raw)) {
      memoryOnly = true;
      if (!warned) { warned = true; console.warn('MIRA Her: browser storage is blocked, so changes will be lost when the page reloads.'); }
    }
    cache = state;
    cacheRaw = raw;
  }

  function tx(fn) {
    const state = read();
    try {
      const result = fn(state);
      persist(state);
      return result;
    } catch (err) {
      cacheRaw = null; // drop any half-made change
      throw err;
    }
  }

  // Lets pages refresh when another tab changes the data (chat, notifications...)
  const externalListeners = new Set();
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY || e.key === null) {
      cacheRaw = null;
      externalListeners.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } });
    }
  });
  const onExternalChange = (fn) => { externalListeners.add(fn); return () => externalListeners.delete(fn); };

  /* ---------------------------------------------------------------------------
     Session (per tab)
     ------------------------------------------------------------------------- */
  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.expires > Date.now()) return s;
    } catch { /* ignore */ }
    return null;
  }
  function setSession(userId) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expires: Date.now() + SESSION_HOURS * 3600e3 })); } catch { /* ignore */ }
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

  function currentUserIn(state) {
    const s = getSession();
    return s ? state.users.find((u) => u.id === s.userId) || null : null;
  }
  function requireUserIn(state) {
    const u = currentUserIn(state);
    if (!u) fail('Please log in to continue.', 401);
    return u;
  }
  function requireRoleIn(state, roles) {
    const u = requireUserIn(state);
    if (!roles.includes(u.role)) fail('You don’t have access to this.', 403);
    return u;
  }
  const isListenerRole = (u) => u.role === 'listener' || u.role === 'moderator';

  function publicUser(u) {
    if (!u) return null;
    const { id, alias, avatar, role, topics, areas, settings, createdAt } = u;
    return { id, alias, avatar, role, topics: [...topics], areas: [...areas], settings: { ...settings }, createdAt };
  }

  /* ---------------------------------------------------------------------------
     Views: shape data for pages (never expose hashes or other people's IDs)
     ------------------------------------------------------------------------- */
  function authorView(state, userId) {
    if (userId === BOT_ID) return { alias: 'GentleHeart', avatar: 'heart', role: 'listener', isBot: true };
    const u = state.users.find((x) => x.id === userId);
    return u ? { alias: u.alias, avatar: u.avatar, role: u.role } : { alias: 'Former member', avatar: 'feather', role: 'member' };
  }

  function circleView(state, c, uid) {
    const members = state.memberships.filter((m) => m.circleId === c.id);
    return {
      id: c.id, name: c.name, icon: c.icon, description: c.description,
      members: c.baseMembers + members.length,
      joined: members.some((m) => m.userId === uid),
      postCount: state.posts.filter((p) => p.circleId === c.id && p.status === 'visible').length
    };
  }

  function postView(state, p, uid) {
    const reactions = state.reactions.filter((r) => r.postId === p.id);
    const counts = { relate: 0, strength: 0, helpful: 0 };
    reactions.forEach((r) => { counts[r.type] += 1; });
    const circle = state.circles.find((c) => c.id === p.circleId);
    return {
      id: p.id, circleId: p.circleId, circleName: circle ? circle.name : '',
      body: p.body, triggerWarning: !!p.triggerWarning, createdAt: p.createdAt,
      author: authorView(state, p.authorId), mine: p.authorId === uid,
      reactions: counts, myReactions: reactions.filter((r) => r.userId === uid).map((r) => r.type),
      totalReactions: reactions.length,
      replyCount: state.replies.filter((r) => r.postId === p.id && r.status === 'visible').length
    };
  }

  const replyView = (state, r, uid) => ({ id: r.id, body: r.body, createdAt: r.createdAt, author: authorView(state, r.authorId), mine: r.authorId === uid });

  function alertView(state, a, user) {
    const confirms = state.alertConfirmations.filter((c) => c.alertId === a.id);
    const radius = (user.settings && user.settings.alertRadiusKm) || 3;
    const nearMine = (user.areas || []).some((id) => {
      const area = AREAS.find((x) => x.id === id);
      return area && distanceKm(area, a) <= radius;
    });
    return {
      id: a.id, type: a.type, typeLabel: ALERT_TYPES[a.type], place: a.place, lat: a.lat, lng: a.lng,
      details: a.details, happened: a.happened, createdAt: a.createdAt,
      confirmations: (a.baseConfirmations || 1) + confirms.length,
      confirmedByMe: confirms.some((c) => c.userId === user.id),
      mine: a.authorId === user.id, nearMine
    };
  }

  function chatView(state, c, uid) {
    const isMember = c.memberId === uid;
    return {
      id: c.id, status: c.status, topic: c.topic, createdAt: c.createdAt, acceptedAt: c.acceptedAt, endedAt: c.endedAt,
      escalated: c.escalated, rating: c.rating,
      role: isMember ? 'member' : c.listenerId === uid ? 'listener' : 'observer', // observer = a moderator reviewing
      partner: isMember ? (c.listenerId ? authorView(state, c.listenerId) : null) : authorView(state, c.memberId),
      messages: c.messages.map((m) => ({ ...m }))
    };
  }

  /* ---------------------------------------------------------------------------
     Notifications helpers (call inside tx)
     ------------------------------------------------------------------------- */
  function notifyIn(state, userId, text, link = 'dashboard.html', icon = 'bell') {
    state.notifications.push({ id: newId('n'), userId, text, link, icon, createdAt: Date.now(), read: false });
  }
  function notifyRoleIn(state, roles, text, link, icon) {
    state.users.filter((u) => roles.includes(u.role)).forEach((u) => notifyIn(state, u.id, text, link, icon));
  }

  /* ---------------------------------------------------------------------------
     Accounts
     ------------------------------------------------------------------------- */
  const ALIAS_RE = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;
  const findByAlias = (state, alias) => {
    const a = String(alias || '').trim().toLowerCase();
    return state.users.find((u) => u.alias.toLowerCase() === a);
  };
  const pickList = (value, allowed) => [...new Set((Array.isArray(value) ? value : []).filter((v) => allowed.includes(v)))];
  const areaIds = AREAS.map((a) => a.id);

  // 5 wrong tries locks that alias on this device for 5 minutes
  function attemptsLocked(key) {
    try {
      const all = JSON.parse(storageGet(ATTEMPTS_KEY) || '{}');
      const a = all[key];
      return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 60000) : 0;
    } catch { return 0; }
  }
  function attemptFailed(key) {
    let all = {};
    try { all = JSON.parse(storageGet(ATTEMPTS_KEY) || '{}'); } catch { /* ignore */ }
    const a = all[key] || { count: 0, until: 0 };
    a.count += 1;
    if (a.count >= 5) { a.count = 0; a.until = Date.now() + 5 * 60e3; }
    all[key] = a;
    storageSet(ATTEMPTS_KEY, JSON.stringify(all));
  }
  function attemptsClear(key) {
    try {
      const all = JSON.parse(storageGet(ATTEMPTS_KEY) || '{}');
      delete all[key];
      storageSet(ATTEMPTS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }
  const lockMessage = (mins) => `Too many attempts. Please wait ${mins} minute${mins > 1 ? 's' : ''} and try again.`;

  function me() { return publicUser(currentUserIn(read())); }

  function aliasAvailable(alias) {
    alias = String(alias || '').trim();
    if (!ALIAS_RE.test(alias)) return { available: false, reason: 'Use 3–20 letters or numbers, starting with a letter.' };
    return { available: !findByAlias(read(), alias) };
  }

  function register({ alias, password, avatar, topics, areas, agreed } = {}) {
    alias = clean(alias, 20);
    password = String(password || '');
    if (!ALIAS_RE.test(alias)) fail('Your alias must be 3–20 letters or numbers and start with a letter.');
    if (password.length < 8) fail('Your password needs at least 8 characters.');
    if (password.toLowerCase().includes(alias.toLowerCase())) fail('Please don’t include your alias in your password.');
    if (agreed !== true) fail('Please agree to the community guidelines to join.');
    const code = recoveryCode();
    const pwHash = hashSecret(password);
    const codeHash = hashSecret(normaliseCode(code));
    const user = tx((s) => {
      if (findByAlias(s, alias)) fail('That alias is already taken. Try shuffling for a new one.', 409);
      const chosen = pickList(topics, TOPICS);
      const u = {
        id: newId('u'), alias, avatar: AVATARS.includes(avatar) ? avatar : 'lotus', role: 'member',
        topics: chosen, areas: pickList(areas, areaIds),
        settings: { nearbyAlerts: true, alertRadiusKm: 3, logoutOnExit: true },
        createdAt: Date.now(), password: pwHash, recovery: codeHash
      };
      s.users.push(u);
      s.circles.filter((c) => chosen.includes(c.name)).forEach((c) => s.memberships.push({ userId: u.id, circleId: c.id }));
      notifyIn(s, u.id, 'Welcome to MIRA Her. You’re anonymous here, so take your time.', 'dashboard.html', 'hand-heart');
      return u;
    });
    setSession(user.id);
    return { user: publicUser(user), recoveryCode: code };
  }

  function login(alias, password) {
    alias = String(alias || '').trim();
    const key = `login|${alias.toLowerCase()}`;
    const mins = attemptsLocked(key);
    if (mins) fail(lockMessage(mins), 429);
    const user = findByAlias(read(), alias);
    if (!user || !verifySecret(String(password || ''), user.password)) {
      attemptFailed(key);
      fail('That alias and password don’t match.', 401);
    }
    attemptsClear(key);
    setSession(user.id);
    return publicUser(user);
  }

  function logout() { clearSession(); }

  function recover({ alias, recoveryCode: code, newPassword } = {}) {
    alias = String(alias || '').trim();
    const key = `recover|${alias.toLowerCase()}`;
    const mins = attemptsLocked(key);
    if (mins) fail(lockMessage(mins), 429);
    const found = findByAlias(read(), alias);
    if (!found || !verifySecret(normaliseCode(code), found.recovery)) {
      attemptFailed(key);
      fail('That recovery code doesn’t match this alias.', 401);
    }
    if (String(newPassword || '').length < 8) fail('Your new password needs at least 8 characters.');
    attemptsClear(key);
    const next = recoveryCode(); // codes are single-use, so issue a fresh one
    const pwHash = hashSecret(String(newPassword));
    const codeHash = hashSecret(normaliseCode(next));
    const user = tx((s) => {
      const u = s.users.find((x) => x.id === found.id);
      u.password = pwHash;
      u.recovery = codeHash;
      return u;
    });
    setSession(user.id);
    return { user: publicUser(user), recoveryCode: next };
  }

  function updateMe(patch = {}) {
    return publicUser(tx((s) => {
      const u = requireUserIn(s);
      if (patch.avatar !== undefined) {
        if (!AVATARS.includes(patch.avatar)) fail('Please choose one of the avatars.');
        u.avatar = patch.avatar;
      }
      if (patch.topics !== undefined) u.topics = pickList(patch.topics, TOPICS);
      if (patch.areas !== undefined) u.areas = pickList(patch.areas, areaIds);
      if (patch.settings && typeof patch.settings === 'object') {
        const st = patch.settings;
        if (typeof st.nearbyAlerts === 'boolean') u.settings.nearbyAlerts = st.nearbyAlerts;
        if (typeof st.logoutOnExit === 'boolean') u.settings.logoutOnExit = st.logoutOnExit;
        if (RADII.includes(Number(st.alertRadiusKm))) u.settings.alertRadiusKm = Number(st.alertRadiusKm);
      }
      return u;
    }));
  }

  function changePassword(current, next) {
    const u0 = requireUserIn(read());
    if (!verifySecret(String(current || ''), u0.password)) fail('Your current password is not right.', 401);
    if (String(next || '').length < 8) fail('Your new password needs at least 8 characters.');
    const pwHash = hashSecret(String(next));
    tx((s) => { s.users.find((x) => x.id === u0.id).password = pwHash; });
  }

  function newRecoveryCode(password) {
    const u0 = requireUserIn(read());
    if (!verifySecret(String(password || ''), u0.password)) fail('Your password is not right.', 401);
    const code = recoveryCode();
    const codeHash = hashSecret(normaliseCode(code));
    tx((s) => { s.users.find((x) => x.id === u0.id).recovery = codeHash; });
    return code;
  }

  // Removes everything she wrote. Safety alerts stay up (they protect others) but lose their link to her.
  function deleteAccount(password) {
    const u0 = requireUserIn(read());
    if (!verifySecret(String(password || ''), u0.password)) fail('Your password is not right.', 401);
    const id = u0.id;
    tx((s) => {
      const postIds = new Set(s.posts.filter((p) => p.authorId === id).map((p) => p.id));
      s.users = s.users.filter((u) => u.id !== id);
      s.posts = s.posts.filter((p) => p.authorId !== id);
      s.replies = s.replies.filter((r) => r.authorId !== id && !postIds.has(r.postId));
      s.reactions = s.reactions.filter((r) => r.userId !== id && !postIds.has(r.postId));
      s.reports = s.reports.filter((r) => r.reporterId !== id && !postIds.has(r.targetId));
      s.memberships = s.memberships.filter((m) => m.userId !== id);
      s.checkins = s.checkins.filter((c) => c.userId !== id);
      s.journal = s.journal.filter((j) => j.userId !== id);
      s.notifications = s.notifications.filter((n) => n.userId !== id);
      s.mentorRequests = s.mentorRequests.filter((m) => m.userId !== id);
      s.rsvps = s.rsvps.filter((r) => r.userId !== id);
      s.questions = s.questions.filter((q) => q.userId !== id);
      s.chats = s.chats.filter((c) => c.memberId !== id);
      s.alertConfirmations = s.alertConfirmations.filter((c) => c.userId !== id);
      s.alerts.forEach((a) => { if (a.authorId === id) a.authorId = null; });
      delete s.safetyPlans[id];
    });
    try { localStorage.removeItem(`miraher.cycle.${id}`); } catch { /* ignore */ }
    clearSession();
  }

  /* ---------------------------------------------------------------------------
     Circles and posts
     ------------------------------------------------------------------------- */
  const findCircle = (s, id) => s.circles.find((c) => c.id === id) || fail('We couldn’t find that circle.', 404);
  const findPost = (s, id) => s.posts.find((p) => p.id === id && p.status === 'visible') || fail('That post no longer exists.', 404);
  const isMemberOf = (s, uid, circleId) => s.memberships.some((m) => m.userId === uid && m.circleId === circleId);

  function listCircles() {
    const s = read();
    const u = requireUserIn(s);
    return s.circles.map((c) => circleView(s, c, u.id));
  }

  function getCircle(id, sort = 'recent') {
    const s = read();
    const u = requireUserIn(s);
    const c = findCircle(s, id);
    let posts = s.posts.filter((p) => p.circleId === c.id && p.status === 'visible').map((p) => postView(s, p, u.id));
    if (sort === 'supported') posts.sort((a, b) => b.totalReactions - a.totalReactions || b.createdAt - a.createdAt);
    else if (sort === 'unanswered') posts = posts.filter((p) => p.replyCount === 0).sort((a, b) => b.createdAt - a.createdAt);
    else posts.sort((a, b) => b.createdAt - a.createdAt);
    return { circle: circleView(s, c, u.id), posts };
  }

  function joinCircle(id) {
    return tx((s) => {
      const u = requireUserIn(s);
      const c = findCircle(s, id);
      if (!isMemberOf(s, u.id, c.id)) s.memberships.push({ userId: u.id, circleId: c.id });
      return circleView(s, c, u.id);
    });
  }

  function leaveCircle(id) {
    return tx((s) => {
      const u = requireUserIn(s);
      const c = findCircle(s, id);
      s.memberships = s.memberships.filter((m) => !(m.userId === u.id && m.circleId === c.id));
      return circleView(s, c, u.id);
    });
  }

  function feed() {
    const s = read();
    const u = requireUserIn(s);
    const joined = new Set(s.memberships.filter((m) => m.userId === u.id).map((m) => m.circleId));
    return s.posts
      .filter((p) => p.status === 'visible' && (joined.size === 0 || joined.has(p.circleId)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15)
      .map((p) => postView(s, p, u.id));
  }

  function createPost(circleId, { body, triggerWarning } = {}) {
    body = clean(body, 2000);
    if (body.length < 3) fail('Write a little more before you post.');
    return tx((s) => {
      const u = requireUserIn(s);
      const c = findCircle(s, circleId);
      if (!isMemberOf(s, u.id, c.id)) fail('Join this circle to post in it.', 403);
      const crisis = hasCrisisLanguage(body);
      const post = { id: newId('p'), circleId: c.id, authorId: u.id, body, triggerWarning: triggerWarning === true,
        createdAt: Date.now(), status: 'visible', crisis, crisisStatus: crisis ? 'open' : null };
      s.posts.push(post);
      if (crisis) notifyRoleIn(s, ['moderator'], `A post in ${c.name} may need urgent follow-up.`, 'admin.html#crisis', 'warning');
      return { post: postView(s, post, u.id), crisis };
    });
  }

  function deletePost(id) {
    tx((s) => {
      const u = requireUserIn(s);
      const p = findPost(s, id);
      if (p.authorId !== u.id && u.role !== 'moderator') fail('You can only delete your own posts.', 403);
      p.status = 'removed';
    });
  }

  function listReplies(postId) {
    const s = read();
    const u = requireUserIn(s);
    const p = findPost(s, postId);
    return s.replies.filter((r) => r.postId === p.id && r.status === 'visible')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => replyView(s, r, u.id));
  }

  function createReply(postId, body) {
    body = clean(body, 1000);
    if (body.length < 2) fail('Write a reply first.');
    return tx((s) => {
      const u = requireUserIn(s);
      const p = findPost(s, postId);
      const crisis = hasCrisisLanguage(body);
      const reply = { id: newId('r'), postId: p.id, authorId: u.id, body, createdAt: Date.now(), status: 'visible', crisis, crisisStatus: crisis ? 'open' : null };
      s.replies.push(reply);
      if (p.authorId && p.authorId !== u.id) {
        const c = s.circles.find((x) => x.id === p.circleId);
        notifyIn(s, p.authorId, `${u.alias} replied to your post in ${c ? c.name : 'a circle'}.`, `circle.html?id=${p.circleId}#post-${p.id}`, 'chat-circle');
      }
      if (crisis) notifyRoleIn(s, ['moderator'], 'A reply may need urgent follow-up.', 'admin.html#crisis', 'warning');
      const replyCount = s.replies.filter((r) => r.postId === p.id && r.status === 'visible').length;
      return { reply: replyView(s, reply, u.id), replyCount, crisis };
    });
  }

  function react(postId, type) {
    if (!REACTION_TYPES.includes(type)) fail('Unknown reaction.');
    return tx((s) => {
      const u = requireUserIn(s);
      const p = findPost(s, postId);
      const i = s.reactions.findIndex((r) => r.postId === p.id && r.userId === u.id && r.type === type);
      if (i >= 0) s.reactions.splice(i, 1);
      else s.reactions.push({ postId: p.id, userId: u.id, type });
      return postView(s, p, u.id);
    });
  }

  function reportPost(postId, reason) {
    tx((s) => {
      const u = requireUserIn(s);
      const p = findPost(s, postId);
      if (s.reports.some((r) => r.targetId === p.id && r.reporterId === u.id && r.status === 'open')) return;
      s.reports.push({ id: newId('rep'), targetType: 'post', targetId: p.id, reason: clean(reason, 120) || 'Something else', reporterId: u.id, createdAt: Date.now(), status: 'open' });
      notifyRoleIn(s, ['moderator'], 'A post was reported and needs review.', 'admin.html#reports', 'flag');
    });
  }

  /* ---------------------------------------------------------------------------
     Mood check-ins, journal, notifications
     ------------------------------------------------------------------------- */
  function listCheckins() {
    const s = read();
    const u = requireUserIn(s);
    const since = dayKey(Date.now() - 29 * 864e5);
    return s.checkins.filter((c) => c.userId === u.id && c.day >= since)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(({ day, mood }) => ({ day, mood }));
  }

  function checkIn(mood) {
    mood = Number(mood);
    if (![1, 2, 3, 4, 5].includes(mood)) fail('Choose how you are feeling.');
    const day = dayKey();
    tx((s) => {
      const u = requireUserIn(s);
      const existing = s.checkins.find((c) => c.userId === u.id && c.day === day);
      if (existing) existing.mood = mood;
      else s.checkins.push({ userId: u.id, day, mood });
    });
    return { day, mood };
  }

  function listJournal() {
    const s = read();
    const u = requireUserIn(s);
    return s.journal.filter((j) => j.userId === u.id).sort((a, b) => b.createdAt - a.createdAt)
      .map(({ id, body, tags, createdAt }) => ({ id, body, tags: [...tags], createdAt }));
  }

  function addJournal({ body, tags } = {}) {
    body = clean(body, 5000);
    if (!body) fail('Write something first.');
    const chosen = pickList(tags, JOURNAL_TAGS);
    return tx((s) => {
      const u = requireUserIn(s);
      const entry = { id: newId('j'), userId: u.id, body, tags: chosen, createdAt: Date.now() };
      s.journal.push(entry);
      return { id: entry.id, body, tags: [...chosen], createdAt: entry.createdAt };
    });
  }

  function deleteJournal(id) {
    tx((s) => {
      const u = requireUserIn(s);
      const before = s.journal.length;
      s.journal = s.journal.filter((j) => !(j.id === id && j.userId === u.id));
      if (s.journal.length === before) fail('That entry no longer exists.', 404);
    });
  }

  function listNotifications() {
    const s = read();
    const u = currentUserIn(s);
    if (!u) return { notifications: [], unread: 0 };
    const mine = s.notifications.filter((n) => n.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    return { notifications: mine.slice(0, 25).map((n) => ({ ...n })), unread: mine.filter((n) => !n.read).length };
  }

  function markAllRead() {
    tx((s) => {
      const u = requireUserIn(s);
      s.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; });
    });
  }

  /* ---------------------------------------------------------------------------
     Safety alerts and safety plan
     ------------------------------------------------------------------------- */
  function listAlerts(days = 7) {
    const s = read();
    const u = requireUserIn(s);
    const since = Date.now() - Math.min(Number(days) || 7, 90) * 864e5;
    return s.alerts.filter((a) => a.status === 'visible' && a.createdAt >= since)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((a) => alertView(s, a, u));
  }

  function nearestArea(point) {
    return AREAS.reduce((best, a) => (distanceKm(a, point) < distanceKm(best, point) ? a : best), AREAS[0]);
  }

  function createAlert({ type, place, lat, lng, areaId, happened, details, notify } = {}) {
    if (!ALERT_TYPES[type]) fail('Choose what happened.');
    lat = Number(lat); lng = Number(lng);
    const area = AREAS.find((a) => a.id === areaId);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      if (!area) fail('Tap the map, use your location, or choose an area first.');
      lat = area.lat; lng = area.lng;
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) fail('That location doesn’t look right.');
    // Blur the location by up to ~150 m so nobody can be pinpointed
    lat = Number((lat + (Math.random() - 0.5) * 0.0027).toFixed(4));
    lng = Number((lng + (Math.random() - 0.5) * 0.0027).toFixed(4));
    return tx((s) => {
      const u = requireUserIn(s);
      const alert = {
        id: newId('a'), authorId: u.id, type,
        place: clean(place, 80) || `Near ${nearestArea({ lat, lng }).name}`,
        lat, lng, details: clean(details, 400),
        happened: HAPPENED.includes(happened) ? happened : 'Just now',
        createdAt: Date.now(), status: 'visible', baseConfirmations: 1
      };
      s.alerts.push(alert);
      let reached = 0;
      if (notify !== false) {
        s.users.forEach((other) => {
          if (other.id === u.id || (other.settings && other.settings.nearbyAlerts === false)) return;
          const r = (other.settings && other.settings.alertRadiusKm) || 3;
          const near = (other.areas || []).some((id) => {
            const a = AREAS.find((x) => x.id === id);
            return a && distanceKm(a, alert) <= r;
          });
          if (near) {
            notifyIn(s, other.id, `New safety alert near ${alert.place}: ${ALERT_TYPES[type]}.`, `alerts.html#${alert.id}`, 'warning');
            reached += 1;
          }
        });
      }
      return { alert: alertView(s, alert, u), reached };
    });
  }

  function confirmAlert(id) {
    return tx((s) => {
      const u = requireUserIn(s);
      const a = s.alerts.find((x) => x.id === id && x.status === 'visible') || fail('That alert no longer exists.', 404);
      if (a.authorId === u.id) fail('You reported this one.');
      if (!s.alertConfirmations.some((c) => c.alertId === a.id && c.userId === u.id)) s.alertConfirmations.push({ alertId: a.id, userId: u.id });
      return alertView(s, a, u);
    });
  }

  function reportAlert(id, reason) {
    tx((s) => {
      const u = requireUserIn(s);
      const a = s.alerts.find((x) => x.id === id && x.status === 'visible') || fail('That alert no longer exists.', 404);
      if (s.reports.some((r) => r.targetId === a.id && r.reporterId === u.id && r.status === 'open')) return;
      s.reports.push({ id: newId('rep'), targetType: 'alert', targetId: a.id, reason: clean(reason, 120) || 'Something else', reporterId: u.id, createdAt: Date.now(), status: 'open' });
      notifyRoleIn(s, ['moderator'], 'A safety alert was reported and needs review.', 'admin.html#reports', 'flag');
    });
  }

  function deleteAlert(id) {
    tx((s) => {
      const u = requireUserIn(s);
      const a = s.alerts.find((x) => x.id === id && x.status === 'visible') || fail('That alert no longer exists.', 404);
      if (a.authorId !== u.id && u.role !== 'moderator') fail('You can only remove your own alerts.', 403);
      a.status = 'removed';
    });
  }

  const PLAN_FIELDS = ['warningSigns', 'safePlaces', 'trustedPeople', 'codeWord', 'takeWithMe', 'notes'];
  function getSafetyPlan() {
    const s = read();
    const u = requireUserIn(s);
    return { ...(s.safetyPlans[u.id] || {}) };
  }
  function saveSafetyPlan(plan = {}) {
    return tx((s) => {
      const u = requireUserIn(s);
      const saved = { updatedAt: Date.now() };
      PLAN_FIELDS.forEach((f) => { saved[f] = clean(plan[f], 600); });
      s.safetyPlans[u.id] = saved;
      return { ...saved };
    });
  }

  /* ---------------------------------------------------------------------------
     Talk to a listener (peer support chat)
     If no human listener picks up, GentleHeart, an automated demo listener,
     joins so the demo always works. When a listener has the Listener Hub open
     in another tab, people wait longer for a human first.
     ------------------------------------------------------------------------- */
  const BOT_LINES = [
    'Thank you for trusting me with that. It sounds really heavy. How long have you been feeling this way?',
    'That makes a lot of sense. You’re not alone in this, and none of it is your fault.',
    'What would feel most helpful right now: talking it through, or looking at some next steps together?',
    'You’re doing something brave by reaching out. Is there someone in your life you feel safe with?',
    'We can take this one step at a time. I’m here for as long as you need.'
  ];
  const BOT_CRISIS = 'I’m really glad you told me. Your safety matters most right now. If you’re thinking about ending your life or you’re in danger, please call the SADAG Suicide Crisis Line on 0800 567 567, or 10111 in an emergency. You can also tap “Request professional help” and our team will reach out. I’m staying right here with you.';
  const sysMsg = (body) => ({ id: newId('m'), from: 'system', body, at: Date.now() });

  function heartbeat() {
    const u = currentUserIn(read());
    if (!u || !isListenerRole(u)) return;
    let p = {};
    try { p = JSON.parse(storageGet(PRESENCE_KEY) || '{}'); } catch { /* ignore */ }
    p[u.id] = Date.now();
    storageSet(PRESENCE_KEY, JSON.stringify(p));
  }
  function listenerOnline() {
    try {
      const p = JSON.parse(storageGet(PRESENCE_KEY) || '{}');
      return Object.values(p).some((t) => Date.now() - t < 30000);
    } catch { return false; }
  }

  function startChat(topic) {
    topic = CHAT_TOPICS.includes(topic) ? topic : CHAT_TOPICS[0];
    return tx((s) => {
      const u = requireUserIn(s);
      const existing = s.chats.find((c) => c.memberId === u.id && c.status !== 'ended');
      if (existing) return chatView(s, existing, u.id);
      const chat = { id: newId('c'), memberId: u.id, listenerId: null, status: 'waiting', topic, createdAt: Date.now(),
        acceptedAt: null, endedAt: null, escalated: false, escalationHandled: false, rating: null,
        messages: [sysMsg('We’re finding a trained peer listener for you. This usually takes less than a minute.')] };
      s.chats.push(chat);
      notifyRoleIn(s, ['listener', 'moderator'], `Someone is waiting to talk: “${topic}”.`, 'listener.html#hub', 'headset');
      return chatView(s, chat, u.id);
    });
  }

  function maybeAssignBot(chatId) {
    const s = read();
    const c = s.chats.find((x) => x.id === chatId);
    if (!c || c.status !== 'waiting') return;
    const wait = (listenerOnline() ? 60 : 10) * 1000;
    if (Date.now() - c.createdAt < wait) return;
    tx((st) => {
      const chat = st.chats.find((x) => x.id === chatId);
      if (!chat || chat.status !== 'waiting') return;
      chat.listenerId = BOT_ID;
      chat.status = 'active';
      chat.acceptedAt = Date.now();
      chat.messages.push(sysMsg('GentleHeart, an automated demo listener, joined the chat.'));
      chat.messages.push({ id: newId('m'), from: 'listener', body: 'Hi, I’m GentleHeart. Thank you for reaching out. That takes courage. What’s on your mind today?', at: Date.now() });
    });
  }

  function myChats() {
    const s = read();
    const u = requireUserIn(s);
    const mine = s.chats.filter((c) => c.memberId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    return {
      active: (() => { const c = mine.find((x) => x.status !== 'ended'); return c ? chatView(s, c, u.id) : null; })(),
      history: mine.filter((c) => c.status === 'ended').map((c) => chatView(s, c, u.id)),
      listening: isListenerRole(u)
        ? s.chats.filter((c) => c.listenerId === u.id && c.status === 'active').map((c) => chatView(s, c, u.id))
        : []
    };
  }

  function chatQueue() {
    const s = read();
    requireRoleIn(s, ['listener', 'moderator']);
    return s.chats.filter((c) => c.status === 'waiting').sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => ({ id: c.id, topic: c.topic, createdAt: c.createdAt, member: authorView(s, c.memberId) }));
  }

  function acceptChat(id) {
    return tx((s) => {
      const u = requireRoleIn(s, ['listener', 'moderator']);
      const c = s.chats.find((x) => x.id === id) || fail('That conversation no longer exists.', 404);
      if (c.memberId === u.id) fail('You can’t accept your own conversation.');
      if (c.status !== 'waiting') fail('Another listener has already joined this conversation.', 409);
      c.listenerId = u.id;
      c.status = 'active';
      c.acceptedAt = Date.now();
      c.messages.push(sysMsg(`${u.alias}, a trained peer listener, joined the chat.`));
      return chatView(s, c, u.id);
    });
  }

  function getChat(id) {
    maybeAssignBot(id);
    const s = read();
    const u = requireUserIn(s);
    const c = s.chats.find((x) => x.id === id) || fail('That conversation no longer exists.', 404);
    if (c.memberId !== u.id && c.listenerId !== u.id && u.role !== 'moderator') fail('This conversation is private.', 403);
    return chatView(s, c, u.id);
  }

  function scheduleBotReply(chatId) {
    setTimeout(() => {
      try {
        tx((s) => {
          const c = s.chats.find((x) => x.id === chatId);
          if (!c || c.status !== 'active' || c.listenerId !== BOT_ID) return;
          const last = [...c.messages].reverse().find((m) => m.from === 'member');
          const sent = c.messages.filter((m) => m.from === 'listener').length;
          const body = last && hasCrisisLanguage(last.body) ? BOT_CRISIS : BOT_LINES[(sent - 1) % BOT_LINES.length];
          c.messages.push({ id: newId('m'), from: 'listener', body, at: Date.now() });
        });
      } catch (err) { console.error(err); }
    }, 1800);
  }

  function sendChatMessage(id, body) {
    body = clean(body, 1000);
    if (!body) fail('Type a message first.');
    let toBot = false;
    const msg = tx((s) => {
      const u = requireUserIn(s);
      const c = s.chats.find((x) => x.id === id) || fail('That conversation no longer exists.', 404);
      const from = c.memberId === u.id ? 'member' : c.listenerId === u.id ? 'listener' : null;
      if (!from) fail('This conversation is private.', 403);
      if (c.status === 'waiting') fail('Please wait a moment. A listener is joining.');
      if (c.status === 'ended') fail('This conversation has ended.');
      const m = { id: newId('m'), from, body, at: Date.now() };
      c.messages.push(m);
      toBot = from === 'member' && c.listenerId === BOT_ID;
      return m;
    });
    if (toBot) scheduleBotReply(id);
    return msg;
  }

  function endChat(id) {
    return tx((s) => {
      const u = requireUserIn(s);
      const c = s.chats.find((x) => x.id === id) || fail('That conversation no longer exists.', 404);
      if (c.memberId !== u.id && c.listenerId !== u.id) fail('This conversation is private.', 403);
      if (c.status !== 'ended') {
        c.status = 'ended';
        c.endedAt = Date.now();
        c.messages.push(sysMsg(`${u.alias} ended the conversation.`));
      }
      return chatView(s, c, u.id);
    });
  }

  function rateChat(id, stars) {
    stars = Number(stars);
    if (![1, 2, 3, 4, 5].includes(stars)) fail('Choose a rating from 1 to 5.');
    tx((s) => {
      const u = requireUserIn(s);
      const c = s.chats.find((x) => x.id === id && x.memberId === u.id) || fail('That conversation no longer exists.', 404);
      c.rating = stars;
    });
  }

  function escalateChat(id) {
    return tx((s) => {
      const u = requireUserIn(s);
      const c = s.chats.find((x) => x.id === id) || fail('That conversation no longer exists.', 404);
      if (c.memberId !== u.id && c.listenerId !== u.id) fail('This conversation is private.', 403);
      if (!c.escalated) {
        c.escalated = true;
        c.messages.push(sysMsg('A request for professional support was sent to the MIRA Her team. If you’re in danger right now, call 10111 or the GBV Command Centre on 0800 428 428.'));
        notifyRoleIn(s, ['moderator'], 'A chat was escalated and needs professional follow-up.', 'admin.html#escalations', 'siren');
      }
      return chatView(s, c, u.id);
    });
  }

  /* ---------------------------------------------------------------------------
     Mentorship, workshops and health questions
     ------------------------------------------------------------------------- */
  function listMentors() {
    const s = read();
    const u = requireUserIn(s);
    const mine = s.mentorRequests.filter((r) => r.userId === u.id);
    return {
      mentors: s.mentors.map((m) => ({ ...m, fieldLabel: MENTOR_FIELDS[m.field], requested: mine.some((r) => r.mentorId === m.id) })),
      requests: mine.sort((a, b) => b.createdAt - a.createdAt).map((r) => {
        const m = s.mentors.find((x) => x.id === r.mentorId);
        return { id: r.id, mentorAlias: m ? m.alias : 'Mentor', goal: r.goal, status: r.status, createdAt: r.createdAt };
      })
    };
  }

  function requestMentor(mentorId, { goal, message } = {}) {
    return tx((s) => {
      const u = requireUserIn(s);
      const m = s.mentors.find((x) => x.id === mentorId) || fail('We couldn’t find that mentor.', 404);
      if (s.mentorRequests.some((r) => r.userId === u.id && r.mentorId === m.id)) fail(`You’ve already asked ${m.alias}. Mentors usually reply within 48 hours.`, 409);
      const r = { id: newId('mr'), mentorId: m.id, userId: u.id, goal: clean(goal, 80) || 'General guidance', message: clean(message, 600), status: 'pending', createdAt: Date.now() };
      s.mentorRequests.push(r);
      notifyIn(s, u.id, `Your request was sent to ${m.alias}. Mentors usually reply within 48 hours.`, 'mentorship.html', 'graduation-cap');
      return r;
    });
  }

  function workshopView(s, w, uid) {
    const going = s.rsvps.filter((r) => r.workshopId === w.id);
    return { ...w, attendees: w.baseRsvps + going.length, going: going.some((r) => r.userId === uid) };
  }
  function listWorkshops() {
    const s = read();
    const u = requireUserIn(s);
    // Roll past sessions forward a week so the demo always has upcoming ones
    return s.workshops.map((w) => {
      let at = w.at;
      while (at < Date.now()) at += 7 * 864e5;
      return workshopView(s, { ...w, at }, u.id);
    }).sort((a, b) => a.at - b.at);
  }
  function toggleRsvp(id) {
    return tx((s) => {
      const u = requireUserIn(s);
      const w = s.workshops.find((x) => x.id === id) || fail('We couldn’t find that session.', 404);
      const i = s.rsvps.findIndex((r) => r.workshopId === w.id && r.userId === u.id);
      if (i >= 0) s.rsvps.splice(i, 1);
      else s.rsvps.push({ workshopId: w.id, userId: u.id });
      return workshopView(s, w, u.id);
    });
  }

  function listQuestions() {
    const s = read();
    const u = requireUserIn(s);
    const view = (q) => ({ id: q.id, body: q.body, answer: q.answer, answeredBy: q.answeredBy, createdAt: q.createdAt, answeredAt: q.answeredAt, mine: q.userId === u.id });
    return {
      answered: s.questions.filter((q) => q.answer && q.public !== false).sort((a, b) => b.answeredAt - a.answeredAt).slice(0, 8).map(view),
      mine: s.questions.filter((q) => q.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).map(view)
    };
  }

  function askQuestion(body) {
    body = clean(body, 600);
    if (body.length < 8) fail('Please write your question in a little more detail.');
    return tx((s) => {
      const u = requireUserIn(s);
      const q = { id: newId('q'), userId: u.id, body, createdAt: Date.now(), answer: null, answeredBy: null, answeredAt: null, public: true };
      s.questions.push(q);
      notifyRoleIn(s, ['moderator'], 'A new anonymous health question is waiting for a nurse.', 'admin.html#questions', 'first-aid-kit');
      return { id: q.id };
    });
  }

  /* ---------------------------------------------------------------------------
     Moderator tools
     ------------------------------------------------------------------------- */
  function adminOverview() {
    const s = read();
    requireRoleIn(s, ['moderator']);
    const week = Date.now() - 7 * 864e5;
    return {
      members: s.users.length,
      postsThisWeek: s.posts.filter((p) => p.createdAt >= week && p.status === 'visible').length,
      openReports: s.reports.filter((r) => r.status === 'open').length,
      crisisOpen: s.posts.filter((p) => p.crisis && p.crisisStatus === 'open' && p.status === 'visible').length
        + s.replies.filter((r) => r.crisis && r.crisisStatus === 'open' && r.status === 'visible').length,
      pendingQuestions: s.questions.filter((q) => !q.answer).length,
      waitingChats: s.chats.filter((c) => c.status === 'waiting').length,
      escalations: s.chats.filter((c) => c.escalated && !c.escalationHandled).length,
      alertsThisWeek: s.alerts.filter((a) => a.createdAt >= week && a.status === 'visible').length
    };
  }

  function adminReports() {
    const s = read();
    requireRoleIn(s, ['moderator']);
    const groups = {};
    s.reports.filter((r) => r.status === 'open').forEach((r) => {
      const key = `${r.targetType}:${r.targetId}`;
      if (!groups[key]) groups[key] = { id: r.id, targetType: r.targetType, targetId: r.targetId, reasons: [], count: 0, createdAt: r.createdAt };
      groups[key].reasons.push(r.reason);
      groups[key].count += 1;
    });
    return Object.values(groups).map((g) => {
      if (g.targetType === 'post') {
        const p = s.posts.find((x) => x.id === g.targetId);
        const c = p && s.circles.find((x) => x.id === p.circleId);
        return { ...g, body: p ? p.body : '(deleted)', where: c ? c.name : '', author: p ? authorView(s, p.authorId) : null };
      }
      const a = s.alerts.find((x) => x.id === g.targetId);
      return { ...g, body: a ? `${ALERT_TYPES[a.type]} at ${a.place}. ${a.details || ''}` : '(deleted)', where: 'Safety alerts', author: a ? authorView(s, a.authorId) : null };
    }).sort((a, b) => b.count - a.count);
  }

  function resolveReport(reportId, action) {
    if (!['keep', 'remove'].includes(action)) fail('Choose keep or remove.');
    tx((s) => {
      requireRoleIn(s, ['moderator']);
      const r = s.reports.find((x) => x.id === reportId) || fail('That report no longer exists.', 404);
      s.reports.forEach((x) => { if (x.targetId === r.targetId && x.status === 'open') x.status = action === 'remove' ? 'removed' : 'kept'; });
      if (action === 'remove') {
        const target = r.targetType === 'post' ? s.posts.find((p) => p.id === r.targetId) : s.alerts.find((a) => a.id === r.targetId);
        if (target) target.status = 'removed';
      }
    });
  }

  function adminCrisis() {
    const s = read();
    requireRoleIn(s, ['moderator']);
    const posts = s.posts.filter((p) => p.crisis && p.crisisStatus === 'open' && p.status === 'visible').map((p) => {
      const c = s.circles.find((x) => x.id === p.circleId);
      return { kind: 'post', id: p.id, body: p.body, createdAt: p.createdAt, author: authorView(s, p.authorId), where: c ? c.name : '', link: `circle.html?id=${p.circleId}#post-${p.id}` };
    });
    const replies = s.replies.filter((r) => r.crisis && r.crisisStatus === 'open' && r.status === 'visible').map((r) => {
      const p = s.posts.find((x) => x.id === r.postId);
      return { kind: 'reply', id: r.id, body: r.body, createdAt: r.createdAt, author: authorView(s, r.authorId), where: 'Reply', link: p ? `circle.html?id=${p.circleId}#post-${p.id}` : 'circles.html' };
    });
    return [...posts, ...replies].sort((a, b) => b.createdAt - a.createdAt);
  }

  function resolveCrisis(kind, id) {
    tx((s) => {
      requireRoleIn(s, ['moderator']);
      const list = kind === 'reply' ? s.replies : s.posts;
      const item = list.find((x) => x.id === id) || fail('That item no longer exists.', 404);
      item.crisisStatus = 'followed-up';
    });
  }

  function adminQuestions() {
    const s = read();
    requireRoleIn(s, ['moderator']);
    return s.questions.filter((q) => !q.answer).sort((a, b) => a.createdAt - b.createdAt).map((q) => ({ id: q.id, body: q.body, createdAt: q.createdAt }));
  }

  function answerQuestion(id, answer) {
    answer = clean(answer, 1500);
    if (answer.length < 10) fail('Please write a full answer.');
    tx((s) => {
      requireRoleIn(s, ['moderator']);
      const q = s.questions.find((x) => x.id === id) || fail('That question no longer exists.', 404);
      q.answer = answer;
      q.answeredBy = 'MIRA Her Nurse Team';
      q.answeredAt = Date.now();
      notifyIn(s, q.userId, 'A nurse answered your anonymous health question.', 'health.html#my-questions', 'first-aid-kit');
    });
  }

  function adminEscalations() {
    const s = read();
    requireRoleIn(s, ['moderator']);
    return s.chats.filter((c) => c.escalated && !c.escalationHandled).sort((a, b) => b.createdAt - a.createdAt).map((c) => ({
      id: c.id, topic: c.topic, status: c.status, createdAt: c.createdAt,
      member: authorView(s, c.memberId), listener: c.listenerId ? authorView(s, c.listenerId) : null,
      lastMessage: (() => { const m = [...c.messages].reverse().find((x) => x.from === 'member'); return m ? m.body : ''; })()
    }));
  }

  function resolveEscalation(id) {
    tx((s) => {
      requireRoleIn(s, ['moderator']);
      const c = s.chats.find((x) => x.id === id) || fail('That conversation no longer exists.', 404);
      c.escalationHandled = true;
      notifyIn(s, c.memberId, 'A member of the MIRA Her support team has picked up your request for help.', 'listener.html', 'hand-heart');
    });
  }

  /* ---------------------------------------------------------------------------
     Demo data
     ------------------------------------------------------------------------- */
  function resetDemo() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('miraher.')).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    clearSession();
    cache = null;
    cacheRaw = null;
    read();
  }

  function buildSeed() {
    const now = Date.now();
    const H = 3600e3;
    const D = 24 * H;
    const settings = () => ({ nearbyAlerts: true, alertRadiusKm: 3, logoutOnExit: true });
    const mk = (alias, avatar, role, password, extra = {}) => ({
      id: newId('u'), alias, avatar, role, topics: extra.topics || [], areas: extra.areas || [], settings: settings(),
      createdAt: now - (extra.age || 40) * D, password: hashSecret(password),
      recovery: hashSecret(normaliseCode(extra.code || recoveryCode()))
    });

    const lily = mk('BraveLily', 'lotus', 'member', 'demo1234', {
      topics: ['Safety & Abuse', 'Mental Wellbeing', 'Women in Tech', 'Reproductive Health', 'Staying Safe in SA'],
      areas: ['braamfontein', 'rosebank', 'cbd'], code: 'LAVENDER-RIVER-2026-PROTEA-DAWN', age: 60
    });
    const river = mk('QuietRiver', 'butterfly', 'member', 'demo1234', { topics: ['Women in Tech', 'Careers'], areas: ['sandton', 'braamfontein'] });
    const marula = mk('SunnyMarula', 'sun', 'member', 'demo1234', { topics: ['Motherhood', 'Mental Wellbeing'], areas: ['soweto'] });
    const water = mk('StillWater', 'flower', 'member', 'demo1234', { topics: ['Safety & Abuse', 'Relationships'], areas: ['melville'] });
    const thunder = mk('SoftThunder', 'moon', 'member', 'demo1234', { topics: ['Reproductive Health', 'Student Life'], areas: ['braamfontein', 'cbd'] });
    const jasmine = mk('WildJasmine', 'tulip', 'member', 'demo1234', { topics: ['Staying Safe in SA', 'Money & Independence'], areas: ['rosebank', 'hillbrow'] });
    const cash = mk('QuickCash99', 'sparkle', 'member', 'demo1234', { age: 2 });
    const gentle = mk('GentleMoon', 'moon', 'listener', 'listen1234', { topics: ['Mental Wellbeing', 'Safety & Abuse'] });
    gentle.avatar = 'plant';
    const mod = mk('Moderator', 'feather', 'moderator', 'moderate1234', {});
    const users = [lily, river, marula, water, thunder, jasmine, cash, gentle, mod];

    const circles = [
      { id: 'safety', name: 'Safety & Abuse', icon: 'shield-check', description: 'A protected space to talk about unsafe relationships, abuse and getting out safely.', baseMembers: 1240 },
      { id: 'wellbeing', name: 'Mental Wellbeing', icon: 'brain', description: 'Anxiety, burnout, low days and the good days too.', baseMembers: 2310 },
      { id: 'relationships', name: 'Relationships', icon: 'heart', description: 'Partners, family and friendships: the good, the hard and the confusing.', baseMembers: 1660 },
      { id: 'motherhood', name: 'Motherhood', icon: 'baby', description: 'Pregnancy, new moms and the juggle of raising kids.', baseMembers: 980 },
      { id: 'health', name: 'Reproductive Health', icon: 'flower-lotus', description: 'Periods, contraception, fertility and pregnancy, without shame.', baseMembers: 1420 },
      { id: 'money', name: 'Money & Independence', icon: 'wallet', description: 'Budgeting, side hustles, stokvels and financial freedom.', baseMembers: 760 },
      { id: 'careers', name: 'Careers', icon: 'briefcase', description: 'Job hunting, interviews, workplace challenges and growth.', baseMembers: 890 },
      { id: 'tech', name: 'Women in Tech', icon: 'laptop', description: 'Students and professionals building careers in tech.', baseMembers: 1530 },
      { id: 'students', name: 'Student Life', icon: 'student', description: 'Studies, stress, friendships and figuring it all out.', baseMembers: 1890 },
      { id: 'safe-sa', name: 'Staying Safe in SA', icon: 'map-pin', description: 'Share safety tips and warn each other about unsafe places.', baseMembers: 2050 }
    ];

    const memberships = [];
    const join = (u, ids) => ids.forEach((circleId) => memberships.push({ userId: u.id, circleId }));
    join(lily, ['safety', 'wellbeing', 'tech', 'health', 'safe-sa']);
    join(river, ['tech', 'careers']);
    join(marula, ['motherhood', 'wellbeing']);
    join(water, ['safety', 'relationships', 'wellbeing']);
    join(thunder, ['health', 'students', 'safe-sa']);
    join(jasmine, ['safe-sa', 'money']);
    join(cash, ['money']);
    join(gentle, ['wellbeing', 'safety', 'motherhood']);

    const posts = [];
    const post = (u, circleId, hoursAgo, body, extra = {}) => {
      const p = { id: newId('p'), circleId, authorId: u.id, body, triggerWarning: !!extra.tw, createdAt: now - hoursAgo * H,
        status: 'visible', crisis: !!extra.crisis, crisisStatus: extra.crisis ? 'open' : null };
      posts.push(p);
      return p;
    };
    const pLily = post(lily, 'safety', 26, 'I finally told someone today about what’s been happening at home. I was so scared, but she just listened. Thank you all for making me feel brave enough.');
    const pRiver = post(river, 'tech', 2, 'I’m the only woman in my programming class and sometimes I feel like I have to prove I belong twice as hard. Anyone else?');
    const pThunder = post(thunder, 'health', 3, 'My periods are so painful I miss class every month. The clinic just gave me painkillers. Has anyone been checked for endometriosis?');
    const pMarula = post(marula, 'motherhood', 4, 'Three months postpartum and I still don’t feel like myself. Is it normal to feel this lonely even when the baby is right here?');
    const pJasmine = post(jasmine, 'safe-sa', 6, 'Heads up for anyone using the walkway near Rosebank station at night: the lights have been out all week. I walk with a friend now and share my location.');
    const pWater = post(water, 'safety', 20, 'He checks my phone every night. I’ve started deleting messages just to avoid arguments. I don’t know if this is normal anymore.', { tw: true });
    const pExams = post(thunder, 'students', 30, 'Exams are starting and I can barely sleep. How do you all cope with the pressure?');
    const pIntern = post(river, 'careers', 50, 'I got my first internship offer! Thank you to everyone in Women in Tech who helped me prepare for the interview.');
    const pScam = post(cash, 'money', 9, 'Make R5000 a day from home!!! DM me for the secret investment plan. Limited spots, send your bank details to join.');
    post(water, 'wellbeing', 7, 'Lately it feels like there’s no reason to go on. Everything feels too heavy and I’m so tired.', { tw: true, crisis: true });

    const replies = [];
    const reply = (u, p, hoursAgo, body) => replies.push({ id: newId('r'), postId: p.id, authorId: u.id, body, createdAt: now - hoursAgo * H, status: 'visible', crisis: false, crisisStatus: null });
    reply(gentle, pLily, 25, 'That took so much courage. We’re proud of you. The Safety Toolkit has a step-by-step safety plan if you ever need it.');
    reply(water, pLily, 24, 'Sending you so much strength. You’re not alone here.');
    reply(lily, pRiver, 1.5, 'Every single day. I started a study group with two other women in my class and it helps so much.');
    reply(jasmine, pRiver, 1, 'You belong there. Don’t let anyone make you feel otherwise.');
    reply(gentle, pMarula, 3, 'What you’re feeling is really common, and it can also be a sign of postnatal depression, which is treatable. It might help to mention it at your next clinic visit.');
    reply(lily, pThunder, 2, 'Yes! It took me two years to get diagnosed. Ask to be referred to a gynaecologist and keep a pain diary to show them.');
    reply(gentle, pWater, 19, 'Checking your phone every night is a form of control, and you deserve privacy and trust. If you’d like, a listener can talk this through with you privately.');
    reply(thunder, pJasmine, 5, 'Thank you for sharing this. I added it to the Safety Alerts map too.');
    reply(marula, pExams, 28, 'Short study sessions with proper breaks helped me. And please be kind to yourself about sleep.');

    const reactions = [];
    const reactAll = (p, list) => list.forEach(([u, type]) => reactions.push({ postId: p.id, userId: u.id, type }));
    reactAll(pLily, [[water, 'strength'], [gentle, 'strength'], [river, 'strength'], [thunder, 'relate'], [jasmine, 'strength']]);
    reactAll(pRiver, [[lily, 'relate'], [thunder, 'relate'], [jasmine, 'strength']]);
    reactAll(pThunder, [[lily, 'relate'], [marula, 'helpful']]);
    reactAll(pMarula, [[gentle, 'strength'], [water, 'relate']]);
    reactAll(pJasmine, [[thunder, 'helpful'], [lily, 'helpful'], [river, 'helpful'], [marula, 'helpful']]);
    reactAll(pWater, [[gentle, 'strength'], [lily, 'relate']]);
    reactAll(pIntern, [[lily, 'strength'], [jasmine, 'strength'], [thunder, 'strength']]);

    const reports = [
      { id: newId('rep'), targetType: 'post', targetId: pScam.id, reason: 'Spam or a scam', reporterId: lily.id, createdAt: now - 8 * H, status: 'open' },
      { id: newId('rep'), targetType: 'post', targetId: pScam.id, reason: 'Spam or a scam', reporterId: jasmine.id, createdAt: now - 7 * H, status: 'open' }
    ];

    const alerts = [];
    const alert = (u, type, place, lat, lng, hoursAgo, details, confirmations, happened = 'Earlier today') => {
      const a = { id: newId('a'), authorId: u.id, type, place, lat, lng, details, happened, createdAt: now - hoursAgo * H, status: 'visible', baseConfirmations: confirmations };
      alerts.push(a);
      return a;
    };
    const aBraam = alert(thunder, 'harassment', 'Braamfontein, near the campus bus stop', -26.1929, 28.0305, 2, 'A group of men harassing women walking to campus in the morning.', 4, 'Earlier today');
    alert(river, 'theft', 'Park Station taxi exit', -26.1956, 28.0412, 5, 'Phone snatched near the taxi exit. Keep phones out of sight.', 2);
    const aRose = alert(jasmine, 'area', 'Rosebank station walkway', -26.1460, 28.0436, 26, 'The walkway lights have been out all week. Very dark after 6pm.', 7, 'Yesterday');
    alert(water, 'followed', 'Bree Taxi Rank', -26.2005, 28.0350, 30, 'A woman was followed from the rank after dark. Walk in groups if you can.', 3, 'Yesterday');
    alert(river, 'transport', 'Sandton, near the Gautrain station', -26.1076, 28.0567, 48, 'An e-hailing car didn’t match the app and the driver changed the route. Always check the plate.', 5, 'This week');
    alert(water, 'harassment', 'Melville, 7th Street', -26.1770, 28.0080, 72, 'Catcalling and a man following women late at night.', 2, 'This week');
    alert(marula, 'transport', 'Soweto, Bara taxi rank', -26.2630, 27.9420, 100, 'Overloaded taxi and a driver who wouldn’t stop when asked.', 2, 'This week');

    const notifications = [];
    const note = (u, text, link, icon, hoursAgo, read = false) => notifications.push({ id: newId('n'), userId: u.id, text, link, icon, createdAt: now - hoursAgo * H, read });
    note(lily, 'GentleMoon replied to your post in Safety & Abuse.', `circle.html?id=safety#post-${pLily.id}`, 'chat-circle', 25);
    note(lily, `New safety alert near ${aBraam.place}: Harassment or catcalling.`, `alerts.html#${aBraam.id}`, 'warning', 2);
    note(lily, 'A nurse answered your anonymous health question.', 'health.html#my-questions', 'first-aid-kit', 20);
    note(lily, `New safety alert near ${aRose.place}: Poor lighting or unsafe area.`, `alerts.html#${aRose.id}`, 'warning', 26, true);
    note(lily, 'Welcome to MIRA Her. You’re anonymous here, so take your time.', 'dashboard.html', 'hand-heart', 24 * 60, true);
    note(mod, 'A post was reported and needs review.', 'admin.html#reports', 'flag', 7);
    note(mod, 'A post in Mental Wellbeing may need urgent follow-up.', 'admin.html#crisis', 'warning', 7);
    note(mod, 'A new anonymous health question is waiting for a nurse.', 'admin.html#questions', 'first-aid-kit', 10);

    const checkins = [];
    const moodPattern = [2, 2, 3, 2, 3, 3, 2, 3, 4, 3, 3, 4, 3, 4, 4, 3, 4, 5];
    let k = 0;
    for (let daysAgo = 29; daysAgo >= 1 && k < moodPattern.length; daysAgo--) {
      if (daysAgo % 5 === 0 || daysAgo % 7 === 0) continue;
      checkins.push({ userId: lily.id, day: dayKey(now - daysAgo * D), mood: moodPattern[k++] });
    }

    const journal = [
      { id: newId('j'), userId: lily.id, body: 'Told my sister about everything today. I feel lighter, even though I’m still scared. Writing it down so I remember that I can do hard things.', tags: ['Hopeful', 'Proud'], createdAt: now - 3 * D },
      { id: newId('j'), userId: lily.id, body: 'Couldn’t sleep again. Writing it down helps a little. Tomorrow I’ll check in with my circle.', tags: ['Anxious', 'Tired'], createdAt: now - 8 * D }
    ];

    const mentors = [
      { id: 'm1', alias: 'CodeQueen', icon: 'code', title: 'Senior Software Engineer', years: 8, field: 'software', bio: 'Self-taught developer who now leads a team of 12. Loves helping women land their first developer job.', skills: ['CVs', 'Interviews', 'Java', 'Mock tech interviews'], languages: ['English', 'isiZulu'] },
      { id: 'm2', alias: 'CyberRose', icon: 'shield-check', title: 'Security Analyst', years: 5, field: 'cyber', bio: 'Moved from admin work into cybersecurity in her late twenties. Proof it’s never too late.', skills: ['Security+', 'Career switch', 'SOC work'], languages: ['English', 'Sesotho'] },
      { id: 'm3', alias: 'DataDiva', icon: 'chart-bar', title: 'Data Scientist', years: 6, field: 'data', bio: 'Uses data to improve public health programmes across Gauteng.', skills: ['Python', 'SQL', 'Leadership'], languages: ['English', 'Afrikaans'] },
      { id: 'm4', alias: 'PixelPetal', icon: 'paint-brush', title: 'UX Designer', years: 4, field: 'design', bio: 'Designs banking apps used by millions of South Africans.', skills: ['Figma', 'Portfolios', 'User research'], languages: ['English', 'Sepedi'] },
      { id: 'm5', alias: 'FounderFynbos', icon: 'rocket-launch', title: 'Startup Founder', years: 10, field: 'business', bio: 'Built and sold an edtech startup. Now backs women-led businesses.', skills: ['Funding', 'Pitching', 'Business plans'], languages: ['English', 'isiXhosa'] },
      { id: 'm6', alias: 'CloudKaroo', icon: 'cloud', title: 'Cloud Engineer', years: 7, field: 'software', bio: 'Azure certified engineer who helps students through their first certifications.', skills: ['Azure', 'DevOps', 'Certifications'], languages: ['English', 'Setswana'] }
    ];

    const nextAt = (dow, hour, minute = 0) => {
      const d = new Date(now);
      d.setHours(hour, minute, 0, 0);
      let diff = (dow - d.getDay() + 7) % 7;
      if (diff === 0 && d.getTime() <= now) diff = 7;
      d.setDate(d.getDate() + diff);
      return d.getTime();
    };
    const workshops = [
      { id: 'w1', title: 'Setting boundaries in relationships', host: 'GentleMoon, Peer Listener', kind: 'Live session', icon: 'hand-heart', at: nextAt(2, 18), baseRsvps: 63 },
      { id: 'w2', title: 'Your first tech CV', host: 'CodeQueen', kind: 'Workshop', icon: 'file-text', at: nextAt(1, 18), baseRsvps: 34 },
      { id: 'w3', title: 'Know your rights: protection orders explained', host: 'MIRA Her legal volunteers', kind: 'Live session', icon: 'scales', at: nextAt(4, 18, 30), baseRsvps: 41 },
      { id: 'w4', title: 'Owning the room: leadership for women', host: 'FounderFynbos', kind: 'Workshop', icon: 'presentation-chart', at: nextAt(3, 19), baseRsvps: 52 },
      { id: 'w5', title: 'Breaking into cybersecurity', host: 'CyberRose', kind: 'Workshop', icon: 'shield-check', at: nextAt(6, 10), baseRsvps: 27 }
    ];

    const questions = [
      { id: newId('q'), userId: river.id, body: 'Can I get the contraceptive injection for free?', answer: 'Yes. Public clinics in South Africa provide contraception free of charge, including the injection, the pill, the implant and the IUD (loop). You don’t need a partner’s permission, and young people can get contraception confidentially.', answeredBy: 'Nurse Thandi', createdAt: now - 4 * D, answeredAt: now - 3.5 * D, public: true },
      { id: newId('q'), userId: thunder.id, body: 'How soon after unprotected sex can I get PEP?', answer: 'PEP (post-exposure prophylaxis) must be started within 72 hours, and the sooner the better. Go to a clinic, hospital or Thuthuzela Care Centre straight away and say you need PEP. It’s free at public facilities.', answeredBy: 'Nurse Lindiwe', createdAt: now - 3 * D, answeredAt: now - 2.8 * D, public: true },
      { id: newId('q'), userId: lily.id, body: 'Is it normal for my period to be late after exams?', answer: 'Stress can delay ovulation, which pushes your period later, so a late period during exams is common. If you’ve had unprotected sex, take a pregnancy test. If your period is more than 3 months late, or this keeps happening, please visit your clinic.', answeredBy: 'Nurse Thandi', createdAt: now - 2 * D, answeredAt: now - 20 * H, public: true },
      { id: newId('q'), userId: marula.id, body: 'Is it safe to take painkillers while breastfeeding?', answer: null, answeredBy: null, createdAt: now - 10 * H, answeredAt: null, public: true }
    ];

    const chats = [{
      id: newId('c'), memberId: lily.id, listenerId: gentle.id, status: 'ended', topic: 'Something happening at home',
      createdAt: now - 5 * D, acceptedAt: now - 5 * D + 60e3, endedAt: now - 5 * D + 40 * 60e3, escalated: false, escalationHandled: false, rating: 5,
      messages: [
        { id: newId('m'), from: 'system', body: 'GentleMoon, a trained peer listener, joined the chat.', at: now - 5 * D + 60e3 },
        { id: newId('m'), from: 'listener', body: 'Hi BraveLily, I’m GentleMoon. I’m here to listen. What’s on your mind?', at: now - 5 * D + 90e3 },
        { id: newId('m'), from: 'member', body: 'Things at home have been really tense. I don’t know who to talk to.', at: now - 5 * D + 150e3 },
        { id: newId('m'), from: 'listener', body: 'Thank you for telling me. You’re not alone. Would it help to make a simple safety plan together?', at: now - 5 * D + 210e3 },
        { id: newId('m'), from: 'system', body: 'BraveLily ended the conversation.', at: now - 5 * D + 40 * 60e3 }
      ]
    }];

    return {
      version: 1, createdAt: now,
      users, circles, memberships, posts, replies, reactions, reports, checkins, journal,
      safetyPlans: {}, alerts, alertConfirmations: [], notifications, mentors, mentorRequests: [],
      workshops, rsvps: [{ workshopId: 'w1', userId: lily.id }], questions, chats
    };
  }

  /* ---------------------------------------------------------------------------
     Public interface
     ------------------------------------------------------------------------- */
  window.Store = {
    // lists
    AVATARS, TOPICS, AREAS, ALERT_TYPES, HAPPENED, JOURNAL_TAGS, CHAT_TOPICS, MENTOR_FIELDS, RADII,
    // helpers
    dayKey, hasCrisisLanguage, onExternalChange, sha256,
    // accounts
    me, aliasAvailable, register, login, logout, recover, updateMe, changePassword, newRecoveryCode, deleteAccount,
    // community
    listCircles, getCircle, joinCircle, leaveCircle, feed, createPost, deletePost, listReplies, createReply, react, reportPost,
    listCheckins, checkIn, listJournal, addJournal, deleteJournal, listNotifications, markAllRead,
    // safety
    listAlerts, createAlert, confirmAlert, reportAlert, deleteAlert, getSafetyPlan, saveSafetyPlan,
    // support
    startChat, myChats, chatQueue, acceptChat, getChat, sendChatMessage, endChat, rateChat, escalateChat, heartbeat, listenerOnline,
    listMentors, requestMentor, listWorkshops, toggleRsvp, listQuestions, askQuestion,
    // moderators
    adminOverview, adminReports, resolveReport, adminCrisis, resolveCrisis, adminQuestions, answerQuestion, adminEscalations, resolveEscalation,
    // demo
    resetDemo
  };
})();
