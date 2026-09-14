/**
 * SCMS v11 — 09_incidents.js
 * Incident recording: list, filter, add modal with smart student picker.
 */

'use strict';

let _incidentType = 'All';
let _incPickedStudent = null;

function renderIncidents() {
  _renderIncidentTypeChips();
  _renderIncidentList();
}

function _renderIncidentTypeChips() {
  const el = document.getElementById('incidentTypeChips');
  if (!el) return;

  const types = ['All', ...(window.APP.config?.incident_types ||
    ['Good Behaviour','Participation','Achievement','Concern','Health','Other'])];

  el.innerHTML = types.map(t =>
    `<button class="chip${t === _incidentType ? ' active' : ''}" data-type="${esc(t)}"
      onclick="filterIncidentType('${esc(t)}')">${esc(t)}</button>`
  ).join('');
}

window.filterIncidentType = function(type) {
  _incidentType = type;
  document.querySelectorAll('#incidentTypeChips .chip').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  _renderIncidentList();
};

function _renderIncidentList() {
  const el = document.getElementById('incidentList');
  if (!el) return;

  let list = [...window.APP.incidents].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (_incidentType !== 'All') list = list.filter(i => i.type === _incidentType);

  if (!list.length) {
    el.innerHTML = emptyState('⚡', 'No incidents recorded', 'Tap + to log one');
    return;
  }

  const sevColor = { Info:'#6B7280', Low:'#0891B2', Medium:'#D97706', High:'#DC2626', Critical:'#7C3AED' };
  const typeIcon  = { 'Good Behaviour':'⭐','Participation':'🙋','Achievement':'🏆','Concern':'⚠️','Health':'🏥','Other':'📋','Bullying':'🚫','Injury':'🩹' };

  el.innerHTML = list.map(i => {
    const color = sevColor[i.severity] || '#6B7280';
    const icon  = typeIcon[i.type]     || '📋';

    return `
      <div class="list-card" data-incident-id="${esc(i.id)}">
        <div class="card-row">
          <div class="incident-icon">${icon}</div>
          <div class="card-info">
            <div class="card-name">${esc(i.name_en || i.student_id || '—')}</div>
            <div class="card-sub">
              ${esc(i.type)} ·
              <span class="sev-badge" style="color:${color}">${esc(i.severity)}</span>
              · ${esc(i.date || '—')}
            </div>
          </div>
          ${i.parent_notified ? '<span class="notif-badge" title="Parent notified">✓</span>' : ''}
          <div class="card-actions">
            <button class="icon-btn-mini" onclick="openEditIncident('${esc(i.id)}')" title="Edit">✎</button>
            <button class="icon-btn-mini danger" onclick="confirmDeleteIncident('${esc(i.id)}')" title="Delete">🗑</button>
          </div>
        </div>
        ${i.description   ? `<div class="card-note">${esc(i.description)}</div>` : ''}
        ${i.action_taken  ? `<div class="card-action">Action: ${esc(i.action_taken)}</div>` : ''}
      </div>`;
  }).join('');
}

window.openIncidentModal = function(prefillStudent) {
  // If a student object was passed in directly, use it; otherwise open the picker first
  if (prefillStudent && typeof prefillStudent === 'object' && prefillStudent.student_id) {
    _incPickedStudent = prefillStudent;
    _renderIncidentForm();
    return;
  }
  _incPickedStudent = null;
  openStudentPicker({
    title:   'Log Incident — choose a student',
    onPick:  (s) => { _incPickedStudent = s; _renderIncidentForm(); },
  });
};

function _renderIncidentForm() {
  const s = _incPickedStudent || {};
  const types      = window.APP.config?.incident_types ||
    ['Good Behaviour','Participation','Achievement','Concern','Conflict','Health','Other'];
  const severities = window.APP.config?.severities || ['Info','Low','Medium','High'];

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Log Incident / Note</h3>

      <label class="field-label">Student</label>
      <button type="button" class="picker-trigger" onclick="openIncidentModal()">
        <span>${esc(s.name_en || s.name_local || 'Tap to choose…')}</span>
        ${s.class ? `<span class="picker-trigger-meta">${esc(s.class)}</span>` : ''}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>

      <label class="field-label">Type</label>
      <div class="pill-group" id="incTypePills">
        ${types.map((t, i) => `<button type="button" class="pill ${i===0?'active':''}" onclick="togglePill(this,'incTypePills')">${esc(t)}</button>`).join('')}
      </div>

      <label class="field-label">Severity</label>
      <div class="pill-group" id="incSevPills">
        ${severities.map((sev, i) => `<button type="button" class="pill ${i===0?'active':''}" onclick="togglePill(this,'incSevPills')">${esc(sev)}</button>`).join('')}
      </div>

      <label class="field-label">Description</label>
      <textarea class="form-textarea" id="incDesc" rows="3" placeholder="What happened…"></textarea>

      <label class="field-label">Action taken <span class="optional">(optional)</span></label>
      <input class="form-input" id="incAction" placeholder="e.g. Spoke with student, sent note home…">

      <label class="field-label toggle-row">
        <span>Notify parent</span>
        <input type="checkbox" id="incNotify" class="toggle-check">
      </label>

      <button class="btn-primary mt16" id="saveIncBtn" onclick="saveIncident()">Save</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;

  openModal(html);
}

window.saveIncident = async function() {
  const btn = document.getElementById('saveIncBtn');
  const stu = _incPickedStudent;

  if (!stu) { showToast('Pick a student first'); return; }

  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const data = {
      student_id:     stu.student_id,
      name_en:        stu.name_en,
      class:          stu.class || '',
      type:           document.querySelector('#incTypePills .pill.active')?.textContent.trim() || 'Other',
      severity:       document.querySelector('#incSevPills .pill.active')?.textContent.trim() || 'Info',
      description:    document.getElementById('incDesc').value.trim(),
      action_taken:   document.getElementById('incAction').value.trim(),
      parent_notified: document.getElementById('incNotify').checked,
      date:           new Date().toISOString().slice(0, 10),
      teacher_id:     window.APP.teacher_id,
      school_id:      window.APP.school_id,
    };

    await API.saveIncident(data);
    window.APP.incidents.unshift(data);

    closeModal();
    _renderIncidentList();
    showToast('✓ Incident logged');
    if (window.APP.tg?.HapticFeedback) window.APP.tg.HapticFeedback.notificationOccurred('success');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save';
    showToast('Save failed: ' + (e.message || 'error'));
  }
};

/* ─── Edit + Delete ─────────────────────────────────────────────── */

window.openEditIncident = function(id) {
  const inc = window.APP.incidents.find(x => String(x.id) === String(id));
  if (!inc) { showToast('Item not found'); return; }
  const types = ['Good Behaviour','Participation','Achievement','Concern','Health','Bullying','Injury','Other'];
  const sevs  = ['Info','Low','Medium','High','Critical'];

  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Edit Incident</h3>
      <p class="modal-subtitle">${esc(inc.name_en || inc.student_id || '')} · ${esc(inc.date || '')}</p>

      <label class="field-label">Type</label>
      <select class="form-input" id="eincType">
        ${types.map(t => `<option ${t===inc.type?'selected':''}>${esc(t)}</option>`).join('')}
      </select>

      <label class="field-label">Severity</label>
      <select class="form-input" id="eincSev">
        ${sevs.map(s => `<option ${s===inc.severity?'selected':''}>${esc(s)}</option>`).join('')}
      </select>

      <label class="field-label">Description</label>
      <textarea class="form-textarea" id="eincDesc" rows="3">${esc(inc.description || '')}</textarea>

      <label class="field-label">Action taken</label>
      <textarea class="form-textarea" id="eincAction" rows="2">${esc(inc.action_taken || '')}</textarea>

      <label class="field-label">
        <input type="checkbox" id="eincNotified" ${inc.parent_notified ? 'checked' : ''}>
        Parent notified
      </label>

      <button class="btn-primary mt16" id="saveEincBtn" onclick="saveEditIncident('${esc(id)}')">Save changes</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window.saveEditIncident = async function(id) {
  const btn = document.getElementById('saveEincBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const patch = {
      type:            document.getElementById('eincType').value,
      severity:        document.getElementById('eincSev').value,
      description:     document.getElementById('eincDesc').value.trim(),
      action_taken:    document.getElementById('eincAction').value.trim(),
      parent_notified: document.getElementById('eincNotified').checked,
    };
    await API.updateIncident(id, patch);
    const idx = window.APP.incidents.findIndex(x => String(x.id) === String(id));
    if (idx >= 0) window.APP.incidents[idx] = { ...window.APP.incidents[idx], ...patch };
    closeModal();
    _renderIncidentList();
    showToast('✓ Incident updated');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save changes';
    showToast('Update failed: ' + (e.message || 'error'));
  }
};

window.confirmDeleteIncident = function(id) {
  if (!confirm('Delete this incident record?')) return;
  doDeleteIncident(id);
};

async function doDeleteIncident(id) {
  try {
    await API.deleteIncident(id);
    window.APP.incidents = window.APP.incidents.filter(x => String(x.id) !== String(id));
    _renderIncidentList();
    showToast('✓ Deleted');
  } catch (e) {
    showToast('Delete failed: ' + (e.message || 'error'));
  }
}
