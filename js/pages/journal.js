// Private journal and mood chart
window.pageInit = function () {
  const { qs, esc, icon, toast, confirmBox, MOODS, text } = MIRA;
  const selected = new Set();
  const PROMPTS = [
    'One thing that went better than I expected today was…',
    'Something I need to let go of is…',
    'A person who makes me feel safe is… because…',
    'If my best friend felt like I do right now, I would tell her…',
    'Three small things I’m grateful for are…'
  ];

  qs('#todayLabel').textContent = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function renderTags() {
    qs('#tagChips').innerHTML = Store.JOURNAL_TAGS.map((t) => `<button type="button" class="chip${selected.has(t) ? ' on' : ''}" data-tag="${t}" aria-pressed="${selected.has(t)}">${esc(t)}</button>`).join('');
  }
  qs('#tagChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    if (selected.has(b.dataset.tag)) selected.delete(b.dataset.tag); else selected.add(b.dataset.tag);
    renderTags();
  });

  const textarea = qs('#entryText');
  textarea.addEventListener('input', () => { qs('#entryCount').textContent = `${textarea.value.length} / 5000`; });

  qs('#prompts').innerHTML = PROMPTS.map((p) => `<button type="button" class="list-row" style="width:100%;text-align:left" data-prompt="${esc(p)}"><span>${esc(p)}</span>${icon('arrow-right')}</button>`).join('');
  qs('#prompts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-prompt]');
    if (!b) return;
    textarea.value = (textarea.value ? textarea.value + '\n\n' : '') + b.dataset.prompt + ' ';
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  });

  function renderEntries() {
    const entries = Store.listJournal();
    qs('#entries').innerHTML = entries.length ? entries.map((en) => `<article class="entry">
        <div class="row-between"><span class="muted small">${new Date(en.createdAt).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <button class="icon-btn subtle" data-delete="${esc(en.id)}" aria-label="Delete entry" title="Delete entry">${icon('trash')}</button></div>
        ${en.tags.length ? `<div class="chips mb-8">${en.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <p>${text(en.body)}</p></article>`).join('')
      : `<div class="card empty">${icon('notebook')}<h4>No entries yet</h4><p>Your first entry can be just one sentence.</p></div>`;
  }
  qs('#entries').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-delete]');
    if (!b) return;
    if (await confirmBox('Delete this entry?', 'It will be gone for good.', 'Delete', true)) {
      Store.deleteJournal(b.dataset.delete);
      renderEntries();
      toast('Entry deleted.');
    }
  });

  qs('#entryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      Store.addJournal({ body: textarea.value, tags: [...selected] });
      textarea.value = '';
      selected.clear();
      renderTags();
      qs('#entryCount').textContent = '0 / 5000';
      renderEntries();
      toast('Saved privately.');
    } catch (err) { toast(err.message, 'error'); }
  });

  function renderChart() {
    const checkins = Store.listCheckins();
    const byDay = Object.fromEntries(checkins.map((c) => [c.day, c.mood]));
    const bars = [];
    for (let i = 29; i >= 0; i--) {
      const day = Store.dayKey(Date.now() - i * 864e5);
      const mood = byDay[day];
      const m = MOODS[(mood || 1) - 1];
      bars.push(mood
        ? `<div class="bar" style="height:${mood * 20}%;background:${m.color}" title="${day}: ${m.label}"></div>`
        : `<div class="bar empty" title="${day}: no check-in"></div>`);
    }
    qs('#moodChart').innerHTML = bars.join('');
    if (!checkins.length) { qs('#moodSummary').textContent = 'Check in on your home page to see your mood over time.'; return; }
    const counts = {};
    checkins.forEach((c) => { counts[c.mood] = (counts[c.mood] || 0) + 1; });
    const common = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    const recent = checkins.slice(-7);
    const earlier = checkins.slice(0, -7);
    const avg = (list) => list.reduce((s, c) => s + c.mood, 0) / (list.length || 1);
    const trend = earlier.length && recent.length ? (avg(recent) > avg(earlier) + 0.3 ? ' Your recent days look brighter than before.' : avg(recent) < avg(earlier) - 0.3 ? ' The last week has been harder. Be gentle with yourself, and reach out if you need to.' : '') : '';
    qs('#moodSummary').textContent = `You checked in ${checkins.length} time${checkins.length === 1 ? '' : 's'} this month. Your most common mood was “${MOODS[common - 1].label}”.${trend}`;
  }

  renderTags();
  renderEntries();
  renderChart();
};
