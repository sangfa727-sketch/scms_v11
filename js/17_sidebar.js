/**
 * SCMS v11 — 17_sidebar.js
 * Telegram-style slide-in sidebar — visible only on NATIVE app (Capacitor / PWA).
 *
 * Why?
 *   • Inside the Telegram WebApp, users already have Telegram's UI (back button,
 *     close button, menu) around the app. Adding our own sidebar duplicates
 *     navigation and feels heavy. So in TWA we hide it entirely.
 *   • In the native app there's no Telegram chrome — the user expects a
 *     hamburger / profile / chat / settings drawer like every other modern app.
 *     This sidebar fills that role.
 *
 * The sidebar lives in markup but is only displayed when isTWA() === false.
 */

'use strict';

const SIDEBAR_ITEMS = [
  { id: 'students',  icon: '👥', label: 'Students',   hideInTWA: false },
  { id: 'attend',    icon: '✓',  label: 'Attendance', hideInTWA: false },
  { id: 'daily',     icon: '📋', label: 'Daily Reports', hideInTWA: false },
  { id: 'hw',        icon: '📚', label: 'Homework',   hideInTWA: false },
  { id: 'grades',    icon: '🎓', label: 'Grades',     hideInTWA: false },
  { id: 'billing',   icon: '💵', label: 'Billing',    hideInTWA: false },
  { id: 'admissions', icon: '📝', label: 'Admissions', hideInTWA: false },
  { id: 'library',    icon: '📚', label: 'Library',    hideInTWA: false },
  { id: 'transport',  icon: '🚌', label: 'Transport',  hideInTWA: false },
  { id: 'parents',   icon: '💬', label: 'Parent Messages', hideInTWA: false },
  { id: 'incidents', icon: '⚡', label: 'Incidents',  hideInTWA: false },
  { id: 'timetable', icon: '📅', label: 'Timetable',  hideInTWA: false },
  { id: 'summary',   icon: '📊', label: 'Monthly Summary', hideInTWA: false },
  // Items below are NATIVE-ONLY — hidden inside Telegram
  { id: 'chat',      icon: '🗨️', label: 'Staff Chat', hideInTWA: true  },
];

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Inside Telegram → don't render anything; the burger button is also hidden via CSS
  if (isTWA()) {
    sidebar.innerHTML = '';
    return;
  }

  // Optional modules are shown only if ticked in More → School Modules
  const enabledMods = (typeof getSidebarModuleIds === 'function') ? getSidebarModuleIds() : null;
  const isModule = id => (typeof MODULE_ITEMS !== 'undefined') && MODULE_ITEMS.some(m => m.id === id);
  const items = SIDEBAR_ITEMS
    .filter(it => !it.hideInTWA || !isTWA())
    .filter(it => !enabledMods || !isModule(it.id) || enabledMods.includes(it.id));

  const A = window.APP;
  const cfg = A.config || {};
  const schoolLogo  = A.school_logo  || cfg.school_logo  || '';
  const schoolCover = A.school_cover || cfg.school_cover || '';
  const schoolName  = A.school_name || 'SCMS';
  const isAdmin = !!A.is_admin && A.platform === 'web';
  const canEditOwn = A.platform === 'web';

  const schoolBadge = schoolLogo
    ? `<img src="${esc(schoolLogo)}" alt="" class="sidebar-school-logo"
         onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sidebar-school-mark',textContent:'${esc(schoolName[0] || 'S')}'}))">`
    : `<span class="sidebar-school-mark">${esc(schoolName[0] || 'S')}</span>`;

  const coverStyle = schoolCover ? `style="background-image:url('${esc(schoolCover)}')"` : '';
  const avatarInner = A.teacher_photo_url
    ? `<img src="${esc(A.teacher_photo_url)}" alt="" class="avatar-img">`
    : esc((A.teacher_name || '?')[0]);

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-cover ${schoolCover ? 'has-cover' : ''}" ${coverStyle}>
        ${isAdmin ? `<button class="sidebar-cover-edit" onclick="openSchoolCoverModal()" aria-label="Change cover photo">📷 Cover</button>` : ''}
      </div>
      <div class="sidebar-school-row sidebar-school-row-top">
        <div class="sidebar-logo-wrap">
          ${schoolBadge}
          ${isAdmin ? `<button class="sidebar-logo-edit" onclick="openSchoolLogoModal()" aria-label="Change school logo">📷</button>` : ''}
        </div>
        <span class="sidebar-school-name">${esc(schoolName)}</span>
      </div>
      <div class="sidebar-profile">
        <div class="sidebar-avatar ${canEditOwn ? 'editable' : ''}" ${canEditOwn ? 'onclick="openMyPhotoModal()" role="button" aria-label="Change my profile photo"' : ''}>
          ${avatarInner}
          ${canEditOwn ? '<span class="avatar-cam">📷</span>' : ''}
        </div>
        <div class="sidebar-profile-info">
          <div class="sidebar-name">${esc(A.teacher_name || '—')}</div>
          <div class="sidebar-role">${esc(A.teacher_role || '—')}</div>
        </div>
      </div>
    </div>

    <nav class="sidebar-nav">
      ${items.map(it => `
        <button class="sidebar-item ${window.APP.currentPage === it.id ? 'active' : ''}"
          data-page="${esc(it.id)}" onclick="sidebarGo('${esc(it.id)}')">
          <span class="sidebar-icon">${it.icon}</span>
          <span class="sidebar-label">${esc(it.label)}</span>
        </button>`).join('')}
    </nav>

    <div class="sidebar-footer">
      <button class="sidebar-item" onclick="sidebarGo('more')">
        <span class="sidebar-icon">⚙️</span>
        <span class="sidebar-label">Settings & More</span>
      </button>
      <div class="sidebar-version">v${esc(SCMS_CONFIG.VERSION)} · ${esc(window.APP.platform)}</div>
    </div>`;
}

window.sidebarGo = function(pageId) {
  closeSidebar();
  setTimeout(() => goToPage(pageId), 200);
};

window.openSidebar = function() {
  if (isTWA()) return;   // never opens inside Telegram
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
  window.APP.sidebarOpen = true;
};

window.closeSidebar = function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
  window.APP.sidebarOpen = false;
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && window.APP && window.APP.sidebarOpen) closeSidebar();
});

window.toggleSidebar = function() {
  if (window.APP.sidebarOpen) closeSidebar(); else openSidebar();
};
