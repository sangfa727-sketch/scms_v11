/**
 * SCMS v11 — 08_comms.js
 * Parent communications: list + broadcast modal with smart student picker.
 */

'use strict';

let _commsType = 'All';
let _commPickedStudent = null;   // selected student when sending individual msg

function renderComms() {
  const el = document.getElementById('commsTypeChips');
  if (!el) return;

  const types = ['All','General','Absent Alert','Daily Report','Praise','Incident','Homework','Broadcast'];
  el.innerHTML = types.map(t =>
    `<button class="chip${t === _commsType ? ' active' : ''}" data-type="${esc(t)}"
      onclick="filterCommsType('${esc(t)}')">${esc(t)}</button>`
  ).join('');

  _renderCommsList();
}

window.filterCommsType = function(type) {
  _commsType = type;
  document.querySelectorAll('#commsTypeChips .chip').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  _renderCommsList();
};

function _renderCommsList() {
  const el = document.getElementById('commsList');
  if (!el) return;

  let list = [...window.APP.parentComms].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (_commsType !== 'All') list = list.filter(c => c.type === _commsType);

  if (!list.length) {
    el.innerHTML = emptyState('💬', 'No messages yet', 'Comms will appear here after you send them');
    return;
  }

  const typeIcon = { 'Daily Report':'📋','Absent Alert':'🚨','Praise':'⭐','Incident':'⚡','Homework':'📚','Broadcast':'📢','General':'💬' };

  el.innerHTML = list.map(c => `
    <div class="list-card" data-comm-id="${esc(c.id)}">
      <div class="card-row">
        <div class="comm-icon">${typeIcon[c.type] || '💬'}</div>
        <div class="card-info">
          <div class="card-name">${esc(c.name_en || 'Class broadcast')}</div>
          <div class="card-sub">${esc(c.type)} · ${esc(fmtDate(c.date))}</div>
          ${c.message_preview ? `<div class="card-note">${esc(c.message_preview.slice(0, 100))}${c.message_preview.length > 100 ? '…' : ''}</div>` : ''}
        </div>
        <span class="status-dot ${c.status === 'Sent' ? 'dot-sent' : 'dot-queued'}" title="${esc(c.status || 'queued')}"></span>
        <div class="card-actions">
          <button class="icon-btn-mini danger" onclick="confirmDeleteComm('${esc(c.id)}')" title="Delete">🗑</button>
        </div>
      </div>
    </div>`
  ).join('');
}

window.confirmDeleteComm = function(id) {
  if (!confirm('Delete this message from the log?')) return;
  doDeleteComm(id);
};

async function doDeleteComm(id) {
  try {
    await API.deleteParentComm(id);
    window.APP.parentComms = window.APP.parentComms.filter(x => String(x.id) !== String(id));
    _renderCommsList();
    showToast('✓ Deleted');
  } catch (e) {
    showToast('Delete failed: ' + (e.message || 'error'));
  }
}

window.openParentCommModal = function() {
  _commPickedStudent = null;
  const classes  = [...new Set(window.APP.students.map(s => s.class).filter(Boolean))].sort();

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Send Parent Message</h3>

      <label class="field-label">Send to</label>
      <div class="pill-group" id="commTargetPills">
        <button type="button" class="pill active" onclick="togglePill(this,'commTargetPills');toggleCommTarget('class')">Whole class</button>
        <button type="button" class="pill" onclick="togglePill(this,'commTargetPills');toggleCommTarget('student')">Individual</button>
      </div>

      <div id="commClassTarget">
        <label class="field-label">Class</label>
        <select class="form-input" id="commClass">
          ${classes.map(c => `<option>${esc(c)}</option>`).join('')}
        </select>
      </div>

      <div id="commStudentTarget" style="display:none">
        <label class="field-label">Student</label>
        <button type="button" class="picker-trigger" id="commStuTrigger" onclick="commPickStudent()">
          <span id="commStuTriggerText">Tap to choose a student…</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <label class="field-label">Message</label>
      <textarea class="form-textarea" id="commMsg" rows="4" placeholder="Type your message to parents…"></textarea>

      <button class="btn-primary mt16" id="sendCommBtn" onclick="sendParentComm()">Send Message</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`;

  openModal(html);
};

window.toggleCommTarget = function(target) {
  document.getElementById('commClassTarget').style.display   = target === 'class'   ? 'block' : 'none';
  document.getElementById('commStudentTarget').style.display = target === 'student' ? 'block' : 'none';
};

window.commPickStudent = function() {
  // Close the comm modal temporarily, then open the picker
  const overlay = document.getElementById('modalOverlay');
  const savedHtml = overlay.innerHTML;

  openStudentPicker({
    title:   'Choose a student',
    onPick:  (s) => {
      _commPickedStudent = s;
      // Restore the comm modal
      openModal(savedHtml);
      setTimeout(() => {
        // Re-select the Individual pill state
        const indivPill = document.querySelectorAll('#commTargetPills .pill')[1];
        if (indivPill) {
          document.querySelectorAll('#commTargetPills .pill').forEach(p => p.classList.remove('active'));
          indivPill.classList.add('active');
          toggleCommTarget('student');
        }
        const trig = document.getElementById('commStuTriggerText');
        if (trig) trig.textContent = `${s.name_en || s.name_local} (${s.class})`;
      }, 50);
    },
  });
};

window.sendParentComm = async function() {
  const btn = document.getElementById('sendCommBtn');
  const msg = document.getElementById('commMsg').value.trim();
  if (!msg) { showToast('Message is required'); return; }

  const isIndividual = document.querySelector('#commTargetPills .pill.active')?.textContent.includes('Individual');
  if (isIndividual && !_commPickedStudent) {
    showToast('Pick a student first'); return;
  }

  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await API.sendParentComm({
      message_preview: msg,
      class:           isIndividual ? (_commPickedStudent?.class || '') : document.getElementById('commClass')?.value,
      student_id:      isIndividual ? _commPickedStudent?.student_id   : null,
      name_en:         isIndividual ? _commPickedStudent?.name_en      : null,
      type:            'General',
      date:            new Date().toISOString().slice(0, 10),
    });
    closeModal();
    showToast('✓ Message sent');
    if (window.APP.tg?.HapticFeedback) window.APP.tg.HapticFeedback.notificationOccurred('success');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Send Message';
    showToast('Failed: ' + (e.message || 'error'));
  }
};
