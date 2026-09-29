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
  el.innerHTML = types.map(ty =>
    `<button class="chip${ty === _commsType ? ' active' : ''}" data-type="${esc(ty)}"
      onclick="filterCommsType('${esc(ty)}')">${esc(tv('commType', ty))}</button>`
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
    el.innerHTML = emptyState('💬', t('comms.none'), t('comms.noneSub'));
    return;
  }

  const typeIcon = { 'Daily Report':'📋','Absent Alert':'🚨','Praise':'⭐','Incident':'⚡','Homework':'📚','Broadcast':'📢','General':'💬' };

  el.innerHTML = list.map(c => `
    <div class="list-card" data-comm-id="${esc(c.id)}">
      <div class="card-row">
        <div class="comm-icon">${typeIcon[c.type] || '💬'}</div>
        <div class="card-info">
          <div class="card-name">${esc(c.name_en || (c.class ? t('comms.classBroadcast', { class: c.class }) : t('comms.broadcast')))}</div>
          <div class="card-sub">${esc(tv('commType', c.type))} · ${esc(fmtDate(c.date))}</div>
          ${c.message_preview ? `<div class="card-note">${esc(c.message_preview.slice(0, 100))}${c.message_preview.length > 100 ? '…' : ''}</div>` : ''}
        </div>
        <span class="status-dot ${c.status === 'Sent' ? 'dot-sent' : 'dot-queued'}" title="${esc(tv('commStatus', c.status || 'queued'))}"></span>
        <div class="card-actions">
          <button class="icon-btn-mini danger" onclick="confirmDeleteComm('${esc(c.id)}')" title="${esc(t('btn.delete'))}">🗑</button>
        </div>
      </div>
    </div>`
  ).join('');
}

window.confirmDeleteComm = function(id) {
  showConfirm(
    t('comms.confirmTitle'),
    t('common.cantUndo'),
    t('btn.delete'),
    () => doDeleteComm(id)
  );
};

async function doDeleteComm(id) {
  try {
    await API.deleteParentComm(id);
    window.APP.parentComms = window.APP.parentComms.filter(x => String(x.id) !== String(id));
    _renderCommsList();
    showToast(t('common.deleted'));
  } catch (e) {
    showToast(t('common.deleteFailed', { err: e.message || t('common.error') }));
  }
}

window.openParentCommModal = function() {
  _commPickedStudent = null;
  const types   = ['General','Absent Alert','Daily Report','Praise','Incident','Homework','Broadcast'];
  // Pre-select whichever list filter was active when "+" was tapped (a head
  // start, not a lock-in) — it's a real dropdown IN the form, so typing a
  // message never requires having pre-picked the right filter chip first.
  const defaultType = types.includes(_commsType) ? _commsType : 'General';
  const hasClasses  = window.getClassList().length > 0;

  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${t('comms.sendTitle')}</h3>

      <label class="field-label">${t('comms.purpose')}</label>
      <select class="form-input" id="commType">
        ${types.map(ty => `<option value="${esc(ty)}" ${ty === defaultType ? 'selected' : ''}>${esc(tv('commType', ty))}</option>`).join('')}
      </select>

      <label class="field-label">${t('comms.sendTo')}</label>
      <div class="seg" id="commTargetSeg" role="tablist">
        <span class="seg-thumb"></span>
        <button type="button" class="seg-opt on" role="tab" aria-selected="true"  data-target="class"   onclick="setCommTarget('class')">${t('comms.wholeClass')}</button>
        <button type="button" class="seg-opt"    role="tab" aria-selected="false" data-target="student" onclick="setCommTarget('student')">${t('comms.individual')}</button>
      </div>

      <div class="collapse open" id="commClassTarget">
        <div class="collapse-inner">
          <label class="field-label">${t('comms.class')}</label>
          ${hasClasses
            ? `<select class="form-input" id="commClass">${window.classOptionsHtml('')}</select>`
            : `<div class="muted" style="font-size:13px;padding:8px 0">${t('comms.noClasses')}</div>`}
        </div>
      </div>

      <div class="collapse" id="commStudentTarget" inert>
        <div class="collapse-inner">
          <label class="field-label">${t('comms.student')}</label>
          <button type="button" class="picker-trigger placeholder" id="commStuTrigger" onclick="commPickStudent()"></button>
        </div>
      </div>

      <label class="field-label">${t('comms.message')}</label>
      <textarea class="form-textarea" id="commMsg" rows="4" placeholder="${esc(t('comms.msgPh'))}"></textarea>

      <button class="btn-primary mt16" id="sendCommBtn" onclick="sendParentComm()">${t('comms.send')}</button>
      <button class="btn-secondary" onclick="closeModal()">${t('common.cancel')}</button>
    </div>`);
  _commRenderStudentTrigger();
};

// Whole class / Individual. One place decides the state: the segmented
// control's data-target. The two panes animate open/closed; the hidden one is
// `inert` so it can't be tabbed into or tapped while collapsed.
window.setCommTarget = function(target) {
  const seg = document.getElementById('commTargetSeg');
  if (!seg) return;
  const idx = target === 'student' ? 1 : 0;
  seg.style.setProperty('--i', idx);
  seg.querySelectorAll('.seg-opt').forEach(b => {
    const on = b.dataset.target === target;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const cls = document.getElementById('commClassTarget');
  const stu = document.getElementById('commStudentTarget');
  cls.classList.toggle('open', target === 'class');
  stu.classList.toggle('open', target === 'student');
  cls.toggleAttribute('inert', target !== 'class');
  stu.toggleAttribute('inert', target !== 'student');
};

function _commTarget() {
  return document.querySelector('#commTargetSeg .seg-opt.on')?.dataset.target || 'class';
}

function _commRenderStudentTrigger() {
  const el = document.getElementById('commStuTrigger');
  if (!el) return;
  const s = _commPickedStudent;
  const chevron = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
  if (!s) {
    el.classList.add('placeholder');
    el.innerHTML = `<span>${t('comms.chooseStudent')}</span>${chevron}`;
    return;
  }
  const hex = s.home_color ? homeColorHex(s.home_color) : '#8A8A82';
  const grade = window.getStudentGrade(s);
  el.classList.remove('placeholder');
  el.innerHTML = `
    <span class="comm-stu-pick">
      <span class="picker-avatar" style="background:${hex}">${avatarContent(s)}</span>
      <span class="comm-stu-text">
        <div class="comm-stu-name">${esc(s.name_en || s.name_local)}</div>
        <div class="comm-stu-sub">${esc([grade, s.class].filter(Boolean).join(' · '))}</div>
      </span>
    </span>${chevron}`;
}

window.commPickStudent = function() {
  // The message modal STAYS OPEN underneath: the picker is just another layer
  // on the modal stack, and closing it reveals this form exactly as it was
  // (typed text, chosen purpose and all). It used to clone the modal's HTML
  // and re-open the clone, which stacked a second copy of the form — with
  // duplicate element ids, so taps hit the wrong copy — and needed several
  // Close taps to get out.
  const clsSel = document.getElementById('commClass');
  openStudentPicker({
    title:  t('comms.pickerTitle'),
    classFilter: clsSel?.value || 'All',
    onPick: (s) => { _commPickedStudent = s; _commRenderStudentTrigger(); },
  });
};

window.sendParentComm = async function() {
  const btn = document.getElementById('sendCommBtn');
  const msg = document.getElementById('commMsg').value.trim();
  if (!msg) { showToast(t('comms.msgRequired')); return; }

  const isIndividual = _commTarget() === 'student';
  const className = document.getElementById('commClass')?.value || '';
  if (isIndividual && !_commPickedStudent) {
    showToast(t('comms.pickStudentFirst')); return;
  }
  if (!isIndividual && !className) {
    showToast(t('comms.pickClassFirst')); return;
  }

  btn.disabled = true; btn.textContent = t('comms.sending');
  try {
       const res = await API.sendParentComm({
      message_preview: msg,
      class:           isIndividual ? (_commPickedStudent?.class || '') : className,
      student_id:      isIndividual ? _commPickedStudent?.student_id   : null,
      name_en:         isIndividual ? _commPickedStudent?.name_en      : null,
      type:            document.getElementById('commType')?.value || 'General',
      date:            new Date().toISOString().slice(0, 10),
    });
    if (res?.comm) {
      window.APP.parentComms = window.APP.parentComms || [];
      window.APP.parentComms.unshift(res.comm);
      if (typeof _renderCommsList === 'function') _renderCommsList();
    }
    closeModal();
    showToast(t('comms.sent'));
    if (window.APP.tg?.HapticFeedback) window.APP.tg.HapticFeedback.notificationOccurred('success');
  } catch (e) {
    btn.disabled = false; btn.textContent = t('comms.send');
    showToast(t('common.failed') + ' ' + (e.message || t('common.error')));
  }
};
