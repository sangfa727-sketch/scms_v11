/**
 * SCMS v11 — 12_more.js
 * More menu: quick actions, admin tools, school info, chat (native only),
 * school logo display and upload (admin only).
 */

'use strict';

function renderMore() {
  const el = document.getElementById('moreMenu');
  if (!el) return;

  const isAdmin = window.APP.is_admin;
  const showChat = !isTWA();   // chat is hidden inside Telegram
  const schoolLogo = window.APP.school_logo || (window.APP.config && window.APP.config.school_logo) || '';
  const schoolName = window.APP.school_name || '—';

  // School header card with logo (or placeholder)
  const logoBlock = schoolLogo
    ? `<img src="${esc(schoolLogo)}" alt="School logo" class="school-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="school-logo-fallback" style="display:none">${esc(schoolName[0] || 'S')}</div>`
    : `<div class="school-logo-fallback">${esc(schoolName[0] || 'S')}</div>`;

  el.innerHTML = `
    <div class="school-header-card">
      <div class="school-logo-wrap">
        ${logoBlock}
        ${isAdmin ? `
        <button class="school-logo-edit" onclick="openSchoolLogoModal()" title="Change logo" aria-label="Change school logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>` : ''}
      </div>
      <div class="school-header-info">
        <div class="school-header-name">${esc(schoolName)}</div>
        <div class="school-header-meta">${esc(window.APP.currentTerm?.term_name || 'Current term')}</div>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-avatar profile-avatar-btn" onclick="openMyPhotoModal()" title="Change my photo" role="button" aria-label="Change my profile photo">
        ${window.APP.teacher_photo_url
          ? `<img src="${esc(window.APP.teacher_photo_url)}" alt="" class="avatar-img">`
          : esc((window.APP.teacher_name || '?')[0])}
        <span class="avatar-cam">📷</span>
      </div>
      <div class="profile-info">
        <div class="profile-name">${esc(window.APP.teacher_name || '—')}</div>
        <div class="profile-role">${esc(window.APP.teacher_role || '—')}</div>
        <div class="profile-id">${esc(window.APP.teacher_id || '—')}</div>
      </div>
    </div>

    <div class="more-section-title">Browse</div>
    <div class="more-grid">
      <button class="more-tile more-tile-help" onclick="openHelpModal()">
        <span class="more-icon">📖</span>
        <span>အသုံးပြုနည်း</span>
      </button>
      <button class="more-tile" onclick="goToPage('incidents')">
        <span class="more-icon">⚡</span>
        <span>Incidents</span>
      </button>
      <button class="more-tile" onclick="goToPage('grades')">
        <span class="more-icon">🎓</span>
        <span>Grades</span>
      </button>
      <button class="more-tile" onclick="goToPage('billing')">
        <span class="more-icon">💵</span>
        <span>Billing</span>
      </button>
      <button class="more-tile" onclick="goToPage('admissions')">
        <span class="more-icon">📝</span>
        <span>Admissions</span>
      </button>
      <button class="more-tile" onclick="goToPage('library')">
        <span class="more-icon">📚</span>
        <span>Library</span>
      </button>
      <button class="more-tile" onclick="goToPage('transport')">
        <span class="more-icon">🚌</span>
        <span>Transport</span>
      </button>
      <button class="more-tile" onclick="goToPage('parents')">
        <span class="more-icon">📨</span>
        <span>Parent messages</span>
      </button>
      <button class="more-tile" onclick="goToPage('timetable')">
        <span class="more-icon">🗓️</span>
        <span>Timetable</span>
      </button>
      <button class="more-tile" onclick="goToPage('summary')">
        <span class="more-icon">📊</span>
        <span>Monthly summary</span>
      </button>
      ${showChat ? `
      <button class="more-tile" onclick="goToPage('chat')">
        <span class="more-icon">🗨️</span>
        <span>Staff chat</span>
      </button>` : ''}
    </div>

    ${isAdmin ? `
    <div class="more-section-title">Admin tools</div>
    <div class="more-list">
      <button class="more-row" onclick="openSchoolLogoModal()">
        <span class="more-row-icon">🖼️</span>
        <span class="more-row-label">School logo</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="openSchoolCoverModal()">
        <span class="more-row-icon">🌄</span>
        <span class="more-row-label">Cover photo</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="openManageClassesModal()">
        <span class="more-row-icon">🏷️</span>
        <span class="more-row-label">Classes & grades</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="showAdminInfo()">
        <span class="more-row-icon">🏫</span>
        <span class="more-row-label">School settings</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="showToast('Teacher management — coming soon')">
        <span class="more-row-icon">👥</span>
        <span class="more-row-label">Manage teachers</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="showToast('Export to CSV — coming soon')">
        <span class="more-row-icon">📤</span>
        <span class="more-row-label">Export data</span>
        <span class="more-row-chevron">›</span>
      </button>
    </div>` : ''}

    <div class="more-section-title">About</div>
    <div class="more-info-card">
      <div class="info-row"><span>School ID</span><code>${esc(window.APP.school_id || '—')}</code></div>
      <div class="info-row"><span>Active students</span><span>${window.APP.students.filter(s=>s.status==='Active').length}</span></div>
      <div class="info-row"><span>Platform</span><span>${esc(window.APP.platform)}</span></div>
      <div class="info-row"><span>Version</span><span>v${esc(SCMS_CONFIG.VERSION)}</span></div>
    </div>

    ${!isTWA() ? `
    <button class="btn-danger" style="margin-top:18px" onclick="confirmSignOut()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Sign out
    </button>` : ''}

    <div style="height: 40px;"></div>
  `;
}

window.confirmSignOut = function () {
  const wrap = document.createElement('div');
  wrap.id = 'signOutConfirmModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">🚪 Sign out မှာလား?</h3>
      <p class="modal-subtitle">Sign out ဖြစ်သွားရင် နောက်တစ်ခါ ပြန် login ဝင်ရပါမယ်။</p>

      <button class="btn-danger solid mt16" onclick="_doSignOutConfirmed()">Sign out</button>
      <button class="btn-secondary mt8" onclick="_closeSignOutConfirm()">Cancel</button>
    </div>`;
  wrap.onclick = _closeSignOutConfirm;
  document.body.appendChild(wrap);
  wrap.classList.add('active');
};

window._closeSignOutConfirm = function () {
  document.getElementById('signOutConfirmModal')?.remove();
};

window._doSignOutConfirmed = function () {
  _closeSignOutConfirm();
  if (typeof signOut === 'function') signOut();
};

/* School logo / cover / profile-photo modals now live in 26_branding.js */

/**
 * Insert/update the small logo in the header (next to school name).
 * Called after bootstrap and after a logo change.
 */
function _applyLogoToHeader() {
  const url = window.APP.school_logo || (window.APP.config && window.APP.config.school_logo) || '';
  const schoolInfoEl = document.querySelector('.school-info');
  if (!schoolInfoEl) return;
  let logoEl = document.getElementById('headerLogo');
  if (url) {
    if (!logoEl) {
      logoEl = document.createElement('img');
      logoEl.id = 'headerLogo';
      logoEl.className = 'header-logo';
      logoEl.alt = '';
      schoolInfoEl.parentNode.insertBefore(logoEl, schoolInfoEl);
    }
    logoEl.src = url;
    logoEl.style.display = 'block';
  } else if (logoEl) {
    logoEl.style.display = 'none';
  }
}
window._applyLogoToHeader = _applyLogoToHeader;

window.showAdminInfo = function () {
  const cfg = window.APP.config || {};
  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">School Settings</h3>
      <div class="info-row"><span>School ID</span><code>${esc(window.APP.school_id)}</code></div>
      <div class="info-row"><span>School Name</span><span>${esc(window.APP.school_name)}</span></div>
      <div class="info-row"><span>Subjects</span><span>${(cfg.subjects || []).length}</span></div>
      <div class="info-row"><span>Att. codes</span><span>${(cfg.attendance_codes || []).map(c=>esc(c.code)).join(', ')}</span></div>
      <div class="info-row"><span>Currency</span><span>${esc(cfg.currency || 'USD')}</span></div>
      <p style="font-size:12px;color:var(--muted);margin-top:16px">
        To update config, use /menu in the Telegram bot.
      </p>
      <button class="btn-secondary mt16" onclick="closeModal()">Close</button>
    </div>`;
  openModal(html);
};

/* ─── Manage classes & grades (admin) ──────────────────────────── */

window.openManageClassesModal = function () {
  if (!window.APP.is_admin) {
    showToast('Only admins can edit classes & grades');
    return;
  }

  const classes = window.getClassList();
  const grades  = window.getGradeList();

  const renderList = (items, listKey) => items.length
    ? items.map(v => `
        <div class="cg-row">
          <span class="cg-name">${esc(v)}</span>
          <button class="cg-remove" onclick="_cgRemove('${esc(listKey)}','${esc(v)}')" aria-label="Remove">×</button>
        </div>`).join('')
    : '<div class="cg-empty">No items yet</div>';

  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Classes & grades</h3>
      <p class="modal-subtitle">These appear when adding or editing students. Removing a name here doesn't affect existing students.</p>

      <div class="cg-section">
        <div class="cg-section-head">
          <span class="cg-section-title">Classes</span>
          <span class="cg-section-count">${classes.length}</span>
        </div>
        <div class="cg-list" id="cgClassList">${renderList(classes, 'classes')}</div>
        <div class="cg-add-row">
          <input type="text" class="form-input" id="cgClassInput" placeholder="e.g. P4 Online" maxlength="20">
          <button class="btn-primary" onclick="_cgAdd('classes','cgClassInput')">Add</button>
        </div>
      </div>

      <div class="cg-section">
        <div class="cg-section-head">
          <span class="cg-section-title">Grades</span>
          <span class="cg-section-count">${grades.length}</span>
        </div>
        <div class="cg-list" id="cgGradeList">${renderList(grades, 'grades')}</div>
        <div class="cg-add-row">
          <input type="text" class="form-input" id="cgGradeInput" placeholder="e.g. KG, P1, Year 7" maxlength="20">
          <button class="btn-primary" onclick="_cgAdd('grades','cgGradeInput')">Add</button>
        </div>
      </div>

      <button class="btn-secondary mt16" onclick="closeModal()">Done</button>
    </div>
  `);
};

window._cgAdd = async function (listKey, inputId) {
  const input = document.getElementById(inputId);
  const v = (input?.value || '').trim();
  if (!v) { showToast('Type a name first'); return; }
  const cfg = window.APP.config || {};
  const cur = Array.isArray(cfg[listKey]) ? cfg[listKey].slice() : window[listKey === 'classes' ? 'getClassList' : 'getGradeList']();
  if (cur.includes(v)) { showToast('Already in the list'); return; }
  cur.push(v);
  await _cgSave(listKey, cur);
  // Re-open to refresh
  closeModal();
  setTimeout(openManageClassesModal, 200);
};

window._cgRemove = async function (listKey, value) {
  if (!confirm(`Remove "${value}" from ${listKey}?`)) return;
  const cfg = window.APP.config || {};
  const cur = Array.isArray(cfg[listKey]) ? cfg[listKey] : window[listKey === 'classes' ? 'getClassList' : 'getGradeList']();
  await _cgSave(listKey, cur.filter(x => x !== value));
  closeModal();
  setTimeout(openManageClassesModal, 200);
};

async function _cgSave(listKey, updated) {
  try {
    const res = await API.updateSchoolConfig({ [listKey]: updated });
    if (res && (res.ok === true || res.success === true)) {
      window.APP.config = window.APP.config || {};
      window.APP.config[listKey] = updated;
      showToast('Saved');
    } else {
      showToast('Save failed');
    }
  } catch (e) {
    showToast('Could not save: ' + (e.message || 'unknown'));
  }
}
