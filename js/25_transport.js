/**
 * SCMS v11 — 25_transport.js
 * Bus routes + per-student pickup/dropoff assignment.
 *
 * Same conventions as Library/Admissions/Billing: single modal body
 * (#routeDetailBody) swapped in place, module-level cache instead of
 * JSON-in-onclick, stale-while-revalidate list loading.
 *
 * Web only for now — no n8n/Telegram equivalent yet.
 */

'use strict';

let _transportRoutesAll  = [];
let _transportLoadedOnce = false;
let _transportRouteCache = null; // the currently-open route, for edit/assign views

async function renderTransport() {
  const listEl = document.getElementById('transportList');
  if (_transportLoadedOnce) {
    _renderTransportList();
  } else if (listEl) {
    listEl.innerHTML = skeletonCards(2);
  }

  try {
    _transportRoutesAll = await API.getRoutes();
    _transportLoadedOnce = true;
  } catch (e) {
    if (!_transportLoadedOnce && listEl) listEl.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  _renderTransportList();
}

function _renderTransportList() {
  const el = document.getElementById('transportList');
  if (!el) return;

  if (!_transportRoutesAll.length) {
    el.innerHTML = `<div class="empty-state">No routes yet — tap + to add one.</div>`;
    return;
  }

  el.innerHTML = _transportRoutesAll.map(r => `
    <div class="list-card" onclick="openRouteDetail(${r.id})">
      <div class="card-row">
        <div class="card-info">
          <div class="card-name">${esc(r.route_name)}</div>
          <div class="card-sub">${esc(r.driver_name || 'No driver set')} ${r.driver_phone ? '· ' + esc(r.driver_phone) : ''}</div>
        </div>
        <div class="card-actions">
          <span class="adm-status-badge adm-status-accepted">${esc(String(r.student_count))} 🧑‍🎓</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ─── New route ──────────────────────────────────────────────────────── */

window.openNewRouteModal = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">New route</h3>
      <label class="field-label">Route name</label>
      <input class="form-input" id="nrName" placeholder="e.g. Route A — North">
      <label class="field-label">Driver name</label>
      <input class="form-input" id="nrDriverName" placeholder="Optional">
      <label class="field-label">Driver phone</label>
      <input class="form-input" id="nrDriverPhone" placeholder="Optional" type="tel">
      <label class="field-label">Vehicle</label>
      <input class="form-input" id="nrVehicle" placeholder="e.g. Toyota Coaster, plate no. (optional)">
      <label class="field-label">Notes</label>
      <input class="form-input" id="nrNotes" placeholder="Optional">
      <button class="btn-primary mt16" id="nrSaveBtn" onclick="_saveNewRoute()">Add route</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._saveNewRoute = async function() {
  const name = document.getElementById('nrName').value.trim();
  if (!name) { showToast('Enter a route name'); return; }

  const btn = document.getElementById('nrSaveBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await API.addRoute({
      route_name: name,
      driver_name: document.getElementById('nrDriverName').value.trim() || null,
      driver_phone: document.getElementById('nrDriverPhone').value.trim() || null,
      vehicle_info: document.getElementById('nrVehicle').value.trim() || null,
      notes: document.getElementById('nrNotes').value.trim() || null,
    });
    closeModal();
    showToast('✓ Route added');
    await renderTransport();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add route';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Detail (single modal — sub-views swap #routeDetailBody in place) ─── */

window.openRouteDetail = function(id) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <div id="routeDetailBody">${skeletonCards(1)}</div>
    </div>
  `);
  _loadRouteDetail(id);
};

async function _loadRouteDetail(id) {
  const el = document.getElementById('routeDetailBody');
  if (!el) return;
  try {
    const res = await API.getRouteDetail(id);
    _transportRouteCache = res.route;
    _renderRouteDetailView(id, res.students);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
  }
}

function _renderRouteDetailView(id, students) {
  const el = document.getElementById('routeDetailBody');
  if (!el) return;
  const r = _transportRouteCache;
  if (!r) { el.innerHTML = `<div class="empty-state">Route not found.</div>`; return; }

  el.innerHTML = `
    <h3 class="modal-title">${esc(r.route_name)}</h3>
    <div class="billing-detail-items">
      <div class="billing-detail-row"><span>Driver</span><span>${esc(r.driver_name || '—')}</span></div>
      <div class="billing-detail-row"><span>Phone</span><span>${esc(r.driver_phone || '—')}</span></div>
      <div class="billing-detail-row"><span>Vehicle</span><span>${esc(r.vehicle_info || '—')}</span></div>
    </div>
    ${r.notes ? `<p class="billing-notes">${esc(r.notes)}</p>` : ''}

    <div class="billing-section-title mt16">Students (${students.length})</div>
    ${students.length ? students.map(s => `
      <div class="row-with-delete">
        <span>${esc(s.name_en)} <span class="muted-note">${esc(s.class || '')}${s.pickup_stop ? ' · ' + esc(s.pickup_stop) : ''}${s.pickup_time ? ' · ' + esc(s.pickup_time.slice(0,5)) : ''}</span></span>
        <button class="icon-btn-mini danger" onclick="_removeFromRoute('${esc(s.student_id)}', ${id})" title="Remove">🗑</button>
      </div>
    `).join('') : `<p class="muted-note">No students assigned yet.</p>`}

    <button class="btn-primary mt16" onclick="_showAssignStudentView(${id})">Assign a student</button>
    <button class="btn-secondary" onclick="_showEditRouteView(${id})">Edit route</button>
    <button class="btn-secondary" onclick="_confirmDeleteRoute(${id})">Delete route</button>
  `;
}

window._showEditRouteView = function(id) {
  const el = document.getElementById('routeDetailBody');
  if (!el) return;
  const r = _transportRouteCache;
  if (!r) return;

  el.innerHTML = `
    <h3 class="modal-title">Edit route</h3>
    <label class="field-label">Route name</label>
    <input class="form-input" id="erName" value="${esc(r.route_name)}">
    <label class="field-label">Driver name</label>
    <input class="form-input" id="erDriverName" value="${esc(r.driver_name || '')}">
    <label class="field-label">Driver phone</label>
    <input class="form-input" id="erDriverPhone" value="${esc(r.driver_phone || '')}">
    <label class="field-label">Vehicle</label>
    <input class="form-input" id="erVehicle" value="${esc(r.vehicle_info || '')}">
    <label class="field-label">Notes</label>
    <input class="form-input" id="erNotes" value="${esc(r.notes || '')}">
    <button class="btn-primary mt16" id="erSaveBtn" onclick="_saveEditRoute(${id})">Save changes</button>
    <button class="btn-secondary" onclick="_loadRouteDetail(${id})">Cancel</button>
  `;
};

window._saveEditRoute = async function(id) {
  const name = document.getElementById('erName').value.trim();
  if (!name) { showToast('Route name is required'); return; }

  const btn = document.getElementById('erSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.updateRoute(id, {
      route_name: name,
      driver_name: document.getElementById('erDriverName').value.trim() || null,
      driver_phone: document.getElementById('erDriverPhone').value.trim() || null,
      vehicle_info: document.getElementById('erVehicle').value.trim() || null,
      notes: document.getElementById('erNotes').value.trim() || null,
    });
    showToast('✓ Saved');
    await renderTransport();
    await _loadRouteDetail(id);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save changes';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._showAssignStudentView = function(id) {
  const el = document.getElementById('routeDetailBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title">Assign a student</h3>
    <label class="field-label">Student</label>
    <button type="button" class="form-picker-trigger" id="asStudentBtn" onclick="openStudentPicker({onPick:_onAssignStudentPicked})">
      <span class="form-picker-value" id="asStudent_label">Select student</span>
      <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <input type="hidden" id="asStudentId" value="">
    <label class="field-label">Pickup stop</label>
    <input class="form-input" id="asPickupStop" placeholder="e.g. Main Gate (optional)">
    <label class="field-label">Pickup time</label>
    <input class="form-input" id="asPickupTime" type="time">
    <label class="field-label">Drop-off time</label>
    <input class="form-input" id="asDropoffTime" type="time">
    <button class="btn-primary mt16" id="asSaveBtn" onclick="_saveAssignStudent(${id})">Assign</button>
    <button class="btn-secondary" onclick="_loadRouteDetail(${id})">Cancel</button>
  `;
};

window._onAssignStudentPicked = function(student) {
  document.getElementById('asStudentId').value = student.student_id;
  document.getElementById('asStudent_label').textContent = student.name_en;
};

window._saveAssignStudent = async function(routeId) {
  const studentId = document.getElementById('asStudentId').value;
  if (!studentId) { showToast('Pick a student'); return; }

  const btn = document.getElementById('asSaveBtn');
  btn.disabled = true; btn.textContent = 'Assigning…';
  try {
    await API.assignStudentTransport(studentId, {
      route_id: routeId,
      pickup_stop: document.getElementById('asPickupStop').value.trim() || null,
      pickup_time: document.getElementById('asPickupTime').value || null,
      dropoff_time: document.getElementById('asDropoffTime').value || null,
    });
    showToast('✓ Assigned');
    await renderTransport();
    await _loadRouteDetail(routeId);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Assign';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._removeFromRoute = async function(studentId, routeId) {
  try {
    await API.removeStudentTransport(studentId);
    showToast('✓ Removed');
    await renderTransport();
    await _loadRouteDetail(routeId);
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._confirmDeleteRoute = function(id) {
  showConfirm(
    '🗑 Delete this route?',
    'Any students on it will just be unassigned, not removed from the school.',
    'Delete',
    async () => {
      try {
        await API.deleteRoute(id);
        closeModal();
        showToast('✓ Deleted');
        await renderTransport();
      } catch (e) {
        showToast('Delete failed: ' + (e.message || 'error'));
      }
    }
  );
};
