/**
 * SCMS v11 — 20_grades.js
 * Grading & Assessment: pick a term/subject/class, list assessments for
 * that combination, create new ones, and enter scores in bulk. Percentage
 * and letter grade are computed server-side (rpc_save_grades) from the
 * assessment's max_score and the school's config_json.grade_scale.
 *
 * Web only for now — this is a new feature with no n8n/Telegram equivalent
 * yet, unlike the other pages which have a twaPost fallback.
 */

'use strict';

let _gradesTermId      = null;
let _gradesSubjectId   = null;
let _gradesClass       = null;
let _gradesTerms       = [];
let _gradesSubjects    = [];
let _gradesAssessments = [];

async function renderGrades() {
  const listEl = document.getElementById('gradesAssessmentList');
  if (listEl) listEl.innerHTML = skeletonCards(2);

  try {
    const [terms, subjects] = await Promise.all([API.getTerms(), _ensureSubjectsLoaded()]);
    _gradesTerms    = terms || [];
    _gradesSubjects = subjects || [];
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  if ((!_gradesTermId || !_gradesTerms.some(t => t.id === _gradesTermId)) && _gradesTerms.length) {
    _gradesTermId = (_gradesTerms.find(t => t.is_current) || _gradesTerms[0]).id;
  }
  if ((!_gradesSubjectId || !_gradesSubjects.some(s => s.id === _gradesSubjectId)) && _gradesSubjects.length) {
    _gradesSubjectId = _gradesSubjects[0].id;
  }

  const classes = [...new Set(
    (window.APP.students || []).filter(s => s.status === 'Active').map(s => s.class).filter(Boolean)
  )].sort();
  if ((!_gradesClass || !classes.includes(_gradesClass)) && classes.length) _gradesClass = classes[0];

  _renderGradesFilters(classes);
  await _loadAndRenderAssessments();
}

function _renderGradesFilters(classes) {
  const termEl = document.getElementById('gradesTermPicker');
  const subjEl = document.getElementById('gradesSubjectPicker');
  const clsEl  = document.getElementById('gradesClassPicker');
  if (!termEl || !subjEl || !clsEl) return;

  termEl.innerHTML = _gradesTerms.length
    ? `<div class="attend-class-select-wrap">
         <select class="attend-class-select" onchange="selectGradesTerm(this.value)">
           ${_gradesTerms.map(t => `<option value="${t.id}"${t.id === _gradesTermId ? ' selected' : ''}>${esc(t.term_name)}${t.is_current ? ' (current)' : ''}</option>`).join('')}
         </select>
       </div>`
    : `<button class="btn-pill-action ghost" onclick="openAddTermPrompt()">+ Add term</button>`;

  subjEl.innerHTML = `
    <div class="attend-class-select-wrap">
      <select class="attend-class-select" onchange="handleGradesSubjectChange(this)">
        ${_gradesSubjects.map(s => `<option value="${s.id}"${s.id === _gradesSubjectId ? ' selected' : ''}>${esc(s.subject_name)}</option>`).join('')}
        <option value="__add__">+ Add subject…</option>
      </select>
    </div>`;

  clsEl.innerHTML = classes.length
    ? classes.map(c => `<button class="chip${c === _gradesClass ? ' active' : ''}" onclick="selectGradesClass('${esc(c)}')">${esc(c)}</button>`).join('')
    : `<span class="chip-empty">Add students first</span>`;
}

window.selectGradesTerm = function(id) {
  _gradesTermId = Number(id);
  _loadAndRenderAssessments();
};

window.handleGradesSubjectChange = function(sel) {
  if (sel.value === '__add__') {
    const opts = [...sel.options].filter(o => o.value !== '__add__');
    sel.value = opts[0]?.value || '';
    openAddSubjectPrompt((newSubj) => {
      _gradesSubjectId = newSubj.id;
      renderGrades();
    });
    return;
  }
  _gradesSubjectId = Number(sel.value);
  _loadAndRenderAssessments();
};

window.selectGradesClass = function(cls) {
  _gradesClass = cls;
  document.querySelectorAll('#gradesClassPicker .chip').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === cls));
  _loadAndRenderAssessments();
};

async function _loadAndRenderAssessments() {
  const el = document.getElementById('gradesAssessmentList');
  if (!el) return;

  if (!_gradesClass) {
    el.innerHTML = `<div class="empty-state">No classes yet — add students first.</div>`;
    return;
  }

  el.innerHTML = skeletonCards(2);
  try {
    _gradesAssessments = await API.getAssessments({
      class: _gradesClass, subject_id: _gradesSubjectId, term_id: _gradesTermId,
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  if (!_gradesAssessments.length) {
    el.innerHTML = `<div class="empty-state">No assessments yet for this class/subject/term — tap + to add one.</div>`;
    return;
  }

  el.innerHTML = _gradesAssessments.map(a => `
    <div class="list-card" onclick="openGradeEntry(${a.id})">
      <div class="card-row">
        <div class="card-info">
          <div class="card-name">${esc(a.title)} <span class="type-tag">${esc(a.type)}</span></div>
          <div class="card-sub">${esc(fmtDate(a.date))} · Max ${esc(String(a.max_score))} · Weight ${esc(String(a.weight))}%</div>
        </div>
        <div class="card-actions">
          <button class="icon-btn-mini danger" onclick="event.stopPropagation();confirmDeleteAssessment(${a.id})" title="Delete">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ─── New assessment ─────────────────────────────────────────────── */

window.openNewAssessmentModal = function() {
  if (!_gradesClass) { showToast('Pick a class first'); return; }

  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">New Assessment</h3>
      <p class="modal-subtitle">${esc(_gradesClass)}</p>

      <label class="field-label">Title</label>
      <input class="form-input" id="gaTitle" placeholder="e.g. Quiz 1, Midterm Exam">

      <label class="field-label">Type</label>
      <div class="pill-group" id="gaTypePills">
        ${['Quiz', 'Test', 'Exam', 'Assignment', 'Project'].map((t, i) =>
          `<button type="button" class="pill${i === 0 ? ' active' : ''}" onclick="togglePill(this,'gaTypePills')">${t}</button>`
        ).join('')}
      </div>

      <div class="form-row">
        <div class="form-col">
          <label class="field-label">Max score</label>
          <input class="form-input" id="gaMax" type="number" value="100" min="1">
        </div>
        <div class="form-col">
          <label class="field-label">Weight (%)</label>
          <input class="form-input" id="gaWeight" type="number" value="10" min="0" max="100">
        </div>
      </div>

      <label class="field-label">Date</label>
      <input class="form-input" id="gaDate" type="date" value="${new Date().toISOString().slice(0, 10)}">

      <button class="btn-primary mt16" id="gaSaveBtn" onclick="saveNewAssessment()">Create</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window.saveNewAssessment = async function() {
  const btn   = document.getElementById('gaSaveBtn');
  const title = document.getElementById('gaTitle').value.trim();
  if (!title) { showToast('Enter a title'); return; }

  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const res = await API.createAssessment({
      term_id:    _gradesTermId,
      subject_id: _gradesSubjectId,
      class:      _gradesClass,
      title,
      type:       document.querySelector('#gaTypePills .pill.active')?.textContent.trim() || 'Assignment',
      max_score:  Number(document.getElementById('gaMax').value) || 100,
      weight:     Number(document.getElementById('gaWeight').value) || 0,
      date:       document.getElementById('gaDate').value || null,
    });
    closeModal();
    showToast('✓ Assessment created');
    await _loadAndRenderAssessments();
    if (res?.assessment?.id) openGradeEntry(res.assessment.id);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Create';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window.confirmDeleteAssessment = function(id) {
  showConfirm(
    '🗑 Delete this assessment?',
    'All scores recorded for it will be removed too — this can\'t be undone.',
    'Delete',
    async () => {
      try {
        await API.deleteAssessment(id);
        showToast('✓ Deleted');
        await _loadAndRenderAssessments();
      } catch (e) {
        showToast('Delete failed: ' + (e.message || 'error'));
      }
    }
  );
};

/* ─── Score entry ─────────────────────────────────────────────────── */

window.openGradeEntry = async function(assessmentId) {
  const a = _gradesAssessments.find(x => x.id === assessmentId);
  if (!a) return;

  const students = (window.APP.students || [])
    .filter(s => s.class === a.class && s.status === 'Active')
    .sort((x, y) => (x.name_en || '').localeCompare(y.name_en || ''));

  let existing = [];
  try { existing = await API.getGrades(assessmentId); } catch (e) { /* fresh assessment, no grades yet */ }
  const byStudent = Object.fromEntries(existing.map(g => [g.student_id, g]));

  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">${esc(a.title)}</h3>
      <p class="modal-subtitle">${esc(a.class)} · Max score ${esc(String(a.max_score))}</p>

      <div id="gradeEntryRows">
        ${students.map(s => {
          const g = byStudent[s.student_id];
          return `
            <div class="grade-entry-row" data-student="${esc(s.student_id)}">
              <div class="grade-entry-name">${esc(s.name_en || s.name_local || s.student_id)}</div>
              <input class="form-input grade-entry-score" type="number" min="0" max="${esc(String(a.max_score))}"
                placeholder="—" value="${g && g.score != null ? esc(String(g.score)) : ''}"
                oninput="_updateGradePreview(this, ${Number(a.max_score) || 0})">
              <div class="grade-entry-pct">${g && g.letter_grade ? `${g.percentage}% · ${esc(g.letter_grade)}` : ''}</div>
            </div>`;
        }).join('')}
      </div>

      <button class="btn-primary mt16" id="gradeSaveBtn" onclick="saveGradeEntry(${assessmentId})">Save scores</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._updateGradePreview = function(input, maxScore) {
  const row   = input.closest('.grade-entry-row');
  const pctEl = row.querySelector('.grade-entry-pct');
  const v     = parseFloat(input.value);
  if (isNaN(v) || !maxScore) { pctEl.textContent = ''; return; }
  const pct = Math.round((v / maxScore) * 1000) / 10;
  pctEl.textContent = `${pct}%`;
};

window.saveGradeEntry = async function(assessmentId) {
  const btn  = document.getElementById('gradeSaveBtn');
  const rows = document.querySelectorAll('#gradeEntryRows .grade-entry-row');
  const records = [...rows].map(row => ({
    student_id: row.dataset.student,
    score:      row.querySelector('.grade-entry-score').value || null,
    comment:    null,
  })).filter(r => r.score !== null && r.score !== '');

  if (!records.length) { showToast('Enter at least one score'); return; }

  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.saveGrades(assessmentId, records);
    closeModal();
    showToast('✓ Scores saved');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save scores';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Add a term (shown when none exist yet) ───────────────────────── */

window.openAddTermPrompt = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Add term</h3>
      <label class="field-label">Term name</label>
      <input class="form-input" id="newTermName" placeholder="e.g. Term 1">
      <label class="field-label">Academic year</label>
      <input class="form-input" id="newTermYear" placeholder="e.g. 2026-2027">
      <div class="form-row">
        <div class="form-col">
          <label class="field-label">Start date</label>
          <input class="form-input" id="newTermStart" type="date">
        </div>
        <div class="form-col">
          <label class="field-label">End date</label>
          <input class="form-input" id="newTermEnd" type="date">
        </div>
      </div>
      <button class="btn-primary mt16" id="addTermBtn" onclick="_confirmAddTerm()">Add</button>
      <button class="btn-secondary mt8" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._confirmAddTerm = async function() {
  const name = document.getElementById('newTermName').value.trim();
  if (!name) { showToast('Enter a term name'); return; }

  const btn = document.getElementById('addTermBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await API.addTerm({
      term_name:     name,
      academic_year: document.getElementById('newTermYear').value.trim() || null,
      start_date:    document.getElementById('newTermStart').value || null,
      end_date:      document.getElementById('newTermEnd').value || null,
      term_order:    (_gradesTerms.length || 0) + 1,
      is_current:    _gradesTerms.length === 0,
    });
    closeModal();
    showToast('✓ Term added');
    renderGrades();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add';
    showToast('Failed: ' + (e.message || 'error'));
  }
};
