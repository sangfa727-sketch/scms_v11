/**
 * SCMS v11 — 24_library.js
 * Book catalog + checkout/return tracking.
 *
 * All detail/edit/checkout views render into a SINGLE modal body
 * (#bookDetailBody) that gets its innerHTML swapped — same pattern learned
 * from Admissions/Billing: never a second stacked openModal() call once the
 * detail sheet is open, and object data (like the current book) is kept in
 * a module-level cache rather than round-tripped through onclick HTML
 * attributes (that caused a real, hard-to-spot bug in Health Records).
 *
 * Web only for now — no n8n/Telegram equivalent yet.
 */

'use strict';

let _libraryBooksAll   = [];
let _libraryLoadedOnce = false;
let _libraryBookCache  = null; // the currently-open book, for the edit/checkout views

async function renderLibrary() {
  const listEl = document.getElementById('libraryList');
  if (_libraryLoadedOnce) {
    _renderLibraryList();
  } else if (listEl) {
    listEl.innerHTML = skeletonCards(2);
  }

  try {
    _libraryBooksAll = await API.getBooks();
    _libraryLoadedOnce = true;
  } catch (e) {
    if (!_libraryLoadedOnce && listEl) listEl.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  _renderLibrarySummary();
  _renderLibraryList();
}

function _renderLibrarySummary() {
  const el = document.getElementById('librarySummary');
  if (!el) return;
  const totalTitles = _libraryBooksAll.length;
  const totalCopies = _libraryBooksAll.reduce((s, b) => s + Number(b.total_copies || 0), 0);
  const checkedOut  = _libraryBooksAll.reduce((s, b) => s + Number(b.checked_out_count || 0), 0);
  el.innerHTML = `
    <div class="billing-summary-row">
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Titles</div>
        <div class="billing-summary-value">${esc(String(totalTitles))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Copies</div>
        <div class="billing-summary-value">${esc(String(totalCopies))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Checked out</div>
        <div class="billing-summary-value">${esc(String(checkedOut))}</div>
      </div>
    </div>`;
}

function _renderLibraryList() {
  const el = document.getElementById('libraryList');
  if (!el) return;

  if (!_libraryBooksAll.length) {
    el.innerHTML = `<div class="empty-state">No books yet — tap + to add one.</div>`;
    return;
  }

  el.innerHTML = _libraryBooksAll.map(b => `
    <div class="list-card" onclick="openBookDetail(${b.id})">
      <div class="card-row">
        <div class="card-info">
          <div class="card-name">${esc(b.title)} ${b.category ? `<span class="type-tag">${esc(b.category)}</span>` : ''}</div>
          <div class="card-sub">${esc(b.author || 'Unknown author')}</div>
        </div>
        <div class="card-actions">
          <span class="adm-status-badge ${b.available_copies > 0 ? 'adm-status-accepted' : 'adm-status-rejected'}">${esc(String(b.available_copies))}/${esc(String(b.total_copies))}</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ─── New book ───────────────────────────────────────────────────────── */

window.openNewBookModal = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">New book</h3>
      <label class="field-label">Title</label>
      <input class="form-input" id="nbTitle" placeholder="Book title">
      <label class="field-label">Author</label>
      <input class="form-input" id="nbAuthor" placeholder="Optional">
      <label class="field-label">Category</label>
      <input class="form-input" id="nbCategory" placeholder="e.g. Fiction, Reference (optional)">
      <label class="field-label">ISBN</label>
      <input class="form-input" id="nbIsbn" placeholder="Optional">
      <label class="field-label">Copies</label>
      <input class="form-input" id="nbCopies" type="number" min="1" value="1">
      <label class="field-label">Notes</label>
      <input class="form-input" id="nbNotes" placeholder="Optional">
      <button class="btn-primary mt16" id="nbSaveBtn" onclick="_saveNewBook()">Add book</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._saveNewBook = async function() {
  const title = document.getElementById('nbTitle').value.trim();
  if (!title) { showToast('Enter a title'); return; }

  const btn = document.getElementById('nbSaveBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await API.addBook({
      title,
      author: document.getElementById('nbAuthor').value.trim() || null,
      category: document.getElementById('nbCategory').value.trim() || null,
      isbn: document.getElementById('nbIsbn').value.trim() || null,
      total_copies: Number(document.getElementById('nbCopies').value) || 1,
      notes: document.getElementById('nbNotes').value.trim() || null,
    });
    closeModal();
    showToast('✓ Book added');
    await renderLibrary();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add book';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Detail (single modal — sub-views swap #bookDetailBody in place) ──── */

window.openBookDetail = function(id) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <div id="bookDetailBody">${skeletonCards(1)}</div>
    </div>
  `);
  _loadBookDetail(id);
};

async function _loadBookDetail(id) {
  const el = document.getElementById('bookDetailBody');
  if (!el) return;
  try {
    _libraryBookCache = _libraryBooksAll.find(b => b.id === id) || null;
    const checkouts = await API.getBookCheckouts(id);
    _renderBookDetailView(id, checkouts);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
  }
}

function _renderBookDetailView(id, checkouts) {
  const el = document.getElementById('bookDetailBody');
  if (!el) return;
  const b = _libraryBookCache;
  if (!b) { el.innerHTML = `<div class="empty-state">Book not found.</div>`; return; }

  const active = checkouts.filter(c => !c.returned_date);
  const past   = checkouts.filter(c => c.returned_date);

  el.innerHTML = `
    <h3 class="modal-title">${esc(b.title)}</h3>
    <div class="billing-detail-items">
      <div class="billing-detail-row"><span>Author</span><span>${esc(b.author || '—')}</span></div>
      <div class="billing-detail-row"><span>Category</span><span>${esc(b.category || '—')}</span></div>
      <div class="billing-detail-row"><span>ISBN</span><span>${esc(b.isbn || '—')}</span></div>
      <div class="billing-detail-row"><span>Copies</span><span>${esc(String(b.available_copies))} available / ${esc(String(b.total_copies))} total</span></div>
    </div>
    ${b.notes ? `<p class="billing-notes">${esc(b.notes)}</p>` : ''}

    ${b.available_copies > 0 ? `<button class="btn-primary mt16" onclick="_showCheckoutView(${id})">Check out to a student</button>` : ''}

    <div class="billing-section-title mt16">Currently checked out</div>
    ${active.length ? active.map(c => `
      <div class="row-with-delete">
        <span>${esc(c.student_name)} <span class="muted-note">since ${esc(fmtDate(c.checked_out_date))}${c.due_date ? ', due ' + esc(fmtDate(c.due_date)) : ''}</span></span>
        <button class="btn-pill-action ghost" onclick="_returnBook(${c.id}, ${id})">Return</button>
      </div>
    `).join('') : `<p class="muted-note">None right now.</p>`}

    ${past.length ? `
      <div class="billing-section-title mt16">History</div>
      ${past.map(c => `
        <div class="row-with-delete">
          <span>${esc(c.student_name)}</span>
          <span class="muted-note">${esc(fmtDate(c.checked_out_date))} → ${esc(fmtDate(c.returned_date))}</span>
        </div>
      `).join('')}
    ` : ''}

    <button class="btn-secondary mt16" onclick="_showEditBookView(${id})">Edit book</button>
    <button class="btn-secondary" onclick="_confirmDeleteBook(${id})">Delete book</button>
  `;
}

window._showEditBookView = function(id) {
  const el = document.getElementById('bookDetailBody');
  if (!el) return;
  const b = _libraryBookCache;
  if (!b) return;

  el.innerHTML = `
    <h3 class="modal-title">Edit book</h3>
    <label class="field-label">Title</label>
    <input class="form-input" id="ebTitle" value="${esc(b.title)}">
    <label class="field-label">Author</label>
    <input class="form-input" id="ebAuthor" value="${esc(b.author || '')}">
    <label class="field-label">Category</label>
    <input class="form-input" id="ebCategory" value="${esc(b.category || '')}">
    <label class="field-label">ISBN</label>
    <input class="form-input" id="ebIsbn" value="${esc(b.isbn || '')}">
    <label class="field-label">Total copies</label>
    <input class="form-input" id="ebCopies" type="number" min="0" value="${esc(String(b.total_copies))}">
    <label class="field-label">Notes</label>
    <input class="form-input" id="ebNotes" value="${esc(b.notes || '')}">
    <button class="btn-primary mt16" id="ebSaveBtn" onclick="_saveEditBook(${id})">Save changes</button>
    <button class="btn-secondary" onclick="_loadBookDetail(${id})">Cancel</button>
  `;
};

window._saveEditBook = async function(id) {
  const title = document.getElementById('ebTitle').value.trim();
  if (!title) { showToast('Title is required'); return; }

  const btn = document.getElementById('ebSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.updateBook(id, {
      title,
      author: document.getElementById('ebAuthor').value.trim() || null,
      category: document.getElementById('ebCategory').value.trim() || null,
      isbn: document.getElementById('ebIsbn').value.trim() || null,
      total_copies: Number(document.getElementById('ebCopies').value),
      notes: document.getElementById('ebNotes').value.trim() || null,
    });
    showToast('✓ Saved');
    await renderLibrary();
    await _loadBookDetail(id);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save changes';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._showCheckoutView = function(id) {
  const el = document.getElementById('bookDetailBody');
  if (!el) return;
  el.innerHTML = `
    <h3 class="modal-title">Check out</h3>
    <label class="field-label">Student</label>
    <button type="button" class="form-picker-trigger" id="coStudentBtn" onclick="openStudentPicker({onPick:_onCheckoutStudentPicked})">
      <span class="form-picker-value" id="coStudent_label">Select student</span>
      <svg class="form-picker-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <input type="hidden" id="coStudentId" value="">
    <label class="field-label">Due date</label>
    <input class="form-input" id="coDueDate" type="date">
    <button class="btn-primary mt16" id="coSaveBtn" onclick="_saveCheckout(${id})">Check out</button>
    <button class="btn-secondary" onclick="_loadBookDetail(${id})">Cancel</button>
  `;
};

window._onCheckoutStudentPicked = function(student) {
  document.getElementById('coStudentId').value = student.student_id;
  document.getElementById('coStudent_label').textContent = student.name_en;
};

window._saveCheckout = async function(id) {
  const studentId = document.getElementById('coStudentId').value;
  if (!studentId) { showToast('Pick a student'); return; }

  const btn = document.getElementById('coSaveBtn');
  btn.disabled = true; btn.textContent = 'Checking out…';
  try {
    await API.checkoutBook(id, studentId, document.getElementById('coDueDate').value || null, null);
    showToast('✓ Checked out');
    await renderLibrary();
    await _loadBookDetail(id);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Check out';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._returnBook = async function(checkoutId, bookId) {
  try {
    await API.returnBook(checkoutId);
    showToast('✓ Returned');
    await renderLibrary();
    await _loadBookDetail(bookId);
  } catch (e) {
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._confirmDeleteBook = function(id) {
  showConfirm(
    '🗑 Delete this book?',
    'This only works if no copies are currently checked out.',
    'Delete',
    async () => {
      try {
        await API.deleteBook(id);
        closeModal();
        showToast('✓ Deleted');
        await renderLibrary();
      } catch (e) {
        const msg = e.code === 'has_active_checkouts' ? 'Return all copies before deleting this book.' : (e.message || 'error');
        showToast('Delete failed: ' + msg);
      }
    }
  );
};
