// Safety alerts map (Leaflet + OpenStreetMap). The map library is in vendor/leaflet;
// the street tiles need internet. Without internet, pins still show on a plain background.
window.pageInit = function (user) {
  const { qs, qsa, esc, icon, timeAgo, agoLower, confirmed, toast, reportDialog, confirmBox, showError, ALERT_COLORS } = MIRA;
  let days = 7;
  let me = user;
  let picked = null; // { lat, lng, label }
  let map = null;
  let markersLayer = null;
  let pickMarker = null;
  const markerById = {};

  // ----- Form options -----
  qs('#type').innerHTML = Object.entries(Store.ALERT_TYPES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  qs('#happened').innerHTML = Store.HAPPENED.map((h) => `<option>${esc(h)}</option>`).join('');
  qs('#areaSelect').insertAdjacentHTML('beforeend', Store.AREAS.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join(''));
  qs('#radius').innerHTML = Store.RADII.map((r) => `<option value="${r}">Within ${r} km</option>`).join('');

  // ----- Map -----
  if (window.L) {
    map = L.map('map', { zoomControl: true, attributionControl: true }).setView([-26.17, 28.03], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    map.on('click', (e) => setPicked(e.latlng.lat, e.latlng.lng, 'Pinned on the map'));
  } else {
    qs('#map').innerHTML = '<div class="empty">The map couldn’t load. You can still report by choosing an area.</div>';
  }

  function setPicked(lat, lng, label) {
    picked = { lat, lng, label };
    qs('#pickStatus').className = 'pick-status set';
    qs('#pickStatus').innerHTML = `${icon('check-circle')} ${esc(label)}`;
    if (map) {
      if (pickMarker) map.removeLayer(pickMarker);
      pickMarker = L.circleMarker([lat, lng], { radius: 11, color: '#fff', weight: 3, fillColor: '#FF7A6B', fillOpacity: 1 }).addTo(map);
    }
  }

  qs('#useLocation').addEventListener('click', () => {
    const btn = qs('#useLocation');
    if (!navigator.geolocation) { toast('Your browser can’t share location. Please choose an area instead.', 'error'); return; }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.disabled = false;
      setPicked(pos.coords.latitude, pos.coords.longitude, 'Your current location (will be blurred)');
      if (map) map.setView([pos.coords.latitude, pos.coords.longitude], 15);
    }, () => {
      btn.disabled = false;
      toast('We couldn’t get your location. Tap the map or choose an area instead.', 'error');
    }, { enableHighAccuracy: false, timeout: 8000 });
  });

  qs('#areaSelect').addEventListener('change', (e) => {
    const a = Store.AREAS.find((x) => x.id === e.target.value);
    if (!a) return;
    setPicked(a.lat, a.lng, a.name);
    if (map) map.setView([a.lat, a.lng], 14);
  });

  // ----- Alerts list + markers -----
  function render() {
    const alerts = Store.listAlerts(days).filter((a) => !qs('#nearOnly').checked || a.nearMine);
    if (markersLayer) {
      markersLayer.clearLayers();
      alerts.forEach((a) => {
        const color = ALERT_COLORS[a.type] || '#6E6280';
        L.circle([a.lat, a.lng], { radius: 160, color, weight: 1, fillColor: color, fillOpacity: 0.15 }).addTo(markersLayer);
        const m = L.circleMarker([a.lat, a.lng], { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 })
          .bindPopup(`<b>${esc(a.typeLabel)}</b><br>${esc(a.place)}<br>${a.details ? esc(a.details) + '<br>' : ''}<small>${timeAgo(a.createdAt)} · ${confirmed(a.confirmations)}</small>`)
          .addTo(markersLayer);
        markerById[a.id] = m;
      });
    }
    qs('#alertList').innerHTML = alerts.length ? alerts.map((a) => `<div class="alert-item" id="${esc(a.id)}">
        <i class="dot" style="background:${ALERT_COLORS[a.type]}"></i>
        <div class="grow">
          <div class="row-between"><b>${esc(a.typeLabel)}</b>${a.nearMine ? `<span class="tag coral">${icon('map-pin')} Near you</span>` : ''}</div>
          <p>${esc(a.place)}${a.details ? ` · ${esc(a.details)}` : ''}</p>
          <small>${esc(a.happened)} · reported ${agoLower(a.createdAt)} · ${confirmed(a.confirmations)}</small>
          <div class="reacts" style="margin-top:8px">
            <button class="react" data-show="${esc(a.id)}">${icon('map-pin')} Show on map</button>
            ${a.mine ? `<button class="react subtle" data-delete="${esc(a.id)}">${icon('trash')} Remove</button>`
              : `<button class="react${a.confirmedByMe ? ' on' : ''}" data-confirm="${esc(a.id)}" ${a.confirmedByMe ? 'disabled' : ''}>${icon('hand-palm')} ${a.confirmedByMe ? 'You confirmed this' : 'This happened to me too'}</button>
                 <button class="react subtle push-right" data-report="${esc(a.id)}">${icon('flag')} Report</button>`}
          </div>
        </div></div>`).join('')
      : `<div class="empty">${icon('shield-check')}<h4>No alerts here</h4><p>Nothing reported for this time period${qs('#nearOnly').checked ? ' near your areas' : ''}.</p></div>`;
  }

  qs('#alertList').addEventListener('click', async (e) => {
    const show = e.target.closest('[data-show]');
    const confirmBtn = e.target.closest('[data-confirm]');
    const report = e.target.closest('[data-report]');
    const del = e.target.closest('[data-delete]');
    try {
      if (show && map) {
        const m = markerById[show.dataset.show];
        if (m) { map.setView(m.getLatLng(), 15); m.openPopup(); qs('.map-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
      if (confirmBtn) { Store.confirmAlert(confirmBtn.dataset.confirm); toast('Thank you. Confirmations help other women know an alert is real.'); render(); }
      if (report) reportDialog('alert', report.dataset.report);
      if (del && await confirmBox('Remove this alert?', 'It will disappear from the map for everyone.', 'Remove', true)) { Store.deleteAlert(del.dataset.delete); toast('Alert removed.'); render(); }
    } catch (err) { toast(err.message, 'error'); }
  });

  qsa('[data-days]').forEach((t) => t.addEventListener('click', () => {
    days = Number(t.dataset.days);
    qsa('[data-days]').forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t); });
    render();
  }));
  qs('#nearOnly').addEventListener('change', render);

  // ----- Report form -----
  qs('#reportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const errorBox = qs('#reportError');
    showError(errorBox, '');
    if (!picked) { showError(errorBox, 'Please tap the map, use your location or choose an area first.'); return; }
    try {
      const areaId = qs('#areaSelect').value;
      const { alert, reached } = Store.createAlert({
        type: qs('#type').value,
        place: qs('#place').value || (picked.label.startsWith('Pinned') || picked.label.startsWith('Your') ? '' : picked.label),
        lat: picked.lat, lng: picked.lng, areaId,
        happened: qs('#happened').value,
        details: qs('#details').value,
        notify: qs('#notify').checked
      });
      qs('#place').value = '';
      qs('#details').value = '';
      qs('#areaSelect').value = '';
      picked = null;
      if (pickMarker && map) { map.removeLayer(pickMarker); pickMarker = null; }
      qs('#pickStatus').className = 'pick-status';
      qs('#pickStatus').innerHTML = `${icon('map-pin')} No place chosen yet`;
      render();
      if (map && markerById[alert.id]) { map.setView([alert.lat, alert.lng], 15); markerById[alert.id].openPopup(); }
      toast(reached ? `Anonymous alert shared with ${reached} member${reached === 1 ? '' : 's'} who travel through this area.` : 'Your anonymous alert is now on the map.');
    } catch (err) { showError(errorBox, err.message); }
  });

  // ----- Alert settings -----
  function renderSettings() {
    qs('#nearbySetting').checked = me.settings.nearbyAlerts !== false;
    qs('#radius').value = String(me.settings.alertRadiusKm || 3);
    qs('#areaChips').innerHTML = Store.AREAS.map((a) => `<button type="button" class="chip${me.areas.includes(a.id) ? ' on' : ''}" data-area="${a.id}" aria-pressed="${me.areas.includes(a.id)}">${esc(a.name)}</button>`).join('');
  }
  qs('#nearbySetting').addEventListener('change', (e) => { me = Store.updateMe({ settings: { nearbyAlerts: e.target.checked } }); toast('Alert settings saved.'); });
  qs('#radius').addEventListener('change', (e) => { me = Store.updateMe({ settings: { alertRadiusKm: Number(e.target.value) } }); toast('Alert settings saved.'); render(); });
  qs('#areaChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (!b) return;
    const set = new Set(me.areas);
    if (set.has(b.dataset.area)) set.delete(b.dataset.area); else set.add(b.dataset.area);
    me = Store.updateMe({ areas: [...set] });
    renderSettings();
    render();
  });

  renderSettings();
  render();

  // Open a specific alert from a notification link (#a_…)
  if (location.hash.length > 1) {
    const hashId = decodeURIComponent(location.hash.slice(1));
    const el = document.getElementById(hashId);
    if (el && el.classList.contains('alert-item')) {
      if (map && markerById[hashId]) { map.setView(markerById[hashId].getLatLng(), 15); markerById[hashId].openPopup(); }
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 3000);
    }
  }
};
