/**
 * SCMS v11 — 04_students.js
 * Student roster: list, search, filter by class, add/edit/view, parent deep-link.
 *
 * NEW in v11:
 *   • Tap card → opens RICH detail view with EDIT button (was read-only)
 *   • Add-student form gains: birthday, parent email, home colour
 *   • Parent TG ID is captured AUTOMATICALLY via a deep-link the teacher shares
 *     with the parent — no more manual ID entry
 *   • All previous logic preserved (search, class chip filter, etc.)
 */

'use strict';

let _stuClass  = 'All';
let _stuSearch = '';
let _parentLinkPollTimer = null;   // polls server after registering a student

function renderStudents() {
  _renderStudentStats();
  _renderClassChips();
  _renderStudentList();
}

// ─── Stats ────────────────────────────────────────────────────────────────

function _renderStudentStats() {
  const el = document.getElementById('studentStats');
  if (!el) return;

  const active   = window.APP.students.filter(s => s.status === 'Active').length;
  const classes  = new Set(window.APP.students.map(s => s.class).filter(Boolean)).size;
  const today    = new Date().toISOString().slice(0, 10);
  const presents = window.APP.attendance.filter(a => a.date === today && a.status === 'P').length;

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-num">${active}</div>
      <div class="stat-lbl">Students</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${classes}</div>
      <div class="stat-lbl">Classes</div>
    </div>
    <div class="stat-card green">
      <div class="stat-num">${presents}</div>
      <div class="stat-lbl">Here today</div>
    </div>
  `;

  const subtitle = document.getElementById('studentsSubtitle');
  if (subtitle) subtitle.textContent =
    `${active} active student${active !== 1 ? 's' : ''} across ${classes} class${classes !== 1 ? 'es' : ''}`;
}

// ─── Class filter chips ────────────────────────────────────────────────────

function _renderClassChips() {
  const el = document.getElementById('classChips');
  if (!el) return;

  const classes = ['All', ...[...new Set(
    window.APP.students.filter(s => s.status === 'Active').map(s => s.class).filter(Boolean)
  )].sort()];

  el.innerHTML = classes.map(c =>
    `<button class="chip${c === _stuClass ? ' active' : ''}" data-class="${esc(c)}" onclick="filterStuClass('${esc(c)}')">${esc(c)}</button>`
  ).join('');
}

window.filterStuClass = function(cls) {
  _stuClass = cls;
  document.querySelectorAll('#classChips .chip').forEach(b =>
    b.classList.toggle('active', b.dataset.class === cls)
  );
  _renderStudentList();
};

// ─── Search ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('studentSearchInput');
  const clear = document.getElementById('studentSearchClear');
  if (!input) return;

  input.addEventListener('input', () => {
    _stuSearch = input.value.trim().toLowerCase();
    clear.style.display = _stuSearch ? 'flex' : 'none';
    _renderStudentList();
  });

  clear.addEventListener('click', () => {
    input.value = '';
    _stuSearch  = '';
    clear.style.display = 'none';
    _renderStudentList();
  });
});

// ─── Student list ──────────────────────────────────────────────────────────

function _renderStudentList() {
  const el = document.getElementById('studentList');
  if (!el) return;

  let list = window.APP.students.filter(s => s.status === 'Active');

  if (_stuClass !== 'All') {
    list = list.filter(s => s.class === _stuClass);
  }
  if (_stuSearch) {
    list = list.filter(s =>
      (s.name_en    || '').toLowerCase().includes(_stuSearch) ||
      (s.name_local || '').toLowerCase().includes(_stuSearch) ||
      (s.student_id || '').toLowerCase().includes(_stuSearch) ||
      (s.class      || '').toLowerCase().includes(_stuSearch)
    );
  }

  if (!list.length) {
    el.innerHTML = emptyState('👥', 'No students found',
      _stuSearch ? 'Try a different search term' : 'Tap + to add a student');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  el.innerHTML = list.map(s => {
    const att = window.APP.attendance.find(
      a => a.date === today && a.student_id === s.student_id
    );
    const attCode  = att?.status || '—';
    const attColor = attCode === '—' ? '#999' : attendCodeColor(attCode);
    const attLabel = attCode === '—' ? 'Not marked' : attendCodeLabel(attCode);
    const homeHex  = s.home_color ? homeColorHex(s.home_color) : _classColor(s.class);
    const bdayDays = daysUntilBirthday(s.date_of_birth);
    const bdaySoon = bdayDays !== null && bdayDays <= 7;

    return `
      <div class="list-card stu-card" onclick="openStudentDetail('${esc(s.student_id)}')">
        <div class="card-row">
          <div class="card-avatar" style="background:${homeHex}">${esc((s.name_en||'?')[0])}</div>
          <div class="card-info">
            <div class="card-name">
              ${esc(s.name_en || s.name_local || s.student_id)}
              ${bdaySoon ? `<span class="bday-pill" title="Birthday in ${bdayDays} day${bdayDays!==1?'s':''}">🎂 ${bdayDays === 0 ? 'Today!' : bdayDays + 'd'}</span>` : ''}
            </div>
            <div class="card-sub">
              <span class="class-tag">${esc(s.class || '—')}</span>
              ${s.name_local && s.name_local !== s.name_en
                ? `<span class="name-local">${esc(s.name_local)}</span>` : ''}
              ${s.home_color ? `<span class="home-dot" style="background:${homeHex}" title="Home: ${esc(homeColorName(s.home_color))}"></span>` : ''}
            </div>
          </div>
          <span class="att-pill" style="--pill-color:${attColor}" title="${esc(attLabel)}">${esc(attCode)}</span>
        </div>
        ${s.parent_name ? `<div class="card-parent">👤 ${esc(s.parent_name)}${s.parent_phone ? ' · ' + esc(s.parent_phone) : ''}${s.parent_tg_id ? ' · <span class="tg-linked">✓ TG linked</span>' : ''}</div>` : ''}
      </div>`;
  }).join('');
}

function _classColor(cls) {
  const colors = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626','#7C3AED','#DB2777'];
  if (!cls) return colors[0];
  return colors[cls.charCodeAt(0) % colors.length];
}

// ─── Student detail (rich view with Edit button) ──────────────────────────

window.openStudentDetail = function(studentId) {
  const s = window.APP.students.find(x => x.student_id === studentId);
  if (!s) return;

  const reports   = window.APP.dailyReports.filter(r => r.student_id === studentId).slice(0, 5);
  const incidents = window.APP.incidents.filter(i => i.student_id === studentId).slice(0, 3);
  const homeHex   = s.home_color ? homeColorHex(s.home_color) : _classColor(s.class);
  const age       = computeAge(s.date_of_birth);

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="detail-header">
        <div class="detail-avatar" style="background:${homeHex}">${esc((s.name_en||'?')[0])}</div>
        <div style="flex:1; min-width:0;">
          <h3 class="modal-title mb0">${esc(s.name_en || s.name_local || '—')}</h3>
          ${s.name_local && s.name_local !== s.name_en ? `<div class="detail-local">${esc(s.name_local)}</div>` : ''}
          <div class="detail-meta">
            <span class="class-tag">${esc(s.class || '—')}</span>
            <span class="id-tag">${esc(s.student_id)}</span>
            ${s.home_color ? `<span class="home-tag" style="background:${homeHex}20;color:${homeHex}">● ${esc(homeColorName(s.home_color))}</span>` : ''}
          </div>
        </div>
        <button class="icon-btn-edit" onclick="openEditStudentModal('${esc(s.student_id)}')" title="Edit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
      </div>

      <div class="detail-grid">
        ${_detailRow('Gender',   s.gender || '—')}
        ${_detailRow('Grade',    s.grade  || '—')}
        ${_detailRow('Birthday', s.date_of_birth ? `${fmtDateLong(s.date_of_birth)}${age != null ? ' · ' + age + ' yrs' : ''}` : '—')}
        ${_detailRow('Home',     s.home_color ? homeColorName(s.home_color) : '—')}
        ${_detailRow('Parent',        s.parent_name  || '—')}
        ${_detailRow('Parent phone',  s.parent_phone || '—')}
        ${_detailRow('Parent email',  s.parent_email || '—')}
        ${_detailRow('Parent Telegram', s.parent_tg_id
          ? `<span class="tg-linked">✓ Linked</span>`
          : `<button class="link-btn-inline" onclick="showParentLinkQR('${esc(s.student_id)}')">Get link →</button>`)}
      </div>

      ${reports.length ? `
        <div class="detail-section">Recent reports</div>
        ${reports.map(r => `
          <div class="mini-card">${esc(r.date)} · ${esc(r.mood || '—')} · Meal: ${esc(r.meal || '—')}</div>`).join('')}
      ` : ''}

      ${incidents.length ? `
        <div class="detail-section">Recent incidents</div>
        ${incidents.map(i => `
          <div class="mini-card incident-card">${esc(i.date)} · ${esc(i.type)} · ${esc(i.severity)}</div>`).join('')}
      ` : ''}

      <button class="btn-primary mt16" onclick="openEditStudentModal('${esc(s.student_id)}')">
        Edit student info
      </button>
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>`;

  openModal(html);
};

function _detailRow(label, value) {
  return `<div class="detail-row"><span class="detail-lbl">${esc(label)}</span><span class="detail-val">${value}</span></div>`;
}

// ─── Add student modal (with new fields) ──────────────────────────────────

window.openAddStudentModal = function() {
  _openStudentForm({ mode: 'add' });
};

window.openEditStudentModal = function(studentId) {
  const s = window.APP.students.find(x => x.student_id === studentId);
  if (!s) { showToast('Student not found'); return; }
  _openStudentForm({ mode: 'edit', student: s });
};

function _openStudentForm({ mode, student }) {
  const isEdit  = mode === 'edit';
  const s       = student || {};
  const grades  = window.getGradeList();
  const classes = window.getClassList();
  const colors  = window.HOME_COLORS;

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${isEdit ? 'Edit Student' : 'Add New Student'}</h3>

      <label class="field-label">Local name (Myanmar / native)</label>
      <input class="form-input" id="newStuLocal" placeholder="ကျောင်းသားနာမည်…" value="${esc(s.name_local || '')}">

      <label class="field-label">English name *</label>
      <input class="form-input" id="newStuEn" placeholder="Full English name" value="${esc(s.name_en || '')}">

      <div class="form-row">
        <div class="form-col">
          <label class="field-label">Class *</label>
          <button type="button" class="form-picker-trigger" id="newStuClassBtn"
                  onclick="pickClassValue('newStuClass')">
            <span class="form-picker-value" id="newStuClass_label">${s.class ? esc(s.class) : 'Select class'}</span>
            <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <input type="hidden" id="newStuClass" value="${esc(s.class || '')}">
        </div>
        <div class="form-col">
          <label class="field-label">Grade</label>
          <button type="button" class="form-picker-trigger" id="newStuGradeBtn"
                  onclick="pickGradeValue('newStuGrade')">
            <span class="form-picker-value" id="newStuGrade_label">${s.grade ? esc(s.grade) : 'Select grade'}</span>
            <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <input type="hidden" id="newStuGrade" value="${esc(s.grade || '')}">
        </div>
      </div>

      <label class="field-label">Gender</label>
      <div class="pill-group" id="genderPills">
        <button class="pill ${s.gender === 'M' ? 'active' : ''}" type="button" onclick="togglePill(this,'genderPills')">M</button>
        <button class="pill ${s.gender === 'F' ? 'active' : ''}" type="button" onclick="togglePill(this,'genderPills')">F</button>
        <button class="pill ${s.gender === 'Other' ? 'active' : ''}" type="button" onclick="togglePill(this,'genderPills')">Other</button>
      </div>

      <label class="field-label">Birthday <span class="optional">(used for 🎂 reminders)</span></label>
      <input class="form-input" id="newStuDob" type="date" value="${esc(s.date_of_birth || '')}" max="${new Date().toISOString().slice(0,10)}">

      <label class="field-label">Home colour <span class="optional">(team / house)</span></label>
      <div class="color-grid" id="colorGrid">
        ${colors.map(c => `
          <button type="button" class="color-swatch ${s.home_color === c.id ? 'active' : ''}"
            data-color="${esc(c.id)}"
            style="--swatch:${c.hex}"
            title="${esc(c.name)}"
            onclick="selectHomeColor('${esc(c.id)}')">
            <span class="swatch-dot"></span>
            <span class="swatch-name">${esc(c.name)}</span>
          </button>`).join('')}
      </div>
      <input type="hidden" id="newStuColor" value="${esc(s.home_color || '')}">

      <div class="form-divider"><span>Parent / Guardian</span></div>

      <label class="field-label">Parent name</label>
      <input class="form-input" id="newStuParent" placeholder="Parent / guardian name" value="${esc(s.parent_name || '')}">

      <label class="field-label">Parent phone</label>
      <input class="form-input" id="newStuPhone" type="tel" placeholder="+95 9 xxx xxx xxx" value="${esc(s.parent_phone || '')}">

      <label class="field-label">Parent email <span class="optional">(optional)</span></label>
      <input class="form-input" id="newStuEmail" type="email" placeholder="parent@example.com" value="${esc(s.parent_email || '')}">

      ${isEdit
        ? `<label class="field-label">Parent Telegram</label>
           <div class="parent-tg-row">
             ${s.parent_tg_id
                ? `<div class="tg-linked-box">✓ Linked &nbsp;<code>${esc(s.parent_tg_id)}</code></div>`
                : `<button type="button" class="link-btn" onclick="showParentLinkQR('${esc(s.student_id)}')">📤 Send link to parent</button>`}
           </div>`
        : `<div class="info-tip">
             <span class="info-tip-icon">ℹ️</span>
             <span>Parent Telegram ID is filled <b>automatically</b> after you register the student. We'll show you a link to share with the parent — once they tap it in Telegram, their ID will be captured.</span>
           </div>`
      }

      <button class="btn-primary mt16" id="saveStudentBtn" onclick="saveStudentForm('${isEdit ? 'edit' : 'add'}','${isEdit ? esc(s.student_id) : ''}')">
        ${isEdit ? 'Save changes' : 'Register Student'}
      </button>
      ${isEdit ? `
        <button class="btn-danger" onclick="confirmDeleteStudent('${esc(s.student_id)}')">
          Remove student
        </button>` : ''}
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;

  openModal(html);
}

window.selectHomeColor = function(colorId) {
  document.querySelectorAll('#colorGrid .color-swatch').forEach(b => {
    b.classList.toggle('active', b.dataset.color === colorId);
  });
  const hidden = document.getElementById('newStuColor');
  if (hidden) hidden.value = colorId;
};

window.saveStudentForm = async function(mode, studentId) {
  const btn = document.getElementById('saveStudentBtn');

  const data = {
    name_local:   document.getElementById('newStuLocal').value.trim(),
    name_en:      document.getElementById('newStuEn').value.trim(),
    class:        document.getElementById('newStuClass').value.trim(),
    grade:        document.getElementById('newStuGrade').value,
    gender:       document.querySelector('#genderPills .pill.active')?.textContent.trim() || '',
    date_of_birth: document.getElementById('newStuDob').value || null,
    home_color:   document.getElementById('newStuColor').value || null,
    parent_name:  document.getElementById('newStuParent').value.trim(),
    parent_phone: document.getElementById('newStuPhone').value.trim(),
    parent_email: document.getElementById('newStuEmail').value.trim(),
  };
  // name_mm kept as a copy of name_local for backward compatibility with the original schema
  data.name_mm = data.name_local || data.name_en;

  // Validation
  if (!data.name_en)  { showToast('English name is required'); return; }
  if (!data.class)    { showToast('Class is required'); return; }
  if (data.parent_email && !isValidEmail(data.parent_email)) {
    showToast('Parent email looks invalid'); return;
  }
  if (data.parent_phone && !isValidPhone(data.parent_phone)) {
    showToast('Parent phone looks invalid'); return;
  }

  btn.disabled = true;
  btn.textContent = mode === 'edit' ? 'Saving…' : 'Registering…';

  try {
    if (mode === 'edit') {
      await API.updateStudent(studentId, data);
      // Update local cache
      const idx = window.APP.students.findIndex(x => x.student_id === studentId);
      if (idx >= 0) {
        window.APP.students[idx] = { ...window.APP.students[idx], ...data };
      }
      closeModal();
      renderStudents();
      showToast(`✓ ${data.name_en} updated`);
      if (window.APP.tg?.HapticFeedback) window.APP.tg.HapticFeedback.notificationOccurred('success');
    } else {
      const result = await API.registerStudent({
        ...data,
        school_id:    window.APP.school_id,
        teacher_id:   window.APP.teacher_id,
      });

      const newStudent = result?.student || result?.data || {
        student_id: result?.student_id || `STU-${Date.now()}`,
        ...data,
        status: 'Active',
        school_id: window.APP.school_id,
      };

      window.APP.students.push(newStudent);

      // After registering, immediately show the parent-link QR / share screen
      _showParentLinkAfterRegister(newStudent);

      renderStudents();
      showToast(`✓ ${data.name_en} registered`);
      if (window.APP.tg?.HapticFeedback) window.APP.tg.HapticFeedback.notificationOccurred('success');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = mode === 'edit' ? 'Save changes' : 'Register Student';
    showToast((mode === 'edit' ? 'Save' : 'Registration') + ' failed: ' + (e.message || 'Network error'));
  }
};

window.confirmDeleteStudent = function(studentId) {
  const s = window.APP.students.find(x => x.student_id === studentId);
  if (!s) return;

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Remove ${esc(s.name_en)}?</h3>
      <p style="color:var(--muted); font-size:14px; line-height:1.6">
        This will mark the student as <b>Inactive</b>. Their records (attendance, reports) are kept, but they won't appear in daily lists. You can ask an admin to restore them later.
      </p>
      <button class="btn-danger mt16" onclick="doDeleteStudent('${esc(studentId)}')">Yes, remove</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;
  openModal(html);
};

window.doDeleteStudent = async function(studentId) {
  try {
    await API.deleteStudent(studentId);
    const idx = window.APP.students.findIndex(x => x.student_id === studentId);
    if (idx >= 0) window.APP.students[idx].status = 'Inactive';
    closeModal();
    renderStudents();
    showToast('✓ Student removed');
  } catch (e) {
    showToast('Failed: ' + (e.message || 'Network error'));
  }
};

// ─── Parent linking via deep-link ─────────────────────────────────────────

/** After registering, show the share-link screen so the teacher can forward
 *  the deep-link to the parent (via Telegram, SMS, WhatsApp, etc.). */
function _showParentLinkAfterRegister(student) {
  const url = buildParentLinkURL(student.student_id);
  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Link parent's Telegram</h3>
      <p style="color:var(--muted); font-size:14px; line-height:1.6; margin-bottom:16px;">
        Share this link with <b>${esc(student.name_en)}</b>'s parent. When the parent taps it in Telegram, our bot will capture their ID and link it to this student — automatically.
      </p>

      <div class="link-box">
        <code id="parentLinkUrl">${esc(url)}</code>
      </div>

      <div class="link-actions">
        <button class="btn-primary" onclick="copyParentLink('${esc(url)}')">📋 Copy link</button>
        ${isTWA() ? `<button class="btn-secondary" onclick="shareParentLinkInTelegram('${esc(url)}','${esc(student.name_en)}')">📤 Share via Telegram</button>` : ''}
      </div>

      <div class="link-status" id="linkStatus">
        <div class="link-status-dot"></div>
        <span id="linkStatusText">Waiting for parent to tap the link…</span>
      </div>

      <button class="btn-secondary mt16" onclick="dismissParentLink()">Done — I'll share later</button>
    </div>`;

  openModal(html, () => {
    if (_parentLinkPollTimer) { clearInterval(_parentLinkPollTimer); _parentLinkPollTimer = null; }
  });

  // Poll the server every 5s to see if the parent has linked
  _parentLinkPollTimer = setInterval(async () => {
    try {
      const result = await API.checkParentLink(student.student_id);
      if (result?.parent_tg_id) {
        // Linked! Update student in cache
        const idx = window.APP.students.findIndex(x => x.student_id === student.student_id);
        if (idx >= 0) {
          window.APP.students[idx].parent_tg_id = result.parent_tg_id;
          if (result.parent_name && !window.APP.students[idx].parent_name) {
            window.APP.students[idx].parent_name = result.parent_name;
          }
        }
        const statusEl = document.getElementById('linkStatusText');
        if (statusEl) {
          statusEl.innerHTML = `✓ <b>Linked!</b> Parent ID: <code>${esc(result.parent_tg_id)}</code>`;
          document.getElementById('linkStatus').classList.add('linked');
        }
        clearInterval(_parentLinkPollTimer);
        _parentLinkPollTimer = null;
        renderStudents();
      }
    } catch (_e) { /* keep polling silently */ }
  }, 5000);
}

window.dismissParentLink = function() {
  if (_parentLinkPollTimer) { clearInterval(_parentLinkPollTimer); _parentLinkPollTimer = null; }
  closeModal();
};

window.copyParentLink = function(url) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => showToast('✓ Link copied'),
      () => _fallbackCopy(url)
    );
  } else {
    _fallbackCopy(url);
  }
};

function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('✓ Link copied'); }
  catch { showToast('Copy failed — long-press to copy manually'); }
  document.body.removeChild(ta);
}

window.shareParentLinkInTelegram = function(url, studentName) {
  const text = `Hi! Please tap this link in Telegram to receive updates about ${studentName} from school:`;
  if (window.APP.tg?.openTelegramLink) {
    // Use TG's native share — opens forward dialog
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.APP.tg.openTelegramLink(shareUrl);
  } else {
    copyParentLink(url);
  }
};

/** Show the parent-link sheet on demand (from detail view's "Get link" button) */
window.showParentLinkQR = function(studentId) {
  const s = window.APP.students.find(x => x.student_id === studentId);
  if (!s) return;
  closeModal();
  setTimeout(() => _showParentLinkAfterRegister(s), 250);
};

/* ─── Class / Grade value pickers (bottom sheet) ────────────────────── */

window.pickClassValue = function(targetInputId) {
  _openValuePicker({
    title:   'Select class',
    items:   window.getClassList(),
    current: document.getElementById(targetInputId)?.value || '',
    onPick:  (v) => _setValueAndLabel(targetInputId, v),
    addLabel: 'Add new class',
    onAdd:    (newVal) => {
      _setValueAndLabel(targetInputId, newVal);
      _persistConfigList('classes', newVal);
    },
    allowEditList: true,
    listKey: 'classes',
  });
};

window.pickGradeValue = function(targetInputId) {
  _openValuePicker({
    title:   'Select grade',
    items:   window.getGradeList(),
    current: document.getElementById(targetInputId)?.value || '',
    onPick:  (v) => _setValueAndLabel(targetInputId, v),
    addLabel: 'Add new grade',
    onAdd:    (newVal) => {
      _setValueAndLabel(targetInputId, newVal);
      _persistConfigList('grades', newVal);
    },
    allowEditList: true,
    listKey: 'grades',
  });
};

function _setValueAndLabel(targetInputId, v) {
  const input = document.getElementById(targetInputId);
  const label = document.getElementById(targetInputId + '_label');
  if (input) input.value = v;
  if (label) label.textContent = v || 'Select…';
  closeModal();
}

function _openValuePicker({ title, items, current, onPick, addLabel, onAdd, allowEditList, listKey }) {
  const itemsHtml = items.length
    ? items.map(v => `
        <button type="button" class="vp-row ${v === current ? 'sel' : ''}" onclick="_vpPick('${esc(v)}')">
          <span class="vp-label">${esc(v)}</span>
          ${v === current ? '<span class="vp-check">✓</span>' : ''}
          ${allowEditList && window.APP.is_admin ? `<button class="vp-delete" onclick="event.stopPropagation(); _vpDeleteFromList('${esc(listKey)}','${esc(v)}')" aria-label="Remove" title="Remove from list">×</button>` : ''}
        </button>`).join('')
    : `<div class="vp-empty">No options yet — add one below</div>`;

  openModal(`
    <div class="modal-sheet vp-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${esc(title)}</h3>
      <div class="vp-list">${itemsHtml}</div>
      ${addLabel ? `
        <div class="vp-add-row">
          <input type="text" class="form-input" id="vpAddInput" placeholder="${esc(addLabel)} (e.g. P4 Online)" maxlength="20">
          <button class="btn-primary" onclick="_vpAddItem()">Add</button>
        </div>` : ''}
      <button class="btn-secondary mt16" onclick="closeModal()">Cancel</button>
    </div>
  `);
  window._vpPick = onPick;
  window._vpOnAdd = onAdd;
}

window._vpAddItem = function() {
  const input = document.getElementById('vpAddInput');
  const v = (input?.value || '').trim();
  if (!v) { showToast('Type a name first'); return; }
  if (typeof window._vpOnAdd === 'function') window._vpOnAdd(v);
};

window._vpDeleteFromList = async function(listKey, value) {
  if (!confirm(`Remove "${value}" from the ${listKey} list?\n\nExisting students in this ${listKey.slice(0,-2)} are not affected.`)) return;
  const cfg = window.APP.config || {};
  const cur = Array.isArray(cfg[listKey]) ? cfg[listKey] : window[listKey === 'classes' ? 'getClassList' : 'getGradeList']();
  const updated = cur.filter(x => x !== value);
  cfg[listKey] = updated;
  showToast('Saving…');
  try {
    await twaPost('update_school_config', {
      school_id: window.APP.school_id,
      patch: { [listKey]: updated },
    });
    showToast('Removed');
    closeModal();
  } catch (e) {
    showToast('Could not save — try again');
  }
};

async function _persistConfigList(listKey, newValue) {
  const cfg = window.APP.config || {};
  const cur = Array.isArray(cfg[listKey]) ? cfg[listKey].slice() : window[listKey === 'classes' ? 'getClassList' : 'getGradeList']();
  if (cur.includes(newValue)) return;          // already there
  cur.push(newValue);
  cfg[listKey] = cur;
  try {
    await twaPost('update_school_config', {
      school_id: window.APP.school_id,
      patch: { [listKey]: cur },
    });
  } catch (e) {
    console.warn('[config] save failed', e);
  }
}
