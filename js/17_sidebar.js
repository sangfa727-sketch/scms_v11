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

  const items = SIDEBAR_ITEMS.filter(it => !it.hideInTWA || !isTWA());

  const schoolLogo = window.APP.school_logo || (window.APP.config && window.APP.config.school_logo) || '';
  const schoolName = window.APP.school_name || 'SCMS';
  const schoolBadge = schoolLogo
    ? `<img src="${esc(schoolLogo)}" alt="" class="sidebar-school-logo">`
    : `<span class="sidebar-school-mark">${esc(schoolName[0] || 'S')}</span>`;

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-school-row sidebar-school-row-top">
        ${schoolBadge}
        <span class="sidebar-school-name">${esc(schoolName)}</span>
      </div>
      <div class="sidebar-profile">
        <div class="sidebar-avatar">${esc((window.APP.teacher_name || '?')[0])}</div>
        <div class="sidebar-profile-info">
          <div class="sidebar-name">${esc(window.APP.teacher_name || '—')}</div>
          <div class="sidebar-role">${esc(window.APP.teacher_role || '—')}</div>
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

window.toggleSidebar = function() {
  if (window.APP.sidebarOpen) closeSidebar(); else openSidebar();
};
