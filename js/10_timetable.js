/**
 * SCMS v11 — 10_timetable.js
 * Weekly timetable view with day tabs.
 */

'use strict';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
let _ttDay = DAYS[Math.min(Math.max(new Date().getDay() - 1, 0), 4)];

function renderTimetable() {
  _renderDayTabs();
  _renderTtClassChips();
}

function _renderDayTabs() {
  const el = document.getElementById('dayTabs');
  if (!el) return;

  const today = DAYS[Math.min(Math.max(new Date().getDay() - 1, 0), 4)];

  el.innerHTML = DAYS.map(d => `
    <button class="day-tab ${d === _ttDay ? 'active' : ''} ${d === today ? 'today' : ''}"
      data-day="${d}" onclick="selectTtDay('${d}')">${d.slice(0,3)}</button>
  `).join('');
}

window.selectTtDay = function(day) {
  _ttDay = day;
  document.querySelectorAll('.day-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.day === day)
  );
  _renderTtList();
};

function _renderTtClassChips() {
  const el = document.getElementById('ttClassChips');
  if (!el) return;
  el.innerHTML = '';
  _renderTtList();
}

function _renderTtList() {
  const el = document.getElementById('timetableList');
  if (!el) return;

  const entries = window.APP.timetable.filter(t => t.day === _ttDay)
    .sort((a, b) => (a.period || 0) - (b.period || 0));

  if (!entries.length) {
    el.innerHTML = emptyState('📅', `No classes on ${_ttDay}`, 'Admin manages the timetable');
    return;
  }

  el.innerHTML = entries.map(t => `
    <div class="tt-row" data-tt-id="${esc(t.id)}">
      <div class="tt-period">${esc(String(t.period || '?'))}</div>
      <div class="tt-info">
        <div class="tt-subject">${esc(t.subject || '—')}</div>
        <div class="tt-meta">${esc(t.class || '—')} ${t.room ? '· Room ' + esc(t.room) : ''}</div>
      </div>
      <div class="tt-time">${esc(t.start_time || '')}</div>
      ${window.APP.is_admin ? `
      <div class="card-actions">
        <button class="icon-btn-mini" onclick="openEditTimetable('${esc(t.id)}')" title="Edit">✎</button>
        <button class="icon-btn-mini danger" onclick="confirmDeleteTimetable('${esc(t.id)}')" title="Delete">🗑</button>
      </div>` : ''}
    </div>`
  ).join('');

  const sub = document.getElementById('timetableSubtitle');
  if (sub) sub.textContent = `${entries.length} period${entries.length !== 1 ? 's' : ''} on ${_ttDay}`;
}

/* ─── Add / Edit / Delete ──────────────────────────────────────── */

window.openAddTimetable = function() {
  if (!window.APP.is_admin) { showToast('Admin only'); return; }
  _openTimetableForm({ mode: 'add', entry: { day: _ttDay } });
};

window.openEditTimetable = function(id) {
  if (!window.APP.is_admin) { showToast('Admin only'); return; }
  const entry = window.APP.timetable.find(x => String(x.id) === String(id));
  if (!entry) { showToast('Entry not found'); return; }
  _openTimetableForm({ mode: 'edit', entry });
};

function _openTimetableForm({ mode, entry }) {
  const isEdit = mode === 'edit';
  const e = entry || {};
  const subjects = window.APP.config?.subjects || ['Mathematics','English','Science','Social Studies'];
  const classes  = window.getClassList ? window.getClassList()
                   : [...new Set(window.APP.students.map(s => s.class).filter(Boolean))].sort();

  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${isEdit ? 'Edit' : 'Add'} timetable entry</h3>

      <label class="field-label">Day</label>
      <select class="form-input" id="ttDay">
        ${DAYS.map(d => `<option ${d===e.day?'selected':''}>${esc(d)}</option>`).join('')}
      </select>

      <div class="form-row">
        <div class="form-col">
          <label class="field-label">Period</label>
          <input class="form-input" id="ttPeriod" type="number" min="1" max="12" value="${esc(e.period || '')}">
        </div>
        <div class="form-col">
          <label class="field-label">Start time</label>
          <input class="form-input" id="ttStart" type="time" value="${esc(e.start_time || '')}">
        </div>
      </div>

      <label class="field-label">Class</label>
      <select class="form-input" id="ttClass">
        ${classes.map(c => `<option ${c===e.class?'selected':''}>${esc(c)}</option>`).join('')}
      </select>

      <label class="field-label">Subject</label>
      <select class="form-input" id="ttSubject">
        ${subjects.map(s => `<option ${s===e.subject?'selected':''}>${esc(s)}</option>`).join('')}
      </select>

      <label class="field-label">Room (optional)</label>
      <input class="form-input" id="ttRoom" value="${esc(e.room || '')}" placeholder="e.g. 201">

      <button class="btn-primary mt16" id="saveTtBtn" onclick="saveTimetableEntry(${isEdit ? `'${esc(e.id)}'` : 'null'})">
        ${isEdit ? 'Save changes' : 'Add entry'}
      </button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

window.saveTimetableEntry = async function(id) {
  const btn = document.getElementById('saveTtBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const data = {
      day:        document.getElementById('ttDay').value,
      period:     parseInt(document.getElementById('ttPeriod').value, 10) || 1,
      start_time: document.getElementById('ttStart').value || null,
      class:      document.getElementById('ttClass').value,
      subject:    document.getElementById('ttSubject').value,
      room:       document.getElementById('ttRoom').value.trim() || null,
    };
    if (id) {
      await API.updateTimetable(id, data);
      const idx = window.APP.timetable.findIndex(x => String(x.id) === String(id));
      if (idx >= 0) window.APP.timetable[idx] = { ...window.APP.timetable[idx], ...data };
      showToast('✓ Updated');
    } else {
      const res = await API.saveTimetable(data);
      // Server may return the inserted row; refresh from APP.timetable on next bootstrap
      const newRow = (res && (res.data || res[0])) || { ...data, id: 'tmp_' + Date.now() };
      window.APP.timetable.push(newRow);
      showToast('✓ Added');
    }
    closeModal();
    _renderTtList();
  } catch (e) {
    btn.disabled = false; btn.textContent = id ? 'Save changes' : 'Add entry';
    showToast('Save failed: ' + (e.message || 'error'));
  }
};

window.confirmDeleteTimetable = function(id) {
  if (!confirm('Delete this timetable entry?')) return;
  doDeleteTimetable(id);
};

async function doDeleteTimetable(id) {
  try {
    await API.deleteTimetable(id);
    window.APP.timetable = window.APP.timetable.filter(x => String(x.id) !== String(id));
    _renderTtList();
    showToast('✓ Deleted');
  } catch (e) {
    showToast('Delete failed: ' + (e.message || 'error'));
  }
}
