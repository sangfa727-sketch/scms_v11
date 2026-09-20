/**
 * SCMS v11 — 22_admissions.js
 * Admissions: prospective-student applications, tracked through a pipeline
 * (Applied → Interview Scheduled/Done → Accepted/Waitlisted/Rejected →
 * Enrolled or Withdrawn). "Enrolled" is only reachable via the
 * convert-to-student action, which creates a real `students` row.
 *
 * Web only for now — this is a new feature with no n8n/Telegram equivalent
 * yet, same as Grading & Assessment / Billing.
 */

'use strict';

let _admStatus     = 'All';
let _admClass      = 'All';
let _admissionsAll = [];

const ADM_STATUSES = [
  'All', 'Applied', 'Interview Scheduled', 'Interview Done',
  'Accepted', 'Waitlisted', 'Rejected', 'Enrolled', 'Withdrawn',
];

// Statuses reachable from each status via the pipeline buttons in the
// detail view (Enrolled is excluded here — that only happens via convert).
const ADM_NEXT_STATUSES = {
  'Applied':              ['Interview Scheduled', 'Rejected', 'Withdrawn'],
  'Interview Scheduled':  ['Interview Done', 'Rejected', 'Withdrawn'],
  'Interview Done':       ['Accepted', 'Waitlisted', 'Rejected', 'Withdrawn'],
  'Waitlisted':           ['Accepted', 'Rejected', 'Withdrawn'],
  'Accepted':             ['Withdrawn'],
  'Rejected':             ['Applied'],
  'Withdrawn':            ['Applied'],
  'Enrolled':             [],
};

async function renderAdmissions() {
  const listEl = document.getElementById('admissionsList');
  if (listEl) listEl.innerHTML = skeletonCards(2);

  try {
    _admissionsAll = await API.getAdmissions();
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  _renderAdmissionsFilters();
  _renderAdmissionsSummary();
  _renderAdmissionsList();
}

function _renderAdmissionsFilters() {
  const classes = ['All', ...getClassList()];
  const clsEl    = document.getElementById('admissionsClassPicker');
  const statusEl = document.getElementById('admissionsStatusPicker');
  if (!clsEl || !statusEl) return;

  clsEl.innerHTML = classes.map(c =>
    `<button class="chip${c === _admClass ? ' active' : ''}" onclick="selectAdmClass('${esc(c)}')">${esc(c)}</button>`
  ).join('');

  statusEl.innerHTML = ADM_STATUSES.map(s =>
    `<button class="chip${s === _admStatus ? ' active' : ''}" onclick="selectAdmStatus('${esc(s)}')">${esc(s)}</button>`
  ).join('');
}

window.selectAdmClass = function(cls) {
  _admClass = cls;
  document.querySelectorAll('#admissionsClassPicker .chip').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === cls));
  _renderAdmissionsList();
};

window.selectAdmStatus = function(status) {
  _admStatus = status;
  document.querySelectorAll('#admissionsStatusPicker .chip').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === status));
  _renderAdmissionsList();
};

function _filteredAdmissions() {
  return _admissionsAll.filter(a =>
    (_admStatus === 'All' || a.status === _admStatus) &&
    (_admClass  === 'All' || (a.desired_class || '') === _admClass)
  );
}

function _renderAdmissionsSummary() {
  const el = document.getElementById('admissionsSummary');
  if (!el) return;
  const open      = _admissionsAll.filter(a => !['Enrolled', 'Rejected', 'Withdrawn'].includes(a.status)).length;
  const accepted  = _admissionsAll.filter(a => a.status === 'Accepted').length;
  const enrolled  = _admissionsAll.filter(a => a.status === 'Enrolled').length;
  el.innerHTML = `
    <div class="billing-summary-row">
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Total</div>
        <div class="billing-summary-value">${esc(String(_admissionsAll.length))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">In progress</div>
        <div class="billing-summary-value">${esc(String(open))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Accepted</div>
        <div class="billing-summary-value">${esc(String(accepted))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Enrolled</div>
        <div class="billing-summary-value">${esc(String(enrolled))}</div>
      </div>
    </div>`;
}

function _renderAdmissionsList() {
  const el = document.getElementById('admissionsList');
  if (!el) return;

  const rows = _filteredAdmissions();
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">No applicants yet — tap + to add one.</div>`;
    return;
  }

  el.innerHTML = rows.map(a => `
    <div class="list-card" onclick="openAdmissionDetail(${a.id})">
      <div class="card-row">
        <div class="card-info">
          <div class="card-name">${esc(a.applicant_name_en)} ${a.desired_class ? `<span class="type-tag">${esc(a.desired_class)}</span>` : ''}</div>
          <div class="card-sub">${esc(a.parent_name || 'No parent name')} · Applied ${esc(fmtDate(a.application_date))}</div>
        </div>
        <div class="card-actions">
          <span class="adm-status-badge adm-status-${_admStatusSlug(a.status)}">${esc(a.status)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function _admStatusSlug(s) {
  return String(s).toLowerCase().replace(/\s+/g, '-');
}

/* ─── New applicant ──────────────────────────────────────────────────── */

window.openNewAdmissionModal = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">New applicant</h3>

      <label class="field-label">Name (English)</label>
      <input class="form-input" id="naNameEn" placeholder="Full name">
      <label class="field-label">Name (local, optional)</label>
      <input class="form-input" id="naNameLocal" placeholder="Optional">

      <label class="field-label">Date of birth</label>
      <input class="form-input" id="naDob" type="date">

      <label class="field-label">Gender</label>
      <div class="pill-group" id="naGenderPills">
        ${['Male', 'Female', 'Other'].map((g, i) =>
          `<button type="button" class="pill${i === 0 ? ' active' : ''}" onclick="togglePill(this,'naGenderPills')">${g}</button>`
        ).join('')}
      </div>

      <label class="field-label">Desired class</label>
      <input class="form-input" id="naClass" placeholder="e.g. Grade 3">

      <label class="field-label">Parent name</label>
      <input class="form-input" id="naParentName" placeholder="Optional">
      <label class="field-label">Parent phone</label>
      <input class="form-input" id="naParentPhone" placeholder="Optional" type="tel">
      <label class="field-label">Parent email</label>
      <input class="form-input" id="naParentEmail" placeholder="Optional" type="email">

      <label class="field-label">Source</label>
      <input class="form-input" id="naSource" placeholder="e.g. Referral, Walk-in (optional)">

      <label class="field-label">Notes</label>
      <input class="form-input" id="naNotes" placeholder="Optional">

      <button class="btn-primary mt16" id="naSaveBtn" onclick="_saveNewAdmission()">Add applicant</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._saveNewAdmission = async function() {
  const nameEn = document.getElementById('naNameEn').value.trim();
  if (!nameEn) { showToast('Enter the applicant\'s name'); return; }

  const parentEmail = document.getElementById('naParentEmail').value.trim();
  if (parentEmail && !isValidEmail(parentEmail)) { showToast('Enter a valid parent email'); return; }

  const btn = document.getElementById('naSaveBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await API.createAdmission({
      applicant_name_en:    nameEn,
      applicant_name_local: document.getElementById('naNameLocal').value.trim() || null,
      date_of_birth:        document.getElementById('naDob').value || null,
      gender:                document.querySelector('#naGenderPills .pill.active')?.textContent.trim() || null,
      desired_class:        document.getElementById('naClass').value.trim() || null,
      parent_name:          document.getElementById('naParentName').value.trim() || null,
      parent_phone:         document.getElementById('naParentPhone').value.trim() || null,
      parent_email:         parentEmail || null,
      source:               document.getElementById('naSource').value.trim() || null,
      notes:                document.getElementById('naNotes').value.trim() || null,
    });
    closeModal();
    showToast('✓ Applicant added');
    await renderAdmissions();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add applicant';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Detail / pipeline / edit / convert ────────────────────────────────── */

window.openAdmissionDetail = function(id) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <div id="admDetailBody">${skeletonCards(1)}</div>
    </div>
  `);
  _loadAdmissionDetail(id);
};

async function _loadAdmissionDetail(id) {
  const el = document.getElementById('admDetailBody');
  if (!el) return;
  try {
    const res = await API.getAdmissionDetail(id);
    el.innerHTML = _admDetailHtml(res.admission);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
  }
}

function _admDetailHtml(a) {
  const nextStatuses = ADM_NEXT_STATUSES[a.status] || [];
  return `
    <h3 class="modal-title">${esc(a.applicant_name_en)}</h3>
    <span class="adm-status-badge adm-status-${_admStatusSlug(a.status)}">${esc(a.status)}</span>

    <div class="billing-detail-items">
      <div class="billing-detail-row"><span>Local name</span><span>${esc(a.applicant_name_local || '—')}</span></div>
      <div class="billing-detail-row"><span>Date of birth</span><span>${a.date_of_birth ? esc(fmtDate(a.date_of_birth)) : '—'}</span></div>
      <div class="billing-detail-row"><span>Gender</span><span>${esc(a.gender || '—')}</span></div>
      <div class="billing-detail-row"><span>Desired class</span><span>${esc(a.desired_class || '—')}</span></div>
      <div class="billing-detail-row"><span>Parent</span><span>${esc(a.parent_name || '—')}</span></div>
      <div class="billing-detail-row"><span>Phone</span><span>${esc(a.parent_phone || '—')}</span></div>
      <div class="billing-detail-row"><span>Email</span><span>${esc(a.parent_email || '—')}</span></div>
      <div class="billing-detail-row"><span>Applied</span><span>${esc(fmtDate(a.application_date))}</span></div>
      ${a.interview_date ? `<div class="billing-detail-row"><span>Interview</span><span>${esc(fmtDate(a.interview_date))}</span></div>` : ''}
      <div class="billing-detail-row"><span>Source</span><span>${esc(a.source || '—')}</span></div>
    </div>
    ${a.notes ? `<p class="billing-notes">${esc(a.notes)}</p>` : ''}
    ${a.converted_student_id ? `<p class="billing-notes">Enrolled as student ${esc(a.converted_student_id)}.</p>` : ''}

    ${nextStatuses.length ? `
      <div class="billing-section-title mt16">Move to</div>
      <div class="pill-group">
        ${nextStatuses.map(s => `<button type="button" class="pill" onclick="_moveAdmissionStatus(${a.id}, '${esc(s)}')">${esc(s)}</button>`).join('')}
      </div>
    ` : ''}

    ${a.status === 'Accepted' ? `<button class="btn-primary mt16" onclick="_openConvertAdmission(${a.id}, '${esc((a.desired_class || '').replace(/'/g, "\\'"))}')">Enroll as student</button>` : ''}

    <button class="btn-secondary mt16" onclick="_openEditAdmission(${a.id})">Edit details</button>
    <button class="btn-secondary" onclick="_confirmDeleteAdmission(${a.id})">Delete applicant</button>
  `;
}

window._moveAdmissionStatus = async function(id, status) {
  if (status === 'Interview Scheduled') {
    _promptInterviewDate(id);
    return;
  }
  try {
    await API.updateAdmissionStatus(id, status);
    showToast(`✓ Moved to ${status}`);
    await _loadAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

function _promptInterviewDate(id) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Schedule interview</h3>
      <label class="field-label">Interview date</label>
      <input class="form-input" id="admInterviewDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
      <button class="btn-primary mt16" onclick="_saveInterviewDate(${id})">Save</button>
      <button class="btn-secondary" onclick="openAdmissionDetail(${id})">Cancel</button>
    </div>
  `);
}

window._saveInterviewDate = async function(id) {
  const date = document.getElementById('admInterviewDate').value || null;
  try {
    await API.updateAdmissionStatus(id, 'Interview Scheduled', { interview_date: date });
    showToast('✓ Interview scheduled');
    openAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._openEditAdmission = async function(id) {
  let a;
  try {
    a = (await API.getAdmissionDetail(id)).admission;
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
    return;
  }
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Edit applicant</h3>

      <label class="field-label">Name (English)</label>
      <input class="form-input" id="eaNameEn" value="${esc(a.applicant_name_en)}">
      <label class="field-label">Name (local)</label>
      <input class="form-input" id="eaNameLocal" value="${esc(a.applicant_name_local || '')}">
      <label class="field-label">Date of birth</label>
      <input class="form-input" id="eaDob" type="date" value="${a.date_of_birth || ''}">
      <label class="field-label">Desired class</label>
      <input class="form-input" id="eaClass" value="${esc(a.desired_class || '')}">
      <label class="field-label">Parent name</label>
      <input class="form-input" id="eaParentName" value="${esc(a.parent_name || '')}">
      <label class="field-label">Parent phone</label>
      <input class="form-input" id="eaParentPhone" value="${esc(a.parent_phone || '')}">
      <label class="field-label">Parent email</label>
      <input class="form-input" id="eaParentEmail" value="${esc(a.parent_email || '')}">
      <label class="field-label">Source</label>
      <input class="form-input" id="eaSource" value="${esc(a.source || '')}">
      <label class="field-label">Notes</label>
      <input class="form-input" id="eaNotes" value="${esc(a.notes || '')}">

      <button class="btn-primary mt16" id="eaSaveBtn" onclick="_saveEditAdmission(${id})">Save changes</button>
      <button class="btn-secondary" onclick="openAdmissionDetail(${id})">Cancel</button>
    </div>
  `);
};

window._saveEditAdmission = async function(id) {
  const nameEn = document.getElementById('eaNameEn').value.trim();
  if (!nameEn) { showToast('Name is required'); return; }
  const parentEmail = document.getElementById('eaParentEmail').value.trim();
  if (parentEmail && !isValidEmail(parentEmail)) { showToast('Enter a valid parent email'); return; }

  const btn = document.getElementById('eaSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.updateAdmission(id, {
      applicant_name_en:    nameEn,
      applicant_name_local: document.getElementById('eaNameLocal').value.trim() || null,
      date_of_birth:        document.getElementById('eaDob').value || null,
      desired_class:        document.getElementById('eaClass').value.trim() || null,
      parent_name:          document.getElementById('eaParentName').value.trim() || null,
      parent_phone:         document.getElementById('eaParentPhone').value.trim() || null,
      parent_email:         parentEmail || null,
      source:               document.getElementById('eaSource').value.trim() || null,
      notes:                document.getElementById('eaNotes').value.trim() || null,
    });
    showToast('✓ Saved');
    openAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save changes';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._openConvertAdmission = function(id, desiredClass) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Enroll as student</h3>
      <p class="billing-notes">Creates a new student record from this applicant's details.</p>
      <label class="field-label">Class</label>
      <input class="form-input" id="convClass" value="${esc(desiredClass || '')}" placeholder="e.g. Grade 3">
      <button class="btn-primary mt16" id="convSaveBtn" onclick="_saveConvertAdmission(${id})">Enroll</button>
      <button class="btn-secondary" onclick="openAdmissionDetail(${id})">Cancel</button>
    </div>
  `);
};

window._saveConvertAdmission = async function(id) {
  const cls = document.getElementById('convClass').value.trim();
  if (!cls) { showToast('Enter a class'); return; }

  const btn = document.getElementById('convSaveBtn');
  btn.disabled = true; btn.textContent = 'Enrolling…';
  try {
    const res = await API.convertAdmissionToStudent(id, { class: cls });
    closeModal();
    showToast(`✓ Enrolled as ${res.student.student_id}`);
    if (typeof API.getStudents === 'function' && window.APP) {
      window.APP.students = await API.getStudents().catch(() => window.APP.students);
      if (typeof renderStudents === 'function') renderStudents();
    }
    await renderAdmissions();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Enroll';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._confirmDeleteAdmission = function(id) {
  showConfirm(
    '🗑 Delete this applicant?',
    'This removes the application record. It does not affect any student it may already have been converted to.',
    'Delete',
    async () => {
      try {
        await API.deleteAdmission(id);
        closeModal();
        showToast('✓ Deleted');
        await renderAdmissions();
      } catch (e) {
        showToast('Delete failed: ' + (e.message || 'error'));
      }
    }
  );
};
