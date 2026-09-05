const $ = id => document.getElementById(id);
const AVATAR_COLORS = ['#A81C2C','#1B3E73','#3F7D4C','#B87313','#6D4AA8','#1C7B8C'];
const CHART_COLORS = ['#A81C2C','#1B3E73','#3F7D4C','#D98A1D','#6D4AA8','#1C7B8C','#C2185B','#00796B'];
const AYUSH_SPECS = ['Ayurvedic Physician','Panchakarma Specialist','Kayachikitsa','Yoga & Naturopathy'];

let hospital = null;
let doctors = [];
let kiosks = [];
let editingId = null;
let currentSlots = [];
let analyticsChart = null;

function initials(name){
  const parts = (name||'').replace(/^Dr\.?\s*/i,'').split(' ').filter(Boolean);
  return ((parts[0]?.[0]||'') + (parts[1]?.[0]||'')).toUpperCase() || '?';
}
function colorFor(id){ return AVATAR_COLORS[(Number(id)||0) % AVATAR_COLORS.length]; }
function isAyushSpec(spec){ return AYUSH_SPECS.includes(spec); }

function showToast(msg, icon){
  const t = $('toast');
  if (!t) return;
  t.innerHTML = `${icon||'✓'} <span>${msg}</span>`;
  t.classList.add('show');
  clearTimeout(showToast._h);
  showToast._h = setTimeout(()=> t.classList.remove('show'), 2600);
}

async function api(url, opts={}){
  const resp = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function openOverlay(id){ const el = $(id); if (el) el.classList.add('open'); }
function closeOverlay(id){ const el = $(id); if (el) el.classList.remove('open'); }

async function boot(){
  try {
    const { hospital: h } = await api('/api/auth/me');
    if (!h) throw new Error('Not logged in');
    hospital = h;
  } catch(e){
    console.warn('Authentication check failed:', e.message);
    window.location.href = '/login';
    return;
  }

  if ($('loadingScreen')) $('loadingScreen').style.display = 'none';
  if ($('topbar')) $('topbar').style.display = 'flex';
  if ($('mainContent')) $('mainContent').style.display = 'block';

  if ($('adminEmail')) $('adminEmail').textContent = hospital.email || hospital.login_email || '—';
  if ($('adminAvatar')) $('adminAvatar').textContent = initials(hospital.name) || 'H';

  try {
    await Promise.all([loadDoctors(), loadKiosks()]);
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }

  renderAll();
}

async function loadDoctors(){
  try {
    const d = await api('/api/doctors');
    doctors = d.doctors || [];
  } catch (e) {
    doctors = [];
    console.error(e);
  }
}

async function loadKiosks(){
  try {
    const d = await api('/api/kiosks');
    kiosks = d.kiosks || [];
  } catch (e) {
    kiosks = [];
    console.error(e);
  }
}

function renderAll(){
  renderHeader();
  renderStats();
  renderDoctors();
  renderKiosks();
  renderProfileForm();
}

function renderHeader(){
  if ($('hospNameHeader')) $('hospNameHeader').textContent = hospital.name;
  if ($('ayushSwitch')) $('ayushSwitch').checked = !!(hospital.ayush || hospital.ayush_mode_enabled);
}

function renderStats(){
  const statsEl = $('statsRow');
  if (!statsEl) return;
  const total = doctors.length;
  const onDuty = doctors.filter(d=>d.status==='Available').length;
  const totalPatients = doctors.reduce((s,d)=> s + (Number(d.patients_seen)||0), 0);
  statsEl.innerHTML = `
    <div class="stat-card"><div class="label">Total doctors</div><div class="value">${total}</div></div>
    <div class="stat-card"><div class="label">Available today</div><div class="value">${onDuty}</div></div>
    <div class="stat-card"><div class="label">Kiosks registered</div><div class="value">${kiosks.length}</div></div>
    <div class="stat-card"><div class="label">Total patients seen</div><div class="value">${totalPatients}</div></div>
  `;
}

function renderDoctors(){
  const list = $('doctorList');
  if (!list) return;
  const q = ($('searchInput')?.value || '').toLowerCase().trim();
  const filtered = doctors.filter(d =>
    !q || (d.name||'').toLowerCase().includes(q) || (d.gov_id||d.government_doctor_id||'').toLowerCase().includes(q) || (d.specialization||'').toLowerCase().includes(q)
  );
  if (filtered.length === 0){
    list.innerHTML = `<div class="empty-state">
      <div style="font-weight:600; margin-bottom:4px;">${doctors.length === 0 ? 'No doctors yet' : 'No matches'}</div>
      <div>${doctors.length === 0 ? 'Upload an Excel sheet or add a doctor manually to get started.' : 'Try a different search term.'}</div>
    </div>`;
    return;
  }
  list.innerHTML = filtered.map(d => {
    const docId = d.id || d.doctor_id;
    const govId = d.gov_id || d.government_doctor_id || '';
    return `
    <div class="doctor-card" onclick="openEdit(${docId})">
      <div class="doctor-top">
        <div class="doc-avatar" style="background:${colorFor(docId)}">${initials(d.name)}</div>
        <div class="doc-info">
          <div class="doc-name">${d.name}</div>
          <div class="doc-spec">${d.specialization || 'Specialisation not set'}</div>
          <div class="doc-govid">Gov ID: ${govId}</div>
        </div>
        <div class="status-pill ${d.status==='Available' ? 'status-available':'status-leave'}">${d.status || 'Available'}</div>
      </div>
      ${isAyushSpec(d.specialization) ? '<div class="ayush-tag">🌿 Ayurveda</div>' : ''}
      <div class="doc-meta">
        <div class="chip rating-chip">★ ${Number(d.rating||0).toFixed(1)}</div>
        <div class="chip">${d.patients_seen||0} patients seen</div>
        <div class="chip">${(d.slots||[]).length} slot${(d.slots||[]).length===1?'':'s'}</div>
        <div class="chip">${d.leaves_used||0}/${d.leaves_allotted||0} leaves used</div>
      </div>
      ${d.review ? `<div class="doc-review">"${d.review}"</div>` : ''}
    </div>
  `}).join('');
}

function renderKiosks(){
  const list = $('kioskList');
  if (!list) return;
  const hospId = hospital?.id || hospital?.hospital_id || '';
  list.innerHTML = kiosks.map(k => {
    const kioskId = k.id || k.kiosk_id;
    const code = k.kiosk_code || `H${hospId}-K${String(k.kiosk_number).padStart(3, '0')}`;
    return `
    <div class="kiosk-card">
      <div class="kc-top">
        <div class="kc-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="14" rx="2" stroke="#1B3E73" stroke-width="1.7"/><path d="M9 21h6M12 17v4" stroke="#1B3E73" stroke-width="1.7" stroke-linecap="round"/></svg></div>
        <div>
          <div class="kc-num">Kiosk ${k.kiosk_number}</div>
          <div class="kc-loc">${k.location || k.location_description || 'No location set'}</div>
        </div>
      </div>
      <div class="kc-code-box">
        <div class="kc-code-info">
          <span class="kc-code-label">Kiosk Code</span>
          <span class="kc-code-val">${code}</span>
        </div>
        <button type="button" class="btn-copy-code" onclick="navigator.clipboard.writeText('${code}'); showToast('Kiosk code copied', '📋');" title="Copy code">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%; color:#A81C2C;" onclick="removeKiosk(${kioskId})">Remove kiosk</button>
    </div>
  `}).join('') + `
    <div class="add-kiosk-card">
      <div class="title">Register new kiosk(s)</div>
      <div class="row">
        <input id="newKioskCount" type="number" min="1" max="50" value="1" title="How many kiosks">
        <input id="newKioskLocation" type="text" placeholder="Location, e.g. Main lobby">
      </div>
      <div style="font-size:11px; color:var(--muted);">Each one gets its own unique ID automatically — you don't type it.</div>
      <button class="btn btn-primary btn-sm" style="width:100%;" id="addKioskBtn">Add kiosk(s)</button>
    </div>
  `;
  $('addKioskBtn')?.addEventListener('click', addKiosk);
}

function renderProfileForm(){
  if ($('hospName')) $('hospName').value = hospital.name || '';
  if ($('hospAddress')) $('hospAddress').value = hospital.address || '';
  if ($('hospPhone')) $('hospPhone').value = hospital.phone || '';
  if ($('hospEmail')) $('hospEmail').value = hospital.email || hospital.login_email || '';
  if ($('lastSyncText')) {
    $('lastSyncText').textContent = hospital.last_synced_at
      ? `Last pushed: ${new Date(hospital.last_synced_at).toLocaleString()} · ${doctors.length} doctors · ${kiosks.length} kiosks`
      : 'Not yet synced';
  }
}

$('searchInput')?.addEventListener('input', renderDoctors);

$('ayushSwitch')?.addEventListener('change', async (e)=>{
  const val = e.target.checked;
  try {
    const { hospital: h } = await api('/api/hospital', { method:'PUT', body: JSON.stringify({ name:hospital.name, address:hospital.address, phone:hospital.phone, ayush:val }) });
    hospital = h;
    showToast(val ? 'Hospital listed as AYUSH / Ayurvedic ✓' : 'AYUSH listing turned off', val ? '🌿' : '↩');
  } catch(e){ e.target.checked = !val; showToast(e.message, '⚠️'); }
});

$('settingsBtn')?.addEventListener('click', ()=>{ renderProfileForm(); openOverlay('profileOverlay'); });
$('profileCloseBtn')?.addEventListener('click', ()=> closeOverlay('profileOverlay'));
$('cancelProfileBtn')?.addEventListener('click', ()=> closeOverlay('profileOverlay'));
$('profileOverlay')?.addEventListener('click', e => { if (e.target.id === 'profileOverlay') closeOverlay('profileOverlay'); });
$('saveProfileBtn')?.addEventListener('click', async ()=>{
  try {
    const { hospital: h } = await api('/api/hospital', { method:'PUT', body: JSON.stringify({
      name: $('hospName').value.trim() || hospital.name,
      address: $('hospAddress').value.trim(),
      phone: $('hospPhone').value.trim(),
      ayush: hospital.ayush
    })});
    hospital = h;
    renderAll();
    closeOverlay('profileOverlay');
    showToast('Hospital profile saved', '✓');
  } catch(e){ showToast(e.message, '⚠️'); }
});

function renderSlots(){
  const slotsEl = $('slotsEditor');
  if (!slotsEl) return;
  slotsEl.innerHTML = currentSlots.map((s,i) => `
    <span class="slot-chip">${s}<button type="button" onclick="removeSlot(${i})">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    </button></span>
  `).join('') || '<span style="font-size:12.5px; color:var(--muted);">No slots added yet.</span>';
}
window.removeSlot = function(i){ currentSlots.splice(i,1); renderSlots(); };

$('addSlotBtn')?.addEventListener('click', ()=>{
  const v = $('slotInput')?.value.trim();
  if (!v) return;
  currentSlots.push(v);
  $('slotInput').value = '';
  renderSlots();
});
$('slotInput')?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('addSlotBtn')?.click(); } });

function openModal(){ openOverlay('modalOverlay'); }
function closeModal(){ closeOverlay('modalOverlay'); }

$('addDoctorBtn')?.addEventListener('click', ()=>{
  editingId = null;
  currentSlots = [];
  if ($('modalTitle')) $('modalTitle').textContent = 'Add doctor';
  if ($('deleteDocBtn')) $('deleteDocBtn').style.display = 'none';
  if ($('docGovId')) $('docGovId').value = '';
  if ($('docName')) $('docName').value = '';
  if ($('docSpec')) $('docSpec').value = 'General Medicine';
  if ($('docStatus')) $('docStatus').value = 'Available';
  if ($('docRating')) $('docRating').value = 0;
  if ($('docPatientsSeen')) $('docPatientsSeen').value = 0;
  if ($('docLeavesAllotted')) $('docLeavesAllotted').value = 12;
  if ($('docLeavesUsed')) $('docLeavesUsed').value = 0;
  if ($('docReview')) $('docReview').value = '';
  renderSlots();
  openModal();
});

function openEdit(id){
  const d = doctors.find(x=>(x.id===id || x.doctor_id===id));
  if (!d) return;
  editingId = id;
  currentSlots = [...(d.slots||[])];
  if ($('modalTitle')) $('modalTitle').textContent = 'Edit doctor';
  if ($('deleteDocBtn')) $('deleteDocBtn').style.display = '';
  if ($('docGovId')) $('docGovId').value = d.gov_id || d.government_doctor_id || '';
  if ($('docName')) $('docName').value = d.name || '';
  if ($('docSpec')) $('docSpec').value = d.specialization || 'General Medicine';
  if ($('docStatus')) $('docStatus').value = d.status || 'Available';
  if ($('docRating')) $('docRating').value = d.rating || 0;
  if ($('docPatientsSeen')) $('docPatientsSeen').value = d.patients_seen || 0;
  if ($('docLeavesAllotted')) $('docLeavesAllotted').value = d.leaves_allotted || 0;
  if ($('docLeavesUsed')) $('docLeavesUsed').value = d.leaves_used || 0;
  if ($('docReview')) $('docReview').value = d.review || '';
  renderSlots();
  openModal();
}
window.openEdit = openEdit;

$('modalCloseBtn')?.addEventListener('click', closeModal);
$('cancelModalBtn')?.addEventListener('click', closeModal);
$('modalOverlay')?.addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });

$('saveDocBtn')?.addEventListener('click', async ()=>{
  const govId = $('docGovId')?.value.trim();
  const name = $('docName')?.value.trim();
  if (!govId){ showToast("Please enter the doctor's government ID", '⚠️'); return; }
  if (!name){ showToast("Please enter the doctor's name", '⚠️'); return; }

  const payload = {
    gov_id: govId, name,
    specialization: $('docSpec')?.value,
    status: $('docStatus')?.value,
    rating: $('docRating')?.value,
    review: $('docReview')?.value.trim(),
    slots: currentSlots,
    patients_seen: $('docPatientsSeen')?.value,
    leaves_allotted: $('docLeavesAllotted')?.value,
    leaves_used: $('docLeavesUsed')?.value
  };
  try {
    if (editingId) {
      await api(`/api/doctors/${editingId}`, { method:'PUT', body: JSON.stringify(payload) });
      showToast(`${name}'s details updated`, '✓');
    } else {
      await api('/api/doctors', { method:'POST', body: JSON.stringify(payload) });
      showToast(`${name} added to your hospital`, '✓');
    }
    await loadDoctors();
    closeModal();
    renderAll();
  } catch (e){ showToast(e.message, '⚠️'); }
});

let pendingDeleteId = null;
$('deleteDocBtn')?.addEventListener('click', ()=>{
  const d = doctors.find(x=>(x.id===editingId || x.doctor_id===editingId));
  if (!d) return;
  pendingDeleteId = editingId;
  if ($('confirmText')) $('confirmText').textContent = `This will remove ${d.name} (${d.gov_id || d.government_doctor_id}) from your hospital roster.`;
  openOverlay('confirmOverlay');
});
$('confirmCancelBtn')?.addEventListener('click', ()=>{ pendingDeleteId = null; closeOverlay('confirmOverlay'); });
$('confirmOverlay')?.addEventListener('click', e => { if (e.target.id === 'confirmOverlay'){ pendingDeleteId = null; closeOverlay('confirmOverlay'); } });
$('confirmDeleteBtn')?.addEventListener('click', async ()=>{
  if (!pendingDeleteId) return;
  const d = doctors.find(x=>(x.id===pendingDeleteId || x.doctor_id===pendingDeleteId));
  try {
    await api(`/api/doctors/${pendingDeleteId}`, { method:'DELETE' });
    await loadDoctors();
    closeOverlay('confirmOverlay');
    closeModal();
    renderAll();
    showToast(`${d.name} removed`, '🗑️');
  } catch(e){ showToast(e.message, '⚠️'); }
  pendingDeleteId = null;
});

async function addKiosk(){
  const count = Math.max(1, Math.min(50, parseInt($('newKioskCount')?.value, 10) || 1));
  const location = $('newKioskLocation')?.value.trim();
  try {
    const { kiosks: created } = await api('/api/kiosks', { method:'POST', body: JSON.stringify({ count, location }) });
    await loadKiosks();
    renderAll();
    const codes = (created || []).map(k => k.kiosk_code).filter(Boolean).join(', ');
    showToast(codes ? `Registered! Code: ${codes}` : `${created.length} kiosk(s) registered`, '🖥️');
  } catch(e){ showToast(e.message, '⚠️'); }
}
window.removeKiosk = async function(id){
  try {
    await api(`/api/kiosks/${id}`, { method:'DELETE' });
    await loadKiosks();
    renderAll();
    showToast('Kiosk removed', '🗑️');
  } catch(e){ showToast(e.message, '⚠️'); }
};

$('pushKioskBtn')?.addEventListener('click', async ()=>{
  try {
    const data = await api('/api/hospital/sync', { method:'POST' });
    hospital.last_synced_at = data.last_synced_at;
    renderAll();
    showToast(`Pushed ${data.doctorCount} doctors to ${data.kioskCount} kiosk(s)`, '📡');
  } catch(e){ showToast(e.message, '⚠️'); }
});

$('uploadExcelBtn')?.addEventListener('click', ()=>{
  if ($('importResult')) $('importResult').className = 'import-result';
  openOverlay('importOverlay');
});
$('importCloseBtn')?.addEventListener('click', ()=> closeOverlay('importOverlay'));
$('importOverlay')?.addEventListener('click', e => { if (e.target.id === 'importOverlay') closeOverlay('importOverlay'); });

const dropzone = $('dropzone');
if (dropzone) {
  dropzone.addEventListener('click', ()=> $('fileInput')?.click());
  ['dragover','dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', e => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
}
$('fileInput')?.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

async function handleFile(file){
  if ($('dzTitle')) $('dzTitle').textContent = `Uploading ${file.name}…`;
  const fd = new FormData();
  fd.append('file', file);
  const resultEl = $('importResult');
  if (resultEl) resultEl.className = 'import-result';
  try {
    const resp = await fetch('/api/doctors/import', { method:'POST', body: fd });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Import failed.');
    doctors = data.doctors || [];
    if (resultEl) {
      resultEl.classList.add('ok');
      resultEl.textContent = `Imported ${data.imported} doctor${data.imported===1?'':'s'} from "${file.name}".` +
        (data.skipped?.length ? ` Skipped ${data.skipped.length} row(s) (missing Gov ID/Name, or a duplicate Gov ID) — row(s) ${data.skipped.join(', ')}.` : '');
    }
    showToast(`${data.imported} doctors imported`, '📥');
    renderAll();
  } catch (err){
    if (resultEl) {
      resultEl.classList.add('err');
      resultEl.textContent = err.message;
    }
  } finally {
    if ($('dzTitle')) $('dzTitle').textContent = 'Drag your .xlsx file here, or click to browse';
    if ($('fileInput')) $('fileInput').value = '';
  }
}
$('downloadTemplateBtn')?.addEventListener('click', ()=>{ window.location.href = '/api/doctors/template'; });

$('openAnalyticsBtn')?.addEventListener('click', async ()=>{
  openOverlay('analyticsOverlay');
  await loadAnalytics();
});
$('closeAnalyticsBtn')?.addEventListener('click', ()=> closeOverlay('analyticsOverlay'));
$('rangeSelect')?.addEventListener('change', loadAnalytics);

async function loadAnalytics(){
  const days = $('rangeSelect')?.value || 14;
  try {
    const { dates, series } = await api(`/api/analytics/daily?days=${days}`);
    renderChart(dates, series);
    await loadVisitsTable(days);
  } catch(e){ showToast(e.message, '⚠️'); }
}

function renderChart(dates, series){
  if (typeof Chart === 'undefined'){
    console.error('Chart.js did not load');
    return;
  }
  const canvas = $('analyticsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = (dates||[]).map(d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric' }));
  const datasets = (series||[]).map((s,i) => ({
    label: s.name,
    data: s.counts,
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
    borderRadius: 4,
    stack: 'patients'
  }));
  if (analyticsChart) analyticsChart.destroy();
  analyticsChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            footer: (items) => {
              const total = items.reduce((s,it)=> s + it.parsed.y, 0);
              return `Total that day: ${total}`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display:false } },
        y: { stacked: true, beginAtZero: true, title: { display:true, text:'Patients seen' } }
      }
    }
  });
}

async function loadVisitsTable(days){
  const tableBody = $('visitsTableBody');
  if (!tableBody) return;
  try {
    const { visits } = await api(`/api/analytics/visits?days=${days}`);
    tableBody.innerHTML = visits && visits.length ? visits.map(v => `
      <tr><td>${v.visit_date}</td><td>${v.doctor_name}</td><td>${v.count || 1}</td></tr>
    `).join('') : '<tr><td colspan="3" style="color:var(--muted); text-align:center; padding:16px;">No visit data found for this time period.</td></tr>';
  } catch (e) {
    tableBody.innerHTML = '<tr><td colspan="3" style="color:var(--muted); text-align:center; padding:16px;">No visit data available.</td></tr>';
  }
}

$('logoutBtn')?.addEventListener('click', async ()=>{
  await api('/api/auth/logout', { method:'POST' });
  window.location.href = '/login';
});

// Run boot on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
