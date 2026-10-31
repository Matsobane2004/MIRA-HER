// Health & body: topics, private cycle tracker, anonymous nurse questions
window.pageInit = function (user) {
  const { qs, esc, icon, toast, timeAgo, agoLower } = MIRA;

  const TOPICS = [
    { icon: 'drop', title: 'Your menstrual cycle', sub: 'What’s normal and what isn’t', body: `
      <p>A typical cycle is 21 to 35 days long, and a period usually lasts 2 to 7 days. Stress, illness, weight changes and some contraceptives can change your cycle.</p>
      <ul><li>Track your cycle so you notice changes early.</li><li>Change pads every 4 to 6 hours, and tampons at least every 8 hours.</li><li>Many schools and clinics give out free sanitary pads.</li></ul>
      <div class="see-doc">${icon('first-aid-kit')}<span>Visit a clinic if your period stops for 3 months and you’re not pregnant, if you soak a pad every hour, or if you bleed between periods.</span></div>` },
    { icon: 'heartbeat', title: 'Period pain, PCOS and endometriosis', sub: 'When pain is more than “normal”', body: `
      <p>Some cramping is common, but pain that stops you from going to school or work is not something you should just live with.</p>
      <ul><li><b>Endometriosis</b> can cause severe period pain, pain during sex and difficulty getting pregnant.</li><li><b>PCOS</b> can cause irregular periods, acne, extra hair growth and weight changes.</li><li>Both are common and manageable, but they often take years to be diagnosed. Keeping a pain diary helps.</li></ul>
      <div class="see-doc">${icon('first-aid-kit')}<span>If painkillers don’t help, ask your clinic or doctor about further tests or a referral. You have the right to be taken seriously.</span></div>` },
    { icon: 'pill', title: 'Contraception', sub: 'Free options at public clinics', body: `
      <p>Public clinics in South Africa provide contraception free of charge, and you don’t need a partner’s permission.</p>
      <ul><li><b>Short-term:</b> the pill, the injection and condoms.</li><li><b>Long-acting:</b> the implant and the IUD (loop). They last for years and can be removed at any time.</li><li><b>Emergency contraception</b> works best when taken as soon as possible after unprotected sex.</li><li>Only condoms also protect against HIV and other STIs.</li></ul>` },
    { icon: 'baby', title: 'Pregnancy and antenatal care', sub: 'Healthy mom, healthy baby', body: `
      <ul><li>Book your first antenatal visit as early as you can once you know you’re pregnant. Antenatal care is free at public clinics.</li><li>Ask about folic acid early on to support your baby’s development.</li><li>Termination of pregnancy is legal in South Africa and available free at designated public facilities.</li></ul>
      <div class="see-doc">${icon('siren')}<span>Go to a clinic or hospital urgently for heavy bleeding, a severe headache, blurred vision, or if your baby stops moving.</span></div>` },
    { icon: 'test-tube', title: 'STIs and HIV', sub: 'Testing, PrEP and PEP', body: `
      <ul><li>HIV and STI testing is free and confidential at public clinics.</li><li><b>PrEP</b> is a daily pill that helps prevent HIV. It’s available free at many clinics.</li><li><b>PEP</b> can prevent HIV after a possible exposure, but it must be started within 72 hours.</li><li>Many STIs have no symptoms, so regular testing matters.</li></ul>` },
    { icon: 'flower-lotus', title: 'Cervical and breast health', sub: 'Screening that saves lives', body: `
      <ul><li>A Pap smear checks for early changes that could lead to cervical cancer. It’s free at public clinics.</li><li>The HPV vaccine, which protects against cervical cancer, is offered free to girls at primary school.</li><li>Check your breasts once a month for lumps, dimpling or changes to your nipples.</li></ul>
      <div class="see-doc">${icon('first-aid-kit')}<span>Ask your clinic how often you should be screened for your age.</span></div>` }
  ];
  let current = 0;

  function renderTopics() {
    qs('#topics').innerHTML = TOPICS.map((t, i) => `<button class="card topic${i === current ? ' on' : ''}" data-topic="${i}" aria-pressed="${i === current}"><div class="tile-icon${i % 2 ? ' coral' : ''}">${icon(t.icon)}</div><h3>${t.title}</h3><p>${t.sub}</p></button>`).join('');
    const t = TOPICS[current];
    qs('#topicDetail').innerHTML = `<h3>${icon(t.icon)} ${t.title}</h3>${t.body}<p class="hint mt-16">General information, not a diagnosis. Visit your nearest clinic for personal advice.</p>`;
  }
  qs('#topics').addEventListener('click', (e) => {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    current = Number(b.dataset.topic);
    renderTopics();
    if (window.innerWidth < 900) qs('#topicDetail').scrollIntoView({ behavior: 'smooth' });
  });
  renderTopics();

  // ----- Cycle tracker (kept only in this browser, never shared) -----
  const KEY = `miraher.cycle.${user.id}`;
  const DAY = 864e5;
  const fmt = (d) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' });
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  function showCycle(last, cycle, periodLen) {
    let start = startOfDay(last);
    const today = startOfDay(new Date());
    while (start.getTime() + cycle * DAY <= today.getTime()) start = new Date(start.getTime() + cycle * DAY);
    const next = new Date(start.getTime() + cycle * DAY);
    const ovulation = new Date(next.getTime() - 14 * DAY);
    const fertileStart = new Date(ovulation.getTime() - 5 * DAY);
    const fertileEnd = new Date(ovulation.getTime() + DAY);
    const daysToNext = Math.round((next - today) / DAY);
    const cells = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(today.getTime() + i * DAY);
      const sinceStart = Math.round((d - start) / DAY);
      const sinceNext = Math.round((d - next) / DAY);
      const isPeriod = (sinceStart >= 0 && sinceStart < periodLen) || (sinceNext >= 0 && sinceNext < periodLen);
      const isFertile = d >= fertileStart && d <= fertileEnd;
      cells.push(`<div class="${isPeriod ? 'period' : isFertile ? 'fertile' : ''}${i === 0 ? ' today' : ''}" title="${fmt(d)}">${d.getDate()}</div>`);
    }
    qs('#cycleResult').innerHTML = `<div class="cycle-result">
      Your next period should start around <b>${fmt(next)}</b> (${daysToNext === 0 ? 'today' : `in ${daysToNext} day${daysToNext === 1 ? '' : 's'}`}).<br>
      Most fertile days: <b>${fmt(fertileStart)} to ${fmt(fertileEnd)}</b>.
      <div class="cycle-days" aria-label="Next 35 days">${cells.join('')}</div>
      <div class="legend" style="margin:10px 0 0"><span><i class="dot" style="background:var(--coral)"></i> Expected period</span><span><i class="dot" style="background:var(--lav-2)"></i> Fertile window</span><span><i class="dot" style="border:2px solid var(--purple)"></i> Today</span></div>
    </div>`;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      qs('#lastPeriod').value = saved.last;
      qs('#cycleLength').value = saved.cycle;
      qs('#periodLength').value = saved.periodLen;
      showCycle(new Date(saved.last), saved.cycle, saved.periodLen);
    }
  } catch { /* ignore */ }

  qs('#cycleForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const last = qs('#lastPeriod').value;
    const cycle = Number(qs('#cycleLength').value);
    const periodLen = Number(qs('#periodLength').value);
    if (!last) { toast('Please choose the first day of your last period.', 'error'); return; }
    if (new Date(last) > new Date()) { toast('That date is in the future.', 'error'); return; }
    if (!(cycle >= 20 && cycle <= 45)) { toast('Cycle length should be between 20 and 45 days.', 'error'); return; }
    if (!(periodLen >= 2 && periodLen <= 10)) { toast('Period length should be between 2 and 10 days.', 'error'); return; }
    try { localStorage.setItem(KEY, JSON.stringify({ last, cycle, periodLen })); } catch { /* ignore */ }
    showCycle(new Date(last), cycle, periodLen);
  });

  // ----- Ask a nurse -----
  function renderQuestions() {
    const { answered, mine } = Store.listQuestions();
    const qa = (q, showStatus) => `<div class="qa"><div class="q">${icon('question')}<span>${esc(q.body)}</span></div>
      ${q.answer ? `<div class="a">${esc(q.answer)}</div><small>${icon('seal-check')} ${esc(q.answeredBy)} · ${timeAgo(q.answeredAt)}</small>`
        : showStatus ? `<small><span class="tag amber">${icon('hourglass')} Waiting for a nurse</span> · asked ${agoLower(q.createdAt)}</small>` : ''}</div>`;
    qs('#myQuestions').innerHTML = mine.length ? mine.map((q) => qa(q, true)).join('') : '<p class="muted small">You haven’t asked anything yet.</p>';
    qs('#answered').innerHTML = answered.length ? answered.map((q) => qa(q, false)).join('') : '<p class="muted small">No answered questions yet.</p>';
  }
  qs('#askForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      Store.askQuestion(qs('#question').value);
      qs('#question').value = '';
      renderQuestions();
      toast('Your question was sent anonymously. A nurse will reply soon.');
    } catch (err) { toast(err.message, 'error'); }
  });
  renderQuestions();
  if (location.hash === '#my-questions') qs('#my-questions').scrollIntoView();
};
