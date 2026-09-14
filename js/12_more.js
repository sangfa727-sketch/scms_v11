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
      <div class="profile-avatar">${esc((window.APP.teacher_name || '?')[0])}</div>
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
  if (confirm('Sign out of SCMS? You\'ll need to sign in again with Telegram next time.')) {
    if (typeof signOut === 'function') signOut();
  }
};

/* ─────────────────────────────────────────────────────────────────
   School logo upload modal (admin)
   ───────────────────────────────────────────────────────────────── */

window.openSchoolLogoModal = function () {
  if (!window.APP.is_admin) {
    showToast('Only admins can change the school logo');
    return;
  }
  const current = window.APP.school_logo || (window.APP.config && window.APP.config.school_logo) || '';
  const schoolName = window.APP.school_name || 'School';

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">School logo</h3>
      <p class="modal-subtitle">Shown in the app header, daily reports, and parent messages.</p>

      <div class="logo-preview-block">
        <div class="logo-preview-frame" id="logoPreviewFrame">
          ${current
            ? `<img id="logoPreviewImg" src="${esc(current)}" alt="Current logo">`
            : `<div class="logo-preview-placeholder">${esc(schoolName[0] || 'S')}</div>`}
        </div>
        <div class="logo-preview-meta">
          <div class="logo-preview-name">${esc(schoolName)}</div>
          <div class="logo-preview-hint" id="logoHint">
            ${current ? 'Current logo' : 'No logo yet — upload one below'}
          </div>
        </div>
      </div>

      <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/webp" style="display:none">

      <div class="logo-actions">
        <button class="btn-secondary" id="btnPickLogo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Choose image
        </button>
        ${current ? `
        <button class="btn-danger" id="btnRemoveLogo">Remove</button>` : ''}
      </div>

      <div class="info-tip" style="margin-top:14px">
        <span class="info-tip-icon">💡</span>
        <div>
          <strong>Tips:</strong> use a square image, PNG with transparent background works best.
          Max <strong>1 MB</strong> — it will be auto-resized to 256×256.
        </div>
      </div>

      <div id="logoUploadStatus" style="display:none" class="link-status">
        <div class="link-status-dot"></div>
        <span id="logoUploadStatusText">Uploading…</span>
      </div>

      <div class="modal-actions" style="margin-top:18px">
        <button class="btn-secondary" onclick="closeModal()">Done</button>
      </div>
    </div>`;
  openModal(html);

  // Wire up
  const picker = document.getElementById('logoFileInput');
  document.getElementById('btnPickLogo').onclick = () => picker.click();
  picker.onchange = (e) => _handleLogoPicked(e.target.files && e.target.files[0]);

  const removeBtn = document.getElementById('btnRemoveLogo');
  if (removeBtn) {
    removeBtn.onclick = async () => {
      if (!confirm('Remove the school logo?')) return;
      await _saveLogo('');
    };
  }
};

async function _handleLogoPicked(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
    showToast('Please choose a PNG, JPG, or WebP image');
    return;
  }
  if (file.size > 1024 * 1024) {
    showToast('Image is too large (max 1 MB)');
    return;
  }
  try {
    const dataUrl = await _resizeImageToDataUrl(file, 256, 256, 0.92);
    // Update local preview immediately
    const frame = document.getElementById('logoPreviewFrame');
    if (frame) {
      frame.innerHTML = `<img id="logoPreviewImg" src="${dataUrl}" alt="New logo">`;
    }
    const hint = document.getElementById('logoHint');
    if (hint) hint.textContent = 'Preview — saving…';

    await _saveLogo(dataUrl);
  } catch (err) {
    console.error('[logo] resize failed', err);
    showToast('Could not read that image');
  }
}

async function _saveLogo(dataUrl) {
  const statusEl = document.getElementById('logoUploadStatus');
  const statusText = document.getElementById('logoUploadStatusText');
  if (statusEl) {
    statusEl.style.display = 'flex';
    statusEl.classList.remove('linked');
  }
  if (statusText) statusText.textContent = dataUrl ? 'Saving logo…' : 'Removing logo…';

  try {
    // Use the existing TWA `update_school_config` action — backend writes the
    // patch into the school's config record. See README for the schema change.
    const res = await twaPost('update_school_config', {
      school_id: window.APP.school_id,
      patch: { school_logo: dataUrl || null },
    });
    if (res && (res.ok === true || res.success === true)) {
      // Update local cache
      window.APP.school_logo = dataUrl || '';
      if (window.APP.config) window.APP.config.school_logo = dataUrl || '';

      if (statusEl) statusEl.classList.add('linked');
      if (statusText) statusText.textContent = dataUrl ? 'Logo updated ✓' : 'Logo removed ✓';
      showToast(dataUrl ? 'School logo updated' : 'School logo removed');

      // Refresh views
      try { renderMore(); } catch (e) {}
      try { _applyLogoToHeader(); } catch (e) {}
    } else {
      throw new Error((res && (res.error || res.message)) || 'Server rejected the upload');
    }
  } catch (err) {
    console.error('[logo] save failed', err);
    if (statusEl) statusEl.style.display = 'none';
    showToast('Could not save logo — ' + (err.message || 'try again'));
  }
}

/**
 * Resize an image to fit within maxW × maxH, return a data URL.
 * Keeps PNG/WebP transparency; saves JPEG as JPEG for smaller size.
 */
function _resizeImageToDataUrl(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const isTransparent = /png|webp/i.test(file.type);
        const out = isTransparent
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
    const res = await twaPost('update_school_config', {
      school_id: window.APP.school_id,
      patch: { [listKey]: updated },
    });
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
