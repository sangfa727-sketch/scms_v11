/**
 * SCMS v11 — 22_admissions.js
 * Admissions: prospective-student applications, tracked through a pipeline
 * (Applied → Interview Scheduled/Done → Accepted/Waitlisted/Rejected →
 * Enrolled or Withdrawn).
 *
 * "Enrolled" is reached via the convert-to-student action, which creates a
 * real `students` row with status='Pending' — deliberately hidden from
 * rpc_get_students (and so from the Students list) until the registration
 * fee is billed and paid:
 *
 *   Accepted → [Enroll as student] → students row (Pending, has a real
 *   student_id / "ID card") → [Create registration invoice] → parent pays
 *   (Billing page) → [Activate] → status='Active' → now an official student,
 *   visible in the Students list.
 *
 * The whole gate reuses the existing, unmodified billing RPCs
 * (rpc_create_invoice / rpc_get_invoice_detail) — this file only remembers
 * which invoice to watch (admissions.registration_invoice_id) and flips the
 * student to Active once it's Paid.
 *
 * All detail/edit/interview/convert/billing views render into a SINGLE
 * modal body (#admDetailBody) that gets its innerHTML swapped — never a
 * second stacked openModal() call — so repeated view↔edit↔cancel cycles
 * don't pile up orphaned modal layers.
 *
 * Web only for now — this is a new feature with no n8n/Telegram equivalent
 * yet, same as Grading & Assessment / Billing.
 */

'use strict';

let _admStatus     = 'All';
let _admClass      = 'All';
let _admissionsAll = [];
let _admPendingPhotoFile   = null; // File picked in the New/Edit applicant form, uploaded on save
let _admRemovePhotoRequested = false;

const ADM_STATUSES = [
  'All', 'Applied', 'Interview Scheduled', 'Interview Done',
  'Accepted', 'Waitlisted', 'Rejected', 'Enrolled', 'Withdrawn',
];

// Statuses reachable from each status via the pipeline buttons in the
// detail view (Enrolled is excluded — that only happens via convert).
const ADM_NEXT_STATUSES = {
  'Applied':              ['Interview Scheduled', 'Accepted', 'Rejected', 'Withdrawn'],
  'Interview Scheduled':  ['Interview Done', 'Rejected', 'Withdrawn'],
  'Interview Done':       ['Accepted', 'Waitlisted', 'Rejected', 'Withdrawn'],
  'Waitlisted':           ['Accepted', 'Rejected', 'Withdrawn'],
  'Accepted':             ['Withdrawn'],
  'Rejected':             ['Applied'],
  'Withdrawn':            ['Applied'],
  'Enrolled':             [],
};

let _admissionsLoadedOnce = false;

async function renderAdmissions() {
  const listEl = document.getElementById('admissionsList');
  if (_admissionsLoadedOnce) {
    // Already have data from a previous visit — show it instantly (no
    // skeleton flash) while refreshing quietly in the background.
    _renderAdmissionsFilters();
    _renderAdmissionsSummary();
    _renderAdmissionsList();
  } else if (listEl) {
    listEl.innerHTML = skeletonCards(2);
  }

  try {
    _admissionsAll = await API.getAdmissions();
    _admissionsLoadedOnce = true;
  } catch (e) {
    if (!_admissionsLoadedOnce && listEl) listEl.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
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

let _admSelected = new Set();

function _renderAdmissionsList() {
  const el = document.getElementById('admissionsList');
  if (!el) return;

  const rows = _filteredAdmissions();

  // Drop selections that fell out of view (filtered out / bulk-acted-on already).
  const visibleIds = new Set(rows.map(a => a.id));
  Array.from(_admSelected).forEach(id => { if (!visibleIds.has(id)) _admSelected.delete(id); });

  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">No applicants yet — tap + to add one.</div>`;
    return;
  }

  el.innerHTML = _admSelectionBarHtml(rows) + rows.map(a => `
    <div class="list-card" onclick="openAdmissionDetail(${a.id})">
      <div class="card-row">
        <label class="adm-select-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox" ${_admSelected.has(a.id) ? 'checked' : ''} onchange="_toggleAdmSelect(${a.id}, this.checked)">
        </label>
        <div class="card-info">
          <div class="card-name">${esc(a.applicant_name_en)} ${a.desired_class ? `<span class="type-tag">${esc(a.desired_class)}</span>` : ''}</div>
          <div class="card-sub">${esc(a.parent_name || 'No parent name')} · Applied ${esc(fmtDate(a.application_date))}</div>
        </div>
        <div class="card-actions">
          <span class="adm-status-badge adm-status-${_admStatusSlug(a.status)}">${esc(a.status)}</span>
          ${_admQuickMoveHtml(a)}
        </div>
      </div>
    </div>
  `).join('');
}

// A small "Move to ▾" dropdown in the card's own corner, so common status
// changes (Accept/Reject/Withdraw/etc.) don't require opening the full
// detail sheet. "Interview Scheduled" is left out here — it needs a date,
// so that one still goes through the detail view.
function _admQuickMoveHtml(a) {
  const options = (ADM_NEXT_STATUSES[a.status] || []).filter(s => s !== 'Interview Scheduled');
  if (!options.length) return '';
  return `
    <details class="adm-move-menu" onclick="event.stopPropagation()" ontoggle="_closeOtherAdmMoveMenus(this)">
      <summary>Move to ▾</summary>
      <div class="adm-move-options">
        ${options.map(s => `<button type="button" onclick="_quickMoveAdmission(${a.id}, '${esc(s)}', this)">${esc(s)}</button>`).join('')}
      </div>
    </details>`;
}

function _closeOtherAdmMoveMenus(openedEl) {
  if (!openedEl.open) return;
  document.querySelectorAll('.adm-move-menu[open]').forEach(d => { if (d !== openedEl) d.removeAttribute('open'); });
}

window._quickMoveAdmission = async function(id, status, btn) {
  const details = btn.closest('details');
  if (details) details.removeAttribute('open');
  try {
    await API.updateAdmissionStatus(id, status);
    showToast(`✓ Moved to ${status}`);
    await renderAdmissions();
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

// Bulk-selection toolbar, shown above the list only once something is
// checked. Statuses offered are the ones every selected applicant can
// reach in common ("Move to Accepted" only appears if ALL selected can go
// there); "Enroll" appears only when every selected item is Accepted and
// not already converted — each is enrolled with ITS OWN desired_class, so
// a teacher accepting/enrolling a whole batch of walk-ins doesn't have to
// open each applicant individually.
function _admSelectionBarHtml(rows) {
  const n = _admSelected.size;
  if (!n) return '';
  const selectedRows = rows.filter(a => _admSelected.has(a.id));

  const statusSets = selectedRows.map(a => new Set((ADM_NEXT_STATUSES[a.status] || []).filter(s => s !== 'Interview Scheduled')));
  const common = statusSets.length
    ? [...statusSets[0]].filter(s => statusSets.every(set => set.has(s)))
    : [];
  const canBulkEnroll = selectedRows.length > 0 && selectedRows.every(a => a.status === 'Accepted' && !a.converted_student_id);

  return `
    <div class="adm-selection-bar">
      <strong>${n} selected</strong>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${common.map(s => `<button type="button" class="pill" onclick="_bulkMoveAdmissions('${esc(s)}')">${esc(s)}</button>`).join('')}
        ${canBulkEnroll ? `<button type="button" class="pill" onclick="_bulkEnrollAdmissions()">Enroll (own class)</button>` : ''}
        <button type="button" class="pill" onclick="_clearAdmSelection()">Clear</button>
      </div>
    </div>`;
}

window._toggleAdmSelect = function(id, checked) {
  if (checked) _admSelected.add(id); else _admSelected.delete(id);
  _renderAdmissionsList();
};

window._clearAdmSelection = function() {
  _admSelected.clear();
  _renderAdmissionsList();
};

window._bulkMoveAdmissions = async function(status) {
  const ids = Array.from(_admSelected);
  if (!ids.length) return;
  showToast(`Moving ${ids.length} to ${status}…`);
  let ok = 0, fail = 0;
  for (const id of ids) {
    try { await API.updateAdmissionStatus(id, status); ok++; } catch (e) { fail++; }
  }
  _admSelected.clear();
  showToast(`✓ ${ok} moved to ${status}${fail ? `, ${fail} failed` : ''}`);
  await renderAdmissions();
};

window._bulkEnrollAdmissions = async function() {
  const ids = Array.from(_admSelected);
  if (!ids.length) return;

  const toEnroll = ids.filter(id => {
    const a = _admissionsAll.find(x => x.id === id);
    return a && a.desired_class;
  });
  const skipped = ids.length - toEnroll.length;
  if (!toEnroll.length) { showToast('None of the selected applicants have a desired class set'); return; }

  showToast(`Enrolling ${toEnroll.length}…${skipped ? ` (${skipped} skipped — no class)` : ''}`);
  let ok = 0, fail = 0;
  for (const id of toEnroll) {
    const a = _admissionsAll.find(x => x.id === id);
    try {
      await API.convertAdmissionToStudent(id, { class: a.desired_class, status: 'Pending' });
      ok++;
    } catch (e) { fail++; }
  }
  _admSelected.clear();
  showToast(`✓ ${ok} enrolled (Pending)${fail ? `, ${fail} failed` : ''}`);
  await renderAdmissions();
};

function _admStatusSlug(s) {
  return String(s).toLowerCase().replace(/\s+/g, '-');
}

/* ─── New applicant ──────────────────────────────────────────────────── */

window.openNewAdmissionModal = function() {
  _admPendingPhotoFile = null;
  _admRemovePhotoRequested = false;
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">New applicant</h3>

      <div class="stu-photo-picker" onclick="document.getElementById('admPhotoInput').click()">
        <div class="stu-photo-circle" id="admPhotoPreview" style="background:${homeColorHex(null)}">${avatarContent({})}</div>
        <div class="stu-photo-edit-badge">📷</div>
      </div>
      <input type="file" id="admPhotoInput" accept="image/*" style="display:none" onchange="_onAdmPhotoPicked(this)">
      <button type="button" class="stu-photo-remove-link" id="admPhotoRemoveBtn" onclick="_removeAdmPhoto()" style="display:none">Remove photo</button>

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
      <button type="button" class="form-picker-trigger" id="naClassBtn" onclick="pickClassValue('naClass')">
        <span class="form-picker-value" id="naClass_label">Select class</span>
        <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <input type="hidden" id="naClass" value="">

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

window._onAdmPhotoPicked = function(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please pick an image file'); return; }
  if (file.size > 3 * 1024 * 1024) { showToast('Photo must be under 3MB'); return; }

  _admPendingPhotoFile = file;
  _admRemovePhotoRequested = false;
  const reader = new FileReader();
  reader.onload = () => {
    const preview = document.getElementById('admPhotoPreview');
    if (preview) preview.innerHTML = `<img src="${reader.result}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">`;
  };
  const removeBtn = document.getElementById('admPhotoRemoveBtn');
  if (removeBtn) removeBtn.style.display = '';
  reader.readAsDataURL(file);
};

window._removeAdmPhoto = function() {
  _admPendingPhotoFile = null;
  _admRemovePhotoRequested = true;
  const preview = document.getElementById('admPhotoPreview');
  if (preview) preview.innerHTML = avatarContent({ gender: document.querySelector('#naGenderPills .pill.active')?.textContent.trim() });
  const removeBtn = document.getElementById('admPhotoRemoveBtn');
  if (removeBtn) removeBtn.style.display = 'none';
  const input = document.getElementById('admPhotoInput');
  if (input) input.value = '';
};

window._saveNewAdmission = async function() {
  const nameEn = document.getElementById('naNameEn').value.trim();
  if (!nameEn) { showToast('Enter the applicant\'s name'); return; }

  const parentEmail = document.getElementById('naParentEmail').value.trim();
  if (parentEmail && !isValidEmail(parentEmail)) { showToast('Enter a valid parent email'); return; }

  const btn = document.getElementById('naSaveBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    const res = await API.createAdmission({
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

    if (_admPendingPhotoFile && res.admission?.id) {
      try {
        const url = await API.uploadAdmissionPhoto(res.admission.id, _admPendingPhotoFile);
        await API.setAdmissionPhoto(res.admission.id, url);
      } catch (photoErr) {
        showToast('Added, but photo upload failed: ' + (photoErr.message || 'error'));
      }
      _admPendingPhotoFile = null;
    }

    closeModal();
    showToast('✓ Applicant added');
    await renderAdmissions();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add applicant';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Detail (single modal — all sub-views swap #admDetailBody in place) ── */

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
  // Don't wipe to a skeleton here — this runs both on first open (the modal
  // already shows a skeleton until this resolves) and as a quiet refresh
  // after an action (Cancel, Save, status change), where clearing existing
  // content first just causes a visible blank-box flash for no reason.
  try {
    const res = await API.getAdmissionDetail(id);
    await _renderAdmDetailView(res.admission);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
  }
}

async function _renderAdmDetailView(a) {
  const el = document.getElementById('admDetailBody');
  if (!el) return;

  // If already converted, fetch the linked student (Pending or Active) and,
  // if a registration invoice is linked, its current status — in parallel,
  // so the billing-gate step shows without two sequential round trips.
  const [student, invoice] = await Promise.all([
    a.converted_student_id
      ? API.getStudentById(a.converted_student_id).then(r => r.student).catch(() => null)
      : Promise.resolve(null),
    a.registration_invoice_id
      ? API.getInvoiceDetail(a.registration_invoice_id).then(r => r.invoice).catch(() => null)
      : Promise.resolve(null),
  ]);

  el.innerHTML = _admDetailHtml(a, student, invoice);
}

function _admDetailHtml(a, student, invoice) {
  const nextStatuses = ADM_NEXT_STATUSES[a.status] || [];
  const photoHtml = avatarContent({ photo_url: a.applicant_photo_url, gender: a.gender, name_en: a.applicant_name_en });

  return `
    <div class="stu-photo-circle" style="margin:0 auto 10px;background:${homeColorHex(null)}">${photoHtml}</div>
    <h3 class="modal-title mb0" style="text-align:center">${esc(a.applicant_name_en)}</h3>
    <p style="text-align:center"><span class="adm-status-badge adm-status-${_admStatusSlug(a.status)}">${esc(a.status)}</span></p>

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

    ${nextStatuses.length ? `
      <div class="billing-section-title mt16">Move to</div>
      <div class="pill-group">
        ${nextStatuses.map(s => `<button type="button" class="pill" onclick="_moveAdmissionStatus(${a.id}, '${esc(s)}')">${esc(s)}</button>`).join('')}
      </div>
    ` : ''}

    ${a.status === 'Accepted' && !a.converted_student_id ? `
      <button class="btn-primary mt16" onclick="_showConvertAdmissionView(${a.id}, '${esc((a.desired_class || '').replace(/'/g, "\\'"))}')">Enroll as student</button>
    ` : ''}

    ${student ? _admEnrollmentSectionHtml(a, student, invoice) : ''}

    <button class="btn-secondary mt16" onclick="_showEditAdmissionView(${a.id})">Edit details</button>
    <button class="btn-secondary" onclick="_confirmDeleteAdmission(${a.id})">Delete applicant</button>
  `;
}

function _admEnrollmentSectionHtml(a, student, invoice) {
  if (student.status === 'Active') {
    return `
      <div class="billing-section-title mt16">Enrollment</div>
      <p class="billing-notes">✓ Official student — ID <strong>${esc(student.student_id)}</strong>, class ${esc(student.class || '—')}. Visible in the Students list.</p>`;
  }

  // Pending — not yet official.
  let body = `
    <div class="billing-section-title mt16">Enrollment</div>
    <p class="billing-notes">Student record created (ID <strong>${esc(student.student_id)}</strong>) but marked <em>Pending</em> — hidden from the Students list until the registration fee is paid.</p>`;

  if (!invoice) {
    body += `<button class="btn-primary" onclick="_showRegistrationInvoiceView(${a.id}, '${esc(student.student_id)}')">Create registration invoice</button>`;
  } else {
    const balance = Number(invoice.total_amount) - Number(invoice.paid_amount);
    if (invoice.status === 'Paid') {
      body += `
        <p class="billing-notes">Registration invoice ${esc(invoice.invoice_number || '')} — <strong>Paid</strong>.</p>
        <button class="btn-primary" onclick="_activatePendingStudent(${a.id}, '${esc(student.student_id)}')">Activate — make official student</button>`;
    } else {
      body += `
        <p class="billing-notes">Registration invoice ${esc(invoice.invoice_number || '')} — ${esc(invoice.status)}, balance ${esc(String(balance))}. Record the payment on the Billing page, then come back here to activate.</p>
        <button class="btn-secondary" onclick="closeModal();goToPage('billing')">Go to Billing</button>`;
    }
  }
  return body;
}

window._moveAdmissionStatus = async function(id, status) {
  if (status === 'Interview Scheduled') {
    _showInterviewDateView(id);
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

function _showInterviewDateView(id) {
  const el = document.getElementById('admDetailBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title">Schedule interview</h3>
    <label class="field-label">Interview date</label>
    <input class="form-input" id="admInterviewDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
    <button class="btn-primary mt16" onclick="_saveInterviewDate(${id})">Save</button>
    <button class="btn-secondary" onclick="_loadAdmissionDetail(${id})">Cancel</button>
  `;
}

window._saveInterviewDate = async function(id) {
  const date = document.getElementById('admInterviewDate').value || null;
  try {
    await API.updateAdmissionStatus(id, 'Interview Scheduled', { interview_date: date });
    showToast('✓ Interview scheduled');
    await _loadAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._showEditAdmissionView = async function(id) {
  const el = document.getElementById('admDetailBody');
  if (!el) return;
  el.innerHTML = skeletonCards(1);

  let a;
  try {
    a = (await API.getAdmissionDetail(id)).admission;
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  _admPendingPhotoFile = null;
  _admRemovePhotoRequested = false;

  el.innerHTML = `
    <h3 class="modal-title">Edit applicant</h3>

    <div class="stu-photo-picker" onclick="document.getElementById('admPhotoInput').click()">
      <div class="stu-photo-circle" id="admPhotoPreview" style="background:${homeColorHex(null)}">${avatarContent({ photo_url: a.applicant_photo_url, gender: a.gender, name_en: a.applicant_name_en })}</div>
      <div class="stu-photo-edit-badge">📷</div>
    </div>
    <input type="file" id="admPhotoInput" accept="image/*" style="display:none" onchange="_onAdmPhotoPicked(this)">
    <button type="button" class="stu-photo-remove-link" id="admPhotoRemoveBtn" onclick="_removeAdmPhoto()" style="${a.applicant_photo_url ? '' : 'display:none'}">Remove photo</button>

    <label class="field-label">Name (English)</label>
    <input class="form-input" id="eaNameEn" value="${esc(a.applicant_name_en)}">
    <label class="field-label">Name (local)</label>
    <input class="form-input" id="eaNameLocal" value="${esc(a.applicant_name_local || '')}">
    <label class="field-label">Date of birth</label>
    <input class="form-input" id="eaDob" type="date" value="${a.date_of_birth || ''}">
    <label class="field-label">Desired class</label>
    <button type="button" class="form-picker-trigger" id="eaClassBtn" onclick="pickClassValue('eaClass')">
      <span class="form-picker-value" id="eaClass_label">${a.desired_class ? esc(a.desired_class) : 'Select class'}</span>
      <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <input type="hidden" id="eaClass" value="${esc(a.desired_class || '')}">
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
    <button class="btn-secondary" onclick="_loadAdmissionDetail(${id})">Cancel</button>
  `;
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

    if (_admPendingPhotoFile) {
      try {
        const url = await API.uploadAdmissionPhoto(id, _admPendingPhotoFile);
        await API.setAdmissionPhoto(id, url);
      } catch (photoErr) {
        showToast('Saved, but photo upload failed: ' + (photoErr.message || 'error'));
      }
      _admPendingPhotoFile = null;
    } else if (_admRemovePhotoRequested) {
      try { await API.setAdmissionPhoto(id, null); } catch (photoErr) { /* non-fatal */ }
      _admRemovePhotoRequested = false;
    }

    showToast('✓ Saved');
    await _loadAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save changes';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Convert to student (Pending) ──────────────────────────────────────── */

window._showConvertAdmissionView = function(id, desiredClass) {
  const el = document.getElementById('admDetailBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title">Enroll as student</h3>
    <p class="billing-notes">Creates a student record (Pending) from this applicant's details. It stays hidden from the Students list until the registration fee is paid and you activate it.</p>
    <label class="field-label">Class</label>
    <button type="button" class="form-picker-trigger" id="convClassBtn" onclick="pickClassValue('convClass')">
      <span class="form-picker-value" id="convClass_label">${desiredClass ? esc(desiredClass) : 'Select class'}</span>
      <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <input type="hidden" id="convClass" value="${esc(desiredClass || '')}">
    <button class="btn-primary mt16" id="convSaveBtn" onclick="_saveConvertAdmission(${id})">Enroll</button>
    <button class="btn-secondary" onclick="_loadAdmissionDetail(${id})">Cancel</button>
  `;
};

window._saveConvertAdmission = async function(id) {
  const cls = document.getElementById('convClass').value.trim();
  if (!cls) { showToast('Enter a class'); return; }

  const btn = document.getElementById('convSaveBtn');
  btn.disabled = true; btn.textContent = 'Enrolling…';
  try {
    const res = await API.convertAdmissionToStudent(id, { class: cls, status: 'Pending' });
    showToast(`✓ Student record created — ${res.student.student_id} (Pending)`);
    await _loadAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Enroll';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Registration invoice + activation ─────────────────────────────────── */

window._showRegistrationInvoiceView = function(id, studentId) {
  const el = document.getElementById('admDetailBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title">Registration invoice</h3>
    <label class="field-label">Amount</label>
    <input class="form-input" id="riAmount" type="number" min="0" value="0">
    <label class="field-label">Due date</label>
    <input class="form-input" id="riDueDate" type="date">
    <button class="btn-primary mt16" id="riSaveBtn" onclick="_saveRegistrationInvoice(${id}, '${esc(studentId)}')">Create invoice</button>
    <button class="btn-secondary" onclick="_loadAdmissionDetail(${id})">Cancel</button>
  `;
};

window._saveRegistrationInvoice = async function(id, studentId) {
  const amount = Number(document.getElementById('riAmount').value);
  if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }

  const btn = document.getElementById('riSaveBtn');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    // Default to the current term, same as the Billing page's own new-invoice
    // flow — Billing's invoice list filters by term (defaulting to the
    // current one), so an invoice created with no term_id would silently
    // never show up there.
    let termId = null;
    try {
      const terms = await API.getTerms();
      const current = (terms || []).find(t => t.is_current) || (terms || [])[0];
      termId = current?.id || null;
    } catch (e) { /* no terms configured — leave unset */ }

    const invRes = await API.createInvoice({
      student_id: studentId,
      term_id:    termId,
      due_date:   document.getElementById('riDueDate').value || null,
      notes:      'Registration fee',
      items:      [{ fee_item_id: null, description: 'Registration fee', amount }],
    });
    await API.linkAdmissionInvoice(id, invRes.invoice.id);
    showToast('✓ Registration invoice created');
    await _loadAdmissionDetail(id);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Create invoice';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._activatePendingStudent = async function(id, studentId) {
  try {
    await API.activateStudent(studentId);
    showToast(`✓ ${studentId} is now an official student`);
    if (typeof API.getStudents === 'function' && window.APP) {
      window.APP.students = await API.getStudents().catch(() => window.APP.students);
      if (typeof renderStudents === 'function') renderStudents();
    }
    await _loadAdmissionDetail(id);
    await renderAdmissions();
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Delete ─────────────────────────────────────────────────────────────── */

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
