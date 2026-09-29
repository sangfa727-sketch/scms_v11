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
    ? `<img src="${esc(schoolLogo)}" alt="${esc(t('more.logoAlt'))}" class="school-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="school-logo-fallback" style="display:none">${esc(schoolName[0] || 'S')}</div>`
    : `<div class="school-logo-fallback">${esc(schoolName[0] || 'S')}</div>`;

  el.innerHTML = `
    <div class="school-header-card">
      <div class="school-logo-wrap">
        ${logoBlock}
        ${isAdmin ? `
        <button class="school-logo-edit" onclick="openSchoolLogoModal()" title="${esc(t('more.changeLogo'))}" aria-label="${esc(t('sb.changeLogo'))}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>` : ''}
      </div>
      <div class="school-header-info">
        <div class="school-header-name">${esc(schoolName)}</div>
        <div class="school-header-meta">${esc(window.APP.currentTerm?.term_name || t('more.currentTerm'))}</div>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-avatar profile-avatar-btn" onclick="openMyPhotoModal()" title="${esc(t('more.changePhoto'))}" role="button" aria-label="${esc(t('more.changePhotoAria'))}">
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

    <div class="more-section-title">${t('more.browse')}</div>
    <div class="more-grid">
      <button class="more-tile more-tile-help" onclick="openHelpModal()">
        <span class="more-icon">📖</span>
        <span>${t('more.help')}</span>
      </button>
      <button class="more-tile more-tile-modules" onclick="openModulesMenu()">
        <span class="more-icon">🗂️</span>
        <span>${t('more.modules')}</span>
      </button>
      ${showChat ? `
      <button class="more-tile" onclick="goToPage('chat')">
        <span class="more-icon">🗨️</span>
        <span>${t('more.staffChat')}</span>
      </button>` : ''}
    </div>

    ${isAdmin ? `
    <div class="more-section-title">${t('more.admin')}</div>
    <div class="more-list">
      <button class="more-row" onclick="openSchoolLogoModal()">
        <span class="more-row-icon">🖼️</span>
        <span class="more-row-label">${t('more.logo')}</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="openSchoolCoverModal()">
        <span class="more-row-icon">🌄</span>
        <span class="more-row-label">${t('more.cover')}</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="openManageClassesModal()">
        <span class="more-row-icon">🏷️</span>
        <span class="more-row-label">${t('more.classes')}</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="showAdminInfo()">
        <span class="more-row-icon">🏫</span>
        <span class="more-row-label">${t('more.schoolSettings')}</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="openTeacherManager()">
        <span class="more-row-icon">👥</span>
        <span class="more-row-label">${t('more.teachers')}</span>
        <span class="more-row-chevron">›</span>
      </button>
      <button class="more-row" onclick="showToast(t('more.exportSoon'))">
        <span class="more-row-icon">📤</span>
        <span class="more-row-label">${t('more.export')}</span>
        <span class="more-row-chevron">›</span>
      </button>
    </div>` : ''}

    <div class="more-section-title">${t('more.display')}</div>
    <div class="more-info-card">
      <label class="pref-row">
        <span class="pref-text">
          <span class="pref-title">${t('more.bottomBar')}</span>
          <span class="pref-sub">${t('more.bottomBarSub')}</span>
        </span>
        <input type="checkbox" class="pref-switch" ${_desktopTabBarOn() ? 'checked' : ''}
          onchange="toggleDesktopTabBar(this.checked)">
      </label>
    </div>

    <div class="more-section-title">${t('more.about')}</div>
    <div class="more-info-card">
      <div class="info-row"><span>${t('more.schoolId')}</span><code>${esc(window.APP.school_id || '—')}</code></div>
      <div class="info-row"><span>${t('more.activeStudents')}</span><span>${window.APP.students.filter(s=>s.status==='Active').length}</span></div>
      <div class="info-row"><span>${t('more.platform')}</span><span>${esc(window.APP.platform)}</span></div>
      <div class="info-row"><span>${t('more.version')}</span><span>v${esc(SCMS_CONFIG.VERSION)}</span></div>
    </div>

    ${!isTWA() ? `
    <button class="btn-danger" style="margin-top:18px" onclick="confirmSignOut()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      ${t('sb.signout')}
    </button>` : ''}

    <div style="height: 40px;"></div>
  `;
}

/* All feature modules live under one "School Modules" tile (Browse section). */
const MODULE_ITEMS = [
  { id: 'incidents',  icon: '⚡'  },
  { id: 'grades',     icon: '🎓' },
  { id: 'billing',    icon: '💵' },
  { id: 'admissions', icon: '📝' },
  { id: 'library',    icon: '📚' },
  { id: 'transport',  icon: '🚌' },
  { id: 'parents',    icon: '📨' },
  { id: 'timetable',  icon: '🗓️' },
  { id: 'summary',    icon: '📊' },
];
// label follows the current language
MODULE_ITEMS.forEach(m => Object.defineProperty(m, 'label', { get: () => t('module.' + m.id) }));

/** Module ids shown in the sidebar (default: all until the user saves a choice). */
window.getSidebarModuleIds = function () {
  const saved = window.APP.ui_prefs && window.APP.ui_prefs.sidebar_modules;
  return Array.isArray(saved) ? saved : MODULE_ITEMS.map(m => m.id);
};

let _modulesDraft = null;   // Set of ids ticked in the open sheet (not saved yet)

window.openModulesMenu = function () {
  _modulesDraft = new Set(getSidebarModuleIds());
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${t('modules.title')}</h3>
      <p class="modal-subtitle">${t('modules.hint')}</p>
      <div class="more-grid" style="padding:8px 0 4px">
        ${MODULE_ITEMS.map(m => `
        <div class="more-tile module-card" role="button" tabindex="0" onclick="modulesGo('${m.id}')">
          <label class="module-check" onclick="event.stopPropagation()" title="${esc(t('modules.showInSidebar'))}">
            <input type="checkbox" ${_modulesDraft.has(m.id) ? 'checked' : ''}
              onchange="_modulesToggle('${m.id}', this.checked)">
            <span class="module-check-box"></span>
          </label>
          <span class="more-icon">${m.icon}</span>
          <span>${esc(m.label)}</span>
        </div>`).join('')}
      </div>
      <button class="btn-primary" style="margin-top:14px" id="btnSaveModules" onclick="saveSidebarModules()">${t('modules.save')}</button>
    </div>`);
};

window._modulesToggle = function (id, on) {
  if (!_modulesDraft) return;
  if (on) _modulesDraft.add(id); else _modulesDraft.delete(id);
};

window.saveSidebarModules = async function () {
  if (window.APP.platform !== 'web') { showToast(t('modules.needWeb')); return; }
  const btn = document.getElementById('btnSaveModules');
  if (btn) { btn.disabled = true; btn.textContent = t('common.saving'); }
  try {
    const ids = MODULE_ITEMS.map(m => m.id).filter(id => _modulesDraft.has(id));  // keep canonical order
    const res = await API.setMyUiPrefs({ sidebar_modules: ids });
    window.APP.ui_prefs = (res && res.ui_prefs) || { ...(window.APP.ui_prefs || {}), sidebar_modules: ids };
    try { renderSidebar(); } catch (e) {}
    showToast(t('modules.saved'));
    closeModal();
  } catch (err) {
    console.error('[modules] save failed', err);
    showToast(t('modules.saveFailed', { err: err.message || t('common.saveFailed') }));
    if (btn) { btn.disabled = false; btn.textContent = t('modules.save'); }
  }
};

window.modulesGo = function (pageId) {
  closeModal();
  setTimeout(() => goToPage(pageId), 150);
};

/* Desktop bottom tab bar: on by default, can be switched off (device-local). */
const _TABBAR_KEY = 'scms_desktop_tabbar';
function _desktopTabBarOn() {
  try { return localStorage.getItem(_TABBAR_KEY) !== 'off'; } catch (e) { return true; }
}
function _applyDesktopTabBar() {
  document.documentElement.classList.toggle('tabbar-off', !_desktopTabBarOn());
}
window.toggleDesktopTabBar = function (on) {
  try { localStorage.setItem(_TABBAR_KEY, on ? 'on' : 'off'); } catch (e) {}
  _applyDesktopTabBar();
  showToast(t(on ? 'more.bottomBarOn' : 'more.bottomBarOff'));
};
_applyDesktopTabBar();

window.confirmSignOut = function () {
  const wrap = document.createElement('div');
  wrap.id = 'signOutConfirmModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${t('signout.title')}</h3>
      <p class="modal-subtitle">${t('signout.body')}</p>

      <button class="btn-danger solid mt16" onclick="_doSignOutConfirmed()">${t('sb.signout')}</button>
      <button class="btn-secondary mt8" onclick="_closeSignOutConfirm()">${t('common.cancel')}</button>
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
      <h3 class="modal-title">${t('schoolInfo.title')}</h3>
      <div class="info-row"><span>${t('more.schoolId')}</span><code>${esc(window.APP.school_id)}</code></div>
      <div class="info-row"><span>${t('schoolInfo.name')}</span><span>${esc(window.APP.school_name)}</span></div>
      <div class="info-row"><span>${t('schoolInfo.subjects')}</span><span>${(cfg.subjects || []).length}</span></div>
      <div class="info-row"><span>${t('schoolInfo.attCodes')}</span><span>${(cfg.attendance_codes || []).map(c=>esc(c.code)).join(', ')}</span></div>
      <div class="info-row"><span>${t('schoolInfo.currency')}</span><span>${esc(cfg.currency || 'USD')}</span></div>
      <p style="font-size:12px;color:var(--muted);margin-top:16px">
        ${t('schoolInfo.hint')}
      </p>
      <button class="btn-secondary mt16" onclick="closeModal()">${t('common.close')}</button>
    </div>`;
  openModal(html);
};

/* ─── Manage classes & grades (admin) ────────────────────────────
 * Grade = the level (G1, KG…), class = a section inside a grade (Orchid 1…).
 * Adding a class picks its grade in the same step, classes are shown under
 * their grade, and a grade that still has classes can't be deleted out from
 * under them. Stored as config.classes / config.grades (unchanged plain
 * lists, so every other screen keeps working) plus config.class_grade, the
 * link between them. Every action saves immediately and re-renders IN PLACE —
 * the sheet is never closed and re-opened to refresh.
 */

let _cgBusy = false;

window.openManageClassesModal = function () {
  if (!window.APP.is_admin) {
    showToast(t('cg.adminOnly'));
    return;
  }
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${t('more.classes')}</h3>
      <p class="modal-subtitle">${t('cg.hint2')}</p>
      <div id="cgBody"></div>
      <button class="btn-secondary mt16" onclick="closeModal()">${t('common.done')}</button>
    </div>
  `);
  _cgRender();
};

function _cgRender(keep = {}) {
  const el = document.getElementById('cgBody');
  if (!el) return;
  const grades  = window.getGradeList();
  const classes = window.getClassList();
  const map     = window.getClassGradeMap();

  const byGrade = {};
  grades.forEach(g => { byGrade[g] = []; });
  const unassigned = [];
  classes.forEach(c => (map[c] && byGrade[map[c]] ? byGrade[map[c]] : unassigned).push(c));

  const noGrades = grades.length === 0;
  const selGrade = keep.grade !== undefined ? keep.grade : (noGrades ? '__new__' : '');
  const newMode  = selGrade === '__new__';

  const chip = (c) => `
    <span class="cgx-chip">${esc(c)}
      <button type="button" class="cgx-x" data-c="${esc(c)}" onclick="_cgRemoveClass(this.dataset.c)" aria-label="${esc(t('picker.remove'))}">×</button>
    </span>`;

  const groups = grades.map(g => `
    <div class="cgx-group">
      <div class="cgx-group-head">
        <span class="cgx-grade">${esc(g)}</span>
        <span class="cgx-count">${t('cg.nClasses', { n: byGrade[g].length })}</span>
        <button type="button" class="cgx-x" data-g="${esc(g)}" onclick="_cgRemoveGrade(this.dataset.g)"
          aria-label="${esc(t('picker.remove'))}" ${byGrade[g].length ? 'disabled title="' + esc(t('cg.gradeHasClasses')) + '"' : ''}>×</button>
      </div>
      ${byGrade[g].length
        ? `<div class="cgx-chips">${byGrade[g].map(chip).join('')}</div>`
        : `<div class="cgx-empty">${t('cg.noClassesInGrade')}</div>`}
    </div>`).join('');

  const gradeOpts = grades.map(g => `<option value="${esc(g)}"${g === selGrade ? ' selected' : ''}>${esc(g)}</option>`).join('');

  el.innerHTML = `
    <div class="cgx-add">
      <div class="cgx-add-title">${t('cg.addClassTitle')}</div>
      <div class="cgx-add-row">
        <input type="text" class="form-input" id="cgClassName" placeholder="${esc(t('cg.classPh'))}" maxlength="20" value="${esc(keep.name || '')}">
        <select class="form-input" id="cgClassGrade" onchange="_cgGradeSelectChanged(this)">
          <option value="" disabled ${selGrade ? '' : 'selected'}>${t('cg.chooseGrade')}</option>
          ${gradeOpts}
          <option value="__new__"${newMode ? ' selected' : ''}>${t('cg.newGrade')}</option>
        </select>
      </div>
      <div class="collapse${newMode ? ' open' : ''}" id="cgNewGradeWrap"${newMode ? '' : ' inert'}>
        <div class="collapse-inner">
          <input type="text" class="form-input" id="cgNewGrade" placeholder="${esc(t('cg.gradePh'))}" maxlength="20" value="${esc(keep.newGrade || '')}">
        </div>
      </div>
      <button class="btn-primary" onclick="_cgAddClass()">${t('cg.addClass')}</button>
    </div>

    ${groups}

    ${unassigned.length ? `
      <div class="cgx-group unassigned">
        <div class="cgx-group-head"><span class="cgx-grade">${t('cg.unassigned')}</span></div>
        <div class="cgx-empty" style="margin-bottom:6px">${t('cg.unassignedHint')}</div>
        ${unassigned.map(c => `
          <div class="cgx-unassigned-row">
            <span class="cgx-name">${esc(c)}</span>
            <select class="form-input" data-c="${esc(c)}" onchange="_cgAssign(this.dataset.c, this.value)">
              <option value="" selected disabled>${t('cg.assign')}</option>
              ${grades.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
            </select>
            <button type="button" class="cgx-x" data-c="${esc(c)}" onclick="_cgRemoveClass(this.dataset.c)" aria-label="${esc(t('picker.remove'))}">×</button>
          </div>`).join('')}
      </div>` : ''}

    <div class="cgx-grade-add">
      <input type="text" class="form-input" id="cgGradeOnly" placeholder="${esc(t('cg.gradePh'))}" maxlength="20">
      <button class="btn-secondary" style="width:auto;padding:0 16px" onclick="_cgAddGrade()">${t('cg.addGrade')}</button>
    </div>
  `;
}

window._cgGradeSelectChanged = function (sel) {
  const wrap = document.getElementById('cgNewGradeWrap');
  const isNew = sel.value === '__new__';
  wrap.classList.toggle('open', isNew);
  wrap.toggleAttribute('inert', !isNew);
  if (isNew) setTimeout(() => document.getElementById('cgNewGrade')?.focus(), 280);
};

window._cgAddClass = async function () {
  const name = (document.getElementById('cgClassName')?.value || '').trim();
  let grade  = document.getElementById('cgClassGrade')?.value || '';
  if (grade === '__new__') grade = (document.getElementById('cgNewGrade')?.value || '').trim();
  if (!name)  { showToast(t('picker.typeName')); return; }
  if (!grade) { showToast(t('cg.chooseGrade')); return; }

  const classes = window.getClassList();
  const grades  = window.getGradeList();
  if (classes.includes(name)) { showToast(t('cg.exists')); return; }

  const patch = { classes: [...classes, name], class_grade: { ...window.getClassGradeMap(), [name]: grade } };
  if (!grades.includes(grade)) patch.grades = [...grades, grade];

  // Keep the chosen grade selected so adding several classes to one grade is quick.
  if (await _cgSave(patch)) _cgRender({ grade });
};

window._cgAddGrade = async function () {
  const g = (document.getElementById('cgGradeOnly')?.value || '').trim();
  if (!g) { showToast(t('picker.typeName')); return; }
  const grades = window.getGradeList();
  if (grades.includes(g)) { showToast(t('cg.exists')); return; }
  if (await _cgSave({ grades: [...grades, g] })) _cgRender();
};

window._cgAssign = async function (cls, grade) {
  if (!grade) return;
  if (await _cgSave({ class_grade: { ...window.getClassGradeMap(), [cls]: grade } })) _cgRender();
};

window._cgRemoveClass = function (cls) {
  showConfirm(t('cg.removeClassTitle'), t('cg.removeClassBody', { value: cls }), t('picker.remove'), async () => {
    const map = { ...window.getClassGradeMap() };
    delete map[cls];
    if (await _cgSave({ classes: window.getClassList().filter(c => c !== cls), class_grade: map })) _cgRender();
  });
};

window._cgRemoveGrade = function (grade) {
  if (Object.values(window.getClassGradeMap()).includes(grade)) { showToast(t('cg.gradeHasClasses')); return; }
  showConfirm(t('cg.removeGradeTitle'), t('cg.removeGradeBody', { value: grade }), t('picker.remove'), async () => {
    if (await _cgSave({ grades: window.getGradeList().filter(g => g !== grade) })) _cgRender();
  });
};

async function _cgSave(patch) {
  if (_cgBusy) return false;
  _cgBusy = true;
  try {
    const res = await API.updateSchoolConfig(patch);
    if (res && (res.ok === true || res.success === true)) {
      window.APP.config = Object.assign(window.APP.config || {}, patch);
      showToast(t('common.saved'));
      return true;
    }
    showToast(t('common.saveFailedShort'));
  } catch (e) {
    showToast(t('cg.couldNotSave', { err: e.message || t('common.unknown') }));
  } finally {
    _cgBusy = false;
  }
  return false;
}
