/**
 * SCMS v11 — 23_health.js
 * Health Records: a per-student profile (allergies, conditions, medications,
 * emergency contact) + vaccination history + a clinic/nurse visit log.
 *
 * Not a standalone list page — health data is inherently per-student, so
 * it's reached from the Student detail view ("🏥 Health Record" button),
 * same idea as the Student ID Card.
 *
 * Single modal, all sub-views (profile/edit-profile/add-vaccination/
 * add-visit) swap one body element's innerHTML in place — never a second
 * stacked openModal() call — matching the fix applied to every other
 * module this session.
 */

'use strict';

window.showHealthRecord = function(studentId) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">🏥 Health Record</h3>
      <div id="healthRecordBody">${skeletonCards(2)}</div>
    </div>
  `);
  _loadHealthRecord(studentId);
};

let _healthProfileCache = {};

async function _loadHealthRecord(studentId) {
  const el = document.getElementById('healthRecordBody');
  if (!el) return;
  try {
    const res = await API.getHealthProfile(studentId);
    _healthProfileCache = res.profile || {};
    _renderHealthRecordView(studentId, res.profile, res.vaccinations, res.visits);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
  }
}

function _renderHealthRecordView(studentId, profile, vaccinations, visits) {
  const el = document.getElementById('healthRecordBody');
  if (!el) return;
  profile = profile || {};

  const hasAlert = !!(profile.allergies || profile.medical_conditions);

  el.innerHTML = `
    ${hasAlert ? `
      <div class="health-alert">
        ${profile.allergies ? `<div>⚠️ <strong>Allergies:</strong> ${esc(profile.allergies)}</div>` : ''}
        ${profile.medical_conditions ? `<div>⚠️ <strong>Conditions:</strong> ${esc(profile.medical_conditions)}</div>` : ''}
      </div>
    ` : ''}

    <div class="billing-detail-items">
      <div class="billing-detail-row"><span>Blood type</span><span>${esc(profile.blood_type || '—')}</span></div>
      <div class="billing-detail-row"><span>Medications</span><span>${esc(profile.medications || '—')}</span></div>
      <div class="billing-detail-row"><span>Emergency contact</span><span>${esc(profile.emergency_contact_name || '—')}${profile.emergency_contact_phone ? ' · ' + esc(profile.emergency_contact_phone) : ''}</span></div>
      <div class="billing-detail-row"><span>Doctor</span><span>${esc(profile.doctor_name || '—')}${profile.doctor_phone ? ' · ' + esc(profile.doctor_phone) : ''}</span></div>
    </div>
    ${profile.notes ? `<p class="billing-notes">${esc(profile.notes)}</p>` : ''}
    <button class="btn-secondary" onclick="_showEditHealthProfile('${esc(studentId)}')">Edit health profile</button>

    <div class="billing-section-title mt16">Vaccinations</div>
    ${vaccinations.length ? vaccinations.map(v => `
      <div class="row-with-delete">
        <div>
          <div class="card-name" style="font-size:14px">${esc(v.vaccine_name)}</div>
          <div class="card-sub">${v.date_given ? esc(fmtDate(v.date_given)) : 'No date'}${v.notes ? ' · ' + esc(v.notes) : ''}</div>
        </div>
        <button type="button" class="icon-btn-mini danger" onclick="_deleteVaccinationRow(${v.id}, '${esc(studentId)}')" title="Delete">🗑</button>
      </div>
    `).join('') : `<p class="muted-note">No vaccinations recorded.</p>`}
    <button class="btn-pill-action ghost" onclick="_showAddVaccination('${esc(studentId)}')">+ Add vaccination</button>

    <div class="billing-section-title mt16">Clinic / nurse visits</div>
    ${visits.length ? visits.map(v => `
      <div class="row-with-delete">
        <div>
          <div class="card-name" style="font-size:14px">${esc(fmtDate(v.date))} — ${esc(v.reason)}</div>
          <div class="card-sub">${v.treatment ? esc(v.treatment) : ''}${v.notes ? ' · ' + esc(v.notes) : ''}</div>
        </div>
        <button type="button" class="icon-btn-mini danger" onclick="_deleteHealthVisitRow(${v.id}, '${esc(studentId)}')" title="Delete">🗑</button>
      </div>
    `).join('') : `<p class="muted-note">No visits logged.</p>`}
    <button class="btn-pill-action ghost" onclick="_showAddHealthVisit('${esc(studentId)}')">+ Log visit</button>

    <button class="btn-secondary mt16" onclick="closeModal()">Close</button>
  `;
}

/* ─── Edit profile ───────────────────────────────────────────────────────── */

window._showEditHealthProfile = function(studentId) {
  const p = _healthProfileCache || {};
  const el = document.getElementById('healthRecordBody');
  if (!el) return;

  el.innerHTML = `
    <h3 class="modal-title" style="font-size:16px">Edit health profile</h3>
    <label class="field-label">Blood type</label>
    <input class="form-input" id="hpBloodType" value="${esc(p.blood_type || '')}" placeholder="e.g. O+">
    <label class="field-label">Allergies</label>
    <input class="form-input" id="hpAllergies" value="${esc(p.allergies || '')}" placeholder="e.g. Peanuts, penicillin">
    <label class="field-label">Medical conditions</label>
    <input class="form-input" id="hpConditions" value="${esc(p.medical_conditions || '')}" placeholder="e.g. Asthma">
    <label class="field-label">Medications</label>
    <input class="form-input" id="hpMedications" value="${esc(p.medications || '')}" placeholder="Optional">
    <label class="field-label">Emergency contact name</label>
    <input class="form-input" id="hpEmName" value="${esc(p.emergency_contact_name || '')}">
    <label class="field-label">Emergency contact phone</label>
    <input class="form-input" id="hpEmPhone" value="${esc(p.emergency_contact_phone || '')}" type="tel">
    <label class="field-label">Doctor name</label>
    <input class="form-input" id="hpDoctorName" value="${esc(p.doctor_name || '')}">
    <label class="field-label">Doctor phone</label>
    <input class="form-input" id="hpDoctorPhone" value="${esc(p.doctor_phone || '')}" type="tel">
    <label class="field-label">Notes</label>
    <input class="form-input" id="hpNotes" value="${esc(p.notes || '')}">

    <button class="btn-primary mt16" id="hpSaveBtn" onclick="_saveHealthProfile('${esc(studentId)}')">Save</button>
    <button class="btn-secondary" onclick="_loadHealthRecord('${esc(studentId)}')">Cancel</button>
  `;
};

window._saveHealthProfile = async function(studentId) {
  const btn = document.getElementById('hpSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.upsertHealthProfile(studentId, {
      blood_type: document.getElementById('hpBloodType').value.trim(),
      allergies: document.getElementById('hpAllergies').value.trim(),
      medical_conditions: document.getElementById('hpConditions').value.trim(),
      medications: document.getElementById('hpMedications').value.trim(),
      emergency_contact_name: document.getElementById('hpEmName').value.trim(),
      emergency_contact_phone: document.getElementById('hpEmPhone').value.trim(),
      doctor_name: document.getElementById('hpDoctorName').value.trim(),
      doctor_phone: document.getElementById('hpDoctorPhone').value.trim(),
      notes: document.getElementById('hpNotes').value.trim(),
    });
    showToast('✓ Saved');
    await _loadHealthRecord(studentId);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Vaccinations ───────────────────────────────────────────────────────── */

window._showAddVaccination = function(studentId) {
  const el = document.getElementById('healthRecordBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title" style="font-size:16px">Add vaccination</h3>
    <label class="field-label">Vaccine name</label>
    <input class="form-input" id="vxName" placeholder="e.g. MMR">
    <label class="field-label">Date given</label>
    <input class="form-input" id="vxDate" type="date">
    <label class="field-label">Notes</label>
    <input class="form-input" id="vxNotes" placeholder="Optional">
    <button class="btn-primary mt16" id="vxSaveBtn" onclick="_saveVaccination('${esc(studentId)}')">Add</button>
    <button class="btn-secondary" onclick="_loadHealthRecord('${esc(studentId)}')">Cancel</button>
  `;
};

window._saveVaccination = async function(studentId) {
  const name = document.getElementById('vxName').value.trim();
  if (!name) { showToast('Enter the vaccine name'); return; }

  const btn = document.getElementById('vxSaveBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await API.addVaccination(studentId, {
      vaccine_name: name,
      date_given: document.getElementById('vxDate').value || null,
      notes: document.getElementById('vxNotes').value.trim(),
    });
    showToast('✓ Added');
    await _loadHealthRecord(studentId);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._deleteVaccinationRow = function(id, studentId) {
  showConfirm('🗑 Delete this vaccination record?', '', 'Delete', async () => {
    try {
      await API.deleteVaccination(id);
      showToast('✓ Deleted');
      await _loadHealthRecord(studentId);
    } catch (e) {
      showToast('Failed: ' + (e.message || 'error'));
    }
  });
};

/* ─── Clinic / nurse visits ──────────────────────────────────────────────── */

window._showAddHealthVisit = function(studentId) {
  const el = document.getElementById('healthRecordBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title" style="font-size:16px">Log a clinic visit</h3>
    <label class="field-label">Date</label>
    <input class="form-input" id="hvDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
    <label class="field-label">Reason</label>
    <input class="form-input" id="hvReason" placeholder="e.g. Fever, headache">
    <label class="field-label">Treatment given</label>
    <input class="form-input" id="hvTreatment" placeholder="Optional">
    <label class="field-label">Notes</label>
    <input class="form-input" id="hvNotes" placeholder="Optional">
    <button class="btn-primary mt16" id="hvSaveBtn" onclick="_saveHealthVisit('${esc(studentId)}')">Log visit</button>
    <button class="btn-secondary" onclick="_loadHealthRecord('${esc(studentId)}')">Cancel</button>
  `;
};

window._saveHealthVisit = async function(studentId) {
  const reason = document.getElementById('hvReason').value.trim();
  if (!reason) { showToast('Enter a reason'); return; }

  const btn = document.getElementById('hvSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.addHealthVisit(studentId, {
      date: document.getElementById('hvDate').value || null,
      reason,
      treatment: document.getElementById('hvTreatment').value.trim(),
      notes: document.getElementById('hvNotes').value.trim(),
    });
    showToast('✓ Logged');
    await _loadHealthRecord(studentId);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Log visit';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._deleteHealthVisitRow = function(id, studentId) {
  showConfirm('🗑 Delete this visit record?', '', 'Delete', async () => {
    try {
      await API.deleteHealthVisit(id);
      showToast('✓ Deleted');
      await _loadHealthRecord(studentId);
    } catch (e) {
      showToast('Failed: ' + (e.message || 'error'));
    }
  });
};
