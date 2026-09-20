/**
 * SCMS v11 — 21_billing.js
 * Fee / Billing: catalog of fee items, invoices per student (with line
 * items), and payments recorded against an invoice. Status (Unpaid /
 * Partial / Paid / Overdue) is computed server-side (rpc_get_invoices /
 * rpc_record_payment) from paid_amount vs total_amount and due_date.
 *
 * Web only for now — this is a new feature with no n8n/Telegram equivalent
 * yet, same as Grading & Assessment.
 */

'use strict';

let _billingClass    = 'All';
let _billingStatus   = 'All';
let _billingTermId   = null;
let _billingTerms    = [];
let _billingFeeItems = [];
let _billingInvoices = [];
let _newInvoiceStudent = null;
let _newInvoiceItems   = [];

const BILLING_STATUSES = ['All', 'Unpaid', 'Partial', 'Paid', 'Overdue'];

let _billingLoadedOnce = false;

async function renderBilling() {
  const listEl = document.getElementById('billingInvoiceList');
  // Only show the skeleton on the very first load — a page revisit already
  // has content on screen, so re-clearing it here just causes a flash.
  if (!_billingLoadedOnce && listEl) listEl.innerHTML = skeletonCards(2);

  try {
    const [terms, feeItems] = await Promise.all([API.getTerms(), API.getFeeItems()]);
    _billingTerms    = terms || [];
    _billingFeeItems = feeItems || [];
    _billingLoadedOnce = true;
  } catch (e) {
    if (!_billingLoadedOnce && listEl) listEl.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  if ((!_billingTermId || !_billingTerms.some(t => t.id === _billingTermId)) && _billingTerms.length) {
    _billingTermId = (_billingTerms.find(t => t.is_current) || _billingTerms[0]).id;
  }

  _renderBillingFilters();
  await _loadAndRenderInvoices();
}

function _renderBillingFilters() {
  const classes = ['All', ...getClassList()];
  const clsEl    = document.getElementById('billingClassPicker');
  const statusEl = document.getElementById('billingStatusPicker');
  const termEl   = document.getElementById('billingTermPicker');
  if (!clsEl || !statusEl || !termEl) return;

  clsEl.innerHTML = classes.map(c =>
    `<button class="chip${c === _billingClass ? ' active' : ''}" onclick="selectBillingClass('${esc(c)}')">${esc(c)}</button>`
  ).join('');

  statusEl.innerHTML = BILLING_STATUSES.map(s =>
    `<button class="chip${s === _billingStatus ? ' active' : ''}" onclick="selectBillingStatus('${esc(s)}')">${esc(s)}</button>`
  ).join('');

  termEl.innerHTML = _billingTerms.length
    ? `<div class="attend-class-select-wrap">
         <select class="attend-class-select" onchange="selectBillingTerm(this.value)">
           <option value=""${!_billingTermId ? ' selected' : ''}>All terms</option>
           ${_billingTerms.map(t => `<option value="${t.id}"${t.id === _billingTermId ? ' selected' : ''}>${esc(t.term_name)}${t.is_current ? ' (current)' : ''}</option>`).join('')}
         </select>
       </div>`
    : '';
}

window.selectBillingClass = function(cls) {
  _billingClass = cls;
  document.querySelectorAll('#billingClassPicker .chip').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === cls));
  _loadAndRenderInvoices();
};

window.selectBillingStatus = function(status) {
  _billingStatus = status;
  document.querySelectorAll('#billingStatusPicker .chip').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === status));
  _loadAndRenderInvoices();
};

window.selectBillingTerm = function(val) {
  _billingTermId = val ? Number(val) : null;
  _loadAndRenderInvoices();
};

async function _loadAndRenderInvoices() {
  const el = document.getElementById('billingInvoiceList');
  const summaryEl = document.getElementById('billingSummary');
  if (!el) return;

  el.innerHTML = skeletonCards(2);

  const filters = {
    class:   _billingClass !== 'All' ? _billingClass : null,
    status:  _billingStatus !== 'All' ? _billingStatus : null,
    term_id: _billingTermId,
  };

  try {
    const [invoices, summary] = await Promise.all([
      API.getInvoices(filters),
      API.getBillingSummary({ class: filters.class, term_id: filters.term_id }),
    ]);
    _billingInvoices = invoices;
    if (summaryEl) _renderBillingSummary(summaryEl, summary);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  if (!_billingInvoices.length) {
    el.innerHTML = `<div class="empty-state">No invoices yet — tap + to bill a student.</div>`;
    return;
  }

  el.innerHTML = _billingInvoices.map(inv => `
    <div class="list-card" onclick="openInvoiceDetail(${inv.id})">
      <div class="card-row">
        <div class="card-info">
          <div class="card-name">${esc(inv.name_en || inv.student_id)} <span class="type-tag">${esc(inv.invoice_number || '')}</span></div>
          <div class="card-sub">${esc(inv.class || '')} · Due ${inv.due_date ? esc(fmtDate(inv.due_date)) : '—'} · ${esc(String(inv.total_amount))} total</div>
        </div>
        <div class="card-actions">
          <span class="billing-status-badge billing-status-${esc((inv.display_status || inv.status).toLowerCase())}">${esc(inv.display_status || inv.status)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function _renderBillingSummary(el, s) {
  el.innerHTML = `
    <div class="billing-summary-row">
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Billed</div>
        <div class="billing-summary-value">${esc(String(s.total_billed))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Collected</div>
        <div class="billing-summary-value">${esc(String(s.total_collected))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Outstanding</div>
        <div class="billing-summary-value">${esc(String(s.outstanding))}</div>
      </div>
      <div class="billing-summary-cell">
        <div class="billing-summary-label">Overdue</div>
        <div class="billing-summary-value${s.overdue_count > 0 ? ' danger' : ''}">${esc(String(s.overdue_count))}</div>
      </div>
    </div>`;
}

/* ─── New invoice ────────────────────────────────────────────────────── */

window.openNewInvoiceModal = function() {
  _newInvoiceStudent = null;
  _newInvoiceItems   = [];
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">New Invoice</h3>

      <label class="field-label">Student</label>
      <button class="form-input billing-student-btn" id="niStudentBtn" onclick="_pickInvoiceStudent()">Choose a student…</button>

      <label class="field-label">Term (optional)</label>
      <div class="attend-class-select-wrap">
        <select class="attend-class-select" id="niTerm">
          <option value="">No term</option>
          ${_billingTerms.map(t => `<option value="${t.id}"${t.is_current ? ' selected' : ''}>${esc(t.term_name)}</option>`).join('')}
        </select>
      </div>

      <label class="field-label">Due date</label>
      <input class="form-input" id="niDueDate" type="date">

      <label class="field-label">Line items</label>
      <div id="niItemsList"></div>
      <button class="btn-pill-action ghost" onclick="_addInvoiceLineItem()">+ Add line item</button>

      <div class="billing-total-row" id="niTotalRow">Total: 0</div>

      <label class="field-label">Notes</label>
      <input class="form-input" id="niNotes" placeholder="Optional">

      <button class="btn-primary mt16" id="niSaveBtn" onclick="_saveNewInvoice()">Create invoice</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
  _renderInvoiceItemsList();
};

window._pickInvoiceStudent = function() {
  openStudentPicker({
    title: 'Bill which student?',
    onPick: (s) => {
      _newInvoiceStudent = s;
      const btn = document.getElementById('niStudentBtn');
      if (btn) { btn.textContent = `${s.name_en || s.name_local} (${s.class || '—'})`; btn.classList.add('picked'); }
    },
  });
};

window._addInvoiceLineItem = function(feeItem = null) {
  _newInvoiceItems.push({
    fee_item_id: feeItem?.id || null,
    description: feeItem?.name || '',
    amount:      feeItem?.default_amount ?? 0,
  });
  _renderInvoiceItemsList();
};

window._removeInvoiceLineItem = function(idx) {
  _newInvoiceItems.splice(idx, 1);
  _renderInvoiceItemsList();
};

window._updateInvoiceLineItem = function(idx, field, val) {
  if (!_newInvoiceItems[idx]) return;
  _newInvoiceItems[idx][field] = field === 'amount' ? (Number(val) || 0) : val;
  _renderInvoiceTotal();
};

function _renderInvoiceItemsList() {
  const el = document.getElementById('niItemsList');
  if (!el) return;

  const catalogRow = _billingFeeItems.length
    ? `<div class="attend-class-select-wrap mb8">
         <select class="attend-class-select" onchange="_pickCatalogItem(this)">
           <option value="">+ Add from catalog…</option>
           ${_billingFeeItems.map(f => `<option value="${f.id}">${esc(f.name)} (${esc(String(f.default_amount))})</option>`).join('')}
         </select>
       </div>`
    : '';

  el.innerHTML = catalogRow + _newInvoiceItems.map((it, idx) => `
    <div class="billing-line-item" data-idx="${idx}">
      <input class="form-input" placeholder="Description" value="${esc(it.description)}"
        oninput="_updateInvoiceLineItem(${idx},'description',this.value)">
      <input class="form-input billing-amount-input" type="number" min="0" value="${esc(String(it.amount))}"
        oninput="_updateInvoiceLineItem(${idx},'amount',this.value);_renderInvoiceTotal()">
      <button class="icon-btn-mini danger" onclick="_removeInvoiceLineItem(${idx})" title="Remove">🗑</button>
    </div>
  `).join('');

  _renderInvoiceTotal();
}

window._pickCatalogItem = function(sel) {
  const id = Number(sel.value);
  sel.value = '';
  if (!id) return;
  const item = _billingFeeItems.find(f => f.id === id);
  if (item) window._addInvoiceLineItem(item);
};

function _renderInvoiceTotal() {
  const row = document.getElementById('niTotalRow');
  if (!row) return;
  const total = _newInvoiceItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  row.textContent = `Total: ${total}`;
}

window._saveNewInvoice = async function() {
  if (!_newInvoiceStudent) { showToast('Choose a student'); return; }
  const items = _newInvoiceItems.filter(it => it.description && it.description.trim());
  if (!items.length) { showToast('Add at least one line item'); return; }

  const btn = document.getElementById('niSaveBtn');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await API.createInvoice({
      student_id: _newInvoiceStudent.student_id,
      term_id:    Number(document.getElementById('niTerm').value) || null,
      due_date:   document.getElementById('niDueDate').value || null,
      notes:      document.getElementById('niNotes').value.trim() || null,
      items,
    });
    closeModal();
    showToast('✓ Invoice created');
    await _loadAndRenderInvoices();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Create invoice';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

/* ─── Invoice detail (line items + payments) ────────────────────────── */

window.openInvoiceDetail = async function(id) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto" id="invoiceDetailSheet">
      <div class="modal-handle"></div>
      <div id="invoiceDetailBody">${skeletonCards(2)}</div>
      <button class="btn-secondary mt16" onclick="closeModal()">Close</button>
    </div>
  `);
  await _loadInvoiceDetail(id);
};

async function _loadInvoiceDetail(id) {
  const body = document.getElementById('invoiceDetailBody');
  if (!body) return;
  let data;
  try {
    data = await API.getInvoiceDetail(id);
  } catch (e) {
    body.innerHTML = `<div class="empty-state">Failed to load: ${esc(e.message || 'error')}</div>`;
    return;
  }

  const inv = data.invoice, items = data.items || [], payments = data.payments || [];
  const balance = Number(inv.total_amount) - Number(inv.paid_amount);
  const isOverdue = ['Unpaid', 'Partial'].includes(inv.status) && inv.due_date && inv.due_date < new Date().toISOString().slice(0,10);
  const displayStatus = isOverdue ? 'Overdue' : inv.status;

  body.innerHTML = `
    <h3 class="modal-title mb0">${esc(inv.name_en || inv.student_id)}</h3>
    <p class="modal-subtitle">${esc(inv.class || '')} · ${esc(inv.invoice_number || '')}
      <span class="billing-status-badge billing-status-${esc(displayStatus.toLowerCase())}">${esc(displayStatus)}</span>
    </p>

    <div class="billing-detail-items">
      ${items.map(it => `
        <div class="billing-detail-row">
          <span>${esc(it.description)}</span>
          <span>${esc(String(it.amount))}</span>
        </div>
      `).join('')}
      <div class="billing-detail-row total">
        <span>Total</span><span>${esc(String(inv.total_amount))}</span>
      </div>
      <div class="billing-detail-row">
        <span>Paid</span><span>${esc(String(inv.paid_amount))}</span>
      </div>
      <div class="billing-detail-row balance${balance > 0 ? ' danger' : ''}">
        <span>Balance</span><span>${esc(String(balance))}</span>
      </div>
    </div>

    ${inv.notes ? `<p class="billing-notes">${esc(inv.notes)}</p>` : ''}

    <div class="billing-payments-section">
      <div class="billing-section-title">Payments</div>
      ${payments.length ? payments.map(p => `
        <div class="billing-payment-row">
          <span>${esc(fmtDate(p.payment_date))} · ${esc(p.method)}</span>
          <span>${esc(String(p.amount))}</span>
          <button class="icon-btn-mini danger" onclick="_confirmDeletePayment(${p.id}, ${inv.id})" title="Remove">🗑</button>
        </div>
      `).join('') : `<div class="billing-payments-empty">No payments recorded yet.</div>`}
    </div>

    ${balance > 0 ? `<button class="btn-primary mt16" onclick="_openRecordPayment(${inv.id}, ${balance})">Record payment</button>` : ''}
    <button class="btn-secondary" onclick="_confirmDeleteInvoice(${inv.id})">Delete invoice</button>
  `;
}

window._openRecordPayment = function(invoiceId, balance) {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Record payment</h3>
      <label class="field-label">Amount (balance: ${esc(String(balance))})</label>
      <input class="form-input" id="rpAmount" type="number" min="0" max="${esc(String(balance))}" value="${esc(String(balance))}">
      <label class="field-label">Date</label>
      <input class="form-input" id="rpDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
      <label class="field-label">Method</label>
      <div class="pill-group" id="rpMethodPills">
        ${['Cash', 'Bank Transfer', 'Mobile', 'Other'].map((m, i) =>
          `<button type="button" class="pill${i === 0 ? ' active' : ''}" onclick="togglePill(this,'rpMethodPills')">${m}</button>`
        ).join('')}
      </div>
      <label class="field-label">Notes</label>
      <input class="form-input" id="rpNotes" placeholder="Optional">
      <button class="btn-primary mt16" id="rpSaveBtn" onclick="_saveRecordPayment(${invoiceId})">Save payment</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._saveRecordPayment = async function(invoiceId) {
  const amount = Number(document.getElementById('rpAmount').value);
  if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }

  const btn = document.getElementById('rpSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await API.recordPayment(invoiceId, {
      amount,
      payment_date: document.getElementById('rpDate').value || null,
      method: document.querySelector('#rpMethodPills .pill.active')?.textContent.trim() || 'Cash',
      notes: document.getElementById('rpNotes').value.trim() || null,
    });
    await _loadInvoiceDetail(invoiceId);
    await _loadAndRenderInvoices();
    closeModal();
    showToast('✓ Payment recorded');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save payment';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._confirmDeletePayment = function(paymentId, invoiceId) {
  showConfirm(
    '🗑 Remove this payment?',
    'The invoice balance will be recalculated.',
    'Remove',
    async () => {
      try {
        await API.deletePayment(paymentId);
        showToast('✓ Removed');
        await _loadInvoiceDetail(invoiceId);
        await _loadAndRenderInvoices();
      } catch (e) {
        showToast('Failed: ' + (e.message || 'error'));
      }
    }
  );
};

window._confirmDeleteInvoice = function(id) {
  showConfirm(
    '🗑 Delete this invoice?',
    'All line items and payments for it will be removed too — this can\'t be undone.',
    'Delete',
    async () => {
      try {
        await API.deleteInvoice(id);
        closeModal();
        showToast('✓ Deleted');
        await _loadAndRenderInvoices();
      } catch (e) {
        showToast('Delete failed: ' + (e.message || 'error'));
      }
    }
  );
};

/* ─── Fee items catalog (manage from Billing page) ─────────────────────── */

window.openFeeItemsManager = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-height:85vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Fee items</h3>
      <div id="feeItemsList"></div>
      <button class="btn-pill-action ghost" onclick="_openAddFeeItem()">+ Add fee item</button>
      <button class="btn-secondary mt16" onclick="closeModal()">Close</button>
    </div>
  `);
  _renderFeeItemsList();
};

function _renderFeeItemsList() {
  const el = document.getElementById('feeItemsList');
  if (!el) return;
  if (!_billingFeeItems.length) {
    el.innerHTML = `<div class="empty-state">No fee items yet.</div>`;
    return;
  }
  el.innerHTML = _billingFeeItems.map(f => `
    <div class="list-card">
      <div class="card-row">
        <div class="card-info">
          <div class="card-name">${esc(f.name)} <span class="type-tag">${esc(f.category)}</span></div>
          <div class="card-sub">${esc(String(f.default_amount))}${f.is_recurring ? ' · Recurring' : ''}</div>
        </div>
        <div class="card-actions">
          <button class="icon-btn-mini danger" onclick="_confirmDeleteFeeItem(${f.id})" title="Delete">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

window._openAddFeeItem = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:360px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Add fee item</h3>
      <label class="field-label">Name</label>
      <input class="form-input" id="fiName" placeholder="e.g. Tuition Term 1">
      <label class="field-label">Category</label>
      <div class="pill-group" id="fiCategoryPills">
        ${['Tuition', 'Transport', 'Meals', 'Uniform', 'Books', 'Activity', 'Other'].map((c, i) =>
          `<button type="button" class="pill${i === 0 ? ' active' : ''}" onclick="togglePill(this,'fiCategoryPills')">${c}</button>`
        ).join('')}
      </div>
      <label class="field-label">Default amount</label>
      <input class="form-input" id="fiAmount" type="number" min="0" value="0">
      <button class="btn-primary mt16" id="fiSaveBtn" onclick="_saveNewFeeItem()">Add</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window._saveNewFeeItem = async function() {
  const name = document.getElementById('fiName').value.trim();
  if (!name) { showToast('Enter a name'); return; }

  const btn = document.getElementById('fiSaveBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await API.addFeeItem({
      name,
      category: document.querySelector('#fiCategoryPills .pill.active')?.textContent.trim() || 'Other',
      default_amount: Number(document.getElementById('fiAmount').value) || 0,
      is_recurring: true,
    });
    _billingFeeItems = await API.getFeeItems();
    _renderFeeItemsList(); // refresh the manager sheet underneath, in place
    closeModal();           // pop just this "Add fee item" layer
    showToast('✓ Fee item added');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Add';
    showToast('Failed: ' + (e.message || 'error'));
  }
};

window._confirmDeleteFeeItem = function(id) {
  showConfirm(
    '🗑 Delete this fee item?',
    'It will be removed from the catalog. Existing invoices are unaffected.',
    'Delete',
    async () => {
      try {
        await API.deleteFeeItem(id);
        _billingFeeItems = await API.getFeeItems();
        showToast('✓ Deleted');
        _renderFeeItemsList();
      } catch (e) {
        showToast('Failed: ' + (e.message || 'error'));
      }
    }
  );
};
