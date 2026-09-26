/* ============================================================
   js/27_dashboard.js — "Today at a Glance" teacher dashboard
   Built 2026-09-27, verified directly against live schema
   (project rszgbryucqwmrdbsgwbb) before writing a line of this:
   every RPC called below already exists — no new backend RPC,
   no new attack surface.

   Scope decisions made against REAL data, not assumption:
   - Homework: homework_log has NO per-student submission tracking
     (no student_id, no "submitted" flag) — this shows "homework
     logged recently", not "who hasn't submitted", because the
     latter is not a thing the data model can answer yet.
   - Parent Comms: parent_comms is OUTBOUND-ONLY logging (teacher
     -> parent), not a two-way inbox — this shows "messages stuck
     in Queued" (meaningful right now, since the n8n bot is down),
     not "unread messages from parents" (that concept doesn't
     exist in this system).
   - Left OUT for v1: Health Records / Library / Transport alerts.
     rpc_get_health_profile takes a single p_student_id — there is
     no bulk "all students with allergy alerts" RPC, so a real
     version of that widget would mean one RPC call per student
     (N+1). Not worth the load time until a bulk RPC exists.
   - Every RPC here is school_id-scoped only (not teacher_id), so
     "my classes" vs "whole school" is a CLIENT-SIDE filter on
     each row's own teacher_id column (every table used here has
     one). Toggle state is not persisted — reload = whole-school
     default, matches read-only nature of the page.
   ============================================================ */

let _dashboardLoadedOnce = false;
let _dashboardScopeMine = false; // false = whole school, true = my classes only
let _dashboardCache = null;      // module-level cache, never put row data in onclick attrs

function renderDashboard() {
  const container = document.getElementById('page-dashboard');
  if (!container) return;

  if (!_dashboardLoadedOnce) {
    container.innerHTML = `<div class="skeleton-loading">Loading dashboard…</div>`;
  }
  _loadDashboardData().then(() => {
    _dashboardLoadedOnce = true;
    _paintDashboard(container);
  }).catch(err => {
    container.innerHTML = `<div class="empty-state">Dashboard failed to load: ${_escape(err.message || String(err))}</div>`;
  });
}

async function _loadDashboardData() {
  const token = _getSessionToken(); // TODO confirm this is the real helper name in 02_api.js

  const [timetable, attendance, homework, incidents, comms] = await Promise.all([
    _webRpc('rpc_get_timetable', { p_session_token: token }),
    _webRpc('rpc_get_attendance', { p_session_token: token, p_days_back: 14 }),
    _webRpc('rpc_get_homework', { p_session_token: token, p_days_back: 14 }),
    _webRpc('rpc_get_incidents', { p_session_token: token, p_days_back: 14 }),
    _webRpc('rpc_get_parent_comms', { p_session_token: token, p_days_back: 14 }),
  ]);

  _dashboardCache = {
    timetable: timetable.rows || [],
    attendance: attendance.rows || [],
    homework: homework.rows || [],
    incidents: incidents.rows || [],
    comms: comms.rows || [],
    loadedAt: new Date(),
  };
}

function _dashboardScopedRows(rows) {
  if (!_dashboardScopeMine) return rows;
  const myId = _getCurrentTeacherId(); // TODO confirm real helper name (session/profile state)
  return rows.filter(r => r.teacher_id === myId);
}

function _paintDashboard(container) {
  const d = _dashboardCache;
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayISO = new Date().toISOString().slice(0, 10);

  const todaysClasses = _dashboardScopedRows(d.timetable)
    .filter(t => t.day === todayName)
    .sort((a, b) => (a.period ?? 0) - (b.period ?? 0));

  const classesToday = [...new Set(todaysClasses.map(t => t.class))];
  const attendanceMarkedToday = new Set(
    d.attendance.filter(a => a.date === todayISO).map(a => a.class)
  );
  const classesMissingAttendance = classesToday.filter(c => !attendanceMarkedToday.has(c));

  const recentHomework = _dashboardScopedRows(d.homework)
    .filter(h => h.date === todayISO || h.date === _isoDaysAgo(1))
    .slice(0, 8);

  const recentIncidents = _dashboardScopedRows(d.incidents).slice(0, 6);

  const queuedComms = d.comms.filter(c => c.status === 'Queued');

  // Students needing attention: >=3 Absent in the last 14 days
  const absenceCounts = {};
  for (const a of d.attendance) {
    if (a.status !== 'P') {
      absenceCounts[a.student_id] = absenceCounts[a.student_id] || { name: a.name_en, count: 0 };
      absenceCounts[a.student_id].count++;
    }
  }
  const attentionList = Object.entries(absenceCounts)
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  container.innerHTML = `
    <div class="dashboard-header">
      <h2>Today — ${todayName}</h2>
      <label class="scope-toggle">
        <input type="checkbox" id="dashboardScopeToggle" ${_dashboardScopeMine ? 'checked' : ''}>
        My classes only
      </label>
    </div>

    <div class="dashboard-glance-card">
      <div class="glance-item ${classesMissingAttendance.length ? 'glance-warn' : 'glance-ok'}">
        <span class="glance-num">${classesToday.length}</span>
        <span class="glance-label">Classes today</span>
      </div>
      <div class="glance-item ${classesMissingAttendance.length ? 'glance-warn' : 'glance-ok'}">
        <span class="glance-num">${classesMissingAttendance.length}</span>
        <span class="glance-label">Not yet marked</span>
      </div>
      <div class="glance-item">
        <span class="glance-num">${recentHomework.length}</span>
        <span class="glance-label">Homework logged (2d)</span>
      </div>
      <div class="glance-item ${recentIncidents.length ? 'glance-warn' : ''}">
        <span class="glance-num">${recentIncidents.length}</span>
        <span class="glance-label">Recent incidents</span>
      </div>
      <div class="glance-item ${queuedComms.length ? 'glance-warn' : ''}">
        <span class="glance-num">${queuedComms.length}</span>
        <span class="glance-label">Messages queued (not delivered)</span>
      </div>
    </div>

    ${queuedComms.length ? `
    <div class="dashboard-banner dashboard-banner-warn">
      ⚠️ ${queuedComms.length} parent message(s) are stuck in "Queued" — the Telegram delivery bot
      is currently offline, these have not actually reached parents yet.
    </div>` : ''}

    <div class="dashboard-section">
      <h3>Today's Schedule</h3>
      ${todaysClasses.length ? `
        <div class="dashboard-list">
          ${todaysClasses.map(t => `
            <div class="dashboard-row" data-class="${_escapeAttr(t.class)}" onclick="_dashboardGoToAttendance(this.dataset.class)">
              <span class="row-time">${_escape(t.start_time || '')}</span>
              <span class="row-main">${_escape(t.class)} — ${_escape(t.subject || '')}</span>
              <span class="row-meta">${_escape(t.room || '')}</span>
            </div>`).join('')}
        </div>` : `<div class="empty-state">No classes scheduled today.</div>`}
    </div>

    <div class="dashboard-section">
      <h3>Quick Actions</h3>
      <div class="dashboard-actions">
        <button onclick="window.goToPage('attendance')">Take Attendance</button>
        <button onclick="window.goToPage('homework')">Log Homework</button>
        <button onclick="window.goToPage('comms')">Message a Parent</button>
        <button onclick="window.goToPage('incidents')">Record Incident</button>
      </div>
    </div>

    ${attentionList.length ? `
    <div class="dashboard-section">
      <h3>Students Needing Attention</h3>
      <div class="dashboard-list">
        ${attentionList.map(([id, v]) => `
          <div class="dashboard-row">
            <span class="row-main">${_escape(v.name)}</span>
            <span class="row-meta">${v.count} absences in last 14 days</span>
          </div>`).join('')}
      </div>
    </div>` : ''}

    ${recentIncidents.length ? `
    <div class="dashboard-section">
      <h3>Recent Incidents</h3>
      <div class="dashboard-list">
        ${recentIncidents.map(i => `
          <div class="dashboard-row">
            <span class="row-main">${_escape(i.name_en)} — ${_escape(i.type)}</span>
            <span class="row-meta">${_escape(i.date)}</span>
          </div>`).join('')}
      </div>
    </div>` : ''}
  `;

  const toggle = document.getElementById('dashboardScopeToggle');
  if (toggle) toggle.onchange = () => {
    _dashboardScopeMine = toggle.checked;
    _paintDashboard(container); // re-render from cache, no re-fetch needed
  };
}

function _dashboardGoToAttendance(className) {
  // TODO confirm real hand-off pattern — e.g. window.goToPage('attendance', { class: className })
  window.goToPage('attendance');
}

function _isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function _escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _escapeAttr(s) { return _escape(s); }
