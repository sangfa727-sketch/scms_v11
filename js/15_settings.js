/**
 * SCMS v11 — 15_settings.js
 * Settings panel — multi-tenant, no URL/key setup needed.
 */

'use strict';

function _loginMethodLabel(isWeb) {
  if (!isWeb) return 'Telegram';
  const mode = window.APP.webSession?.auth_mode;
  if (mode === 'google') return 'Google account';
  return 'Web (password)';
}

window.openSettings = function() {
  const isWeb   = !!(window.APP && window.APP.webSession);
  const isAdmin = !!(window.APP && window.APP.is_admin);

  const html = `
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">⚙️ Settings</h3>

      <div class="info-row"><span>Version</span><span>v${esc(SCMS_CONFIG.VERSION)}</span></div>
      <div class="info-row"><span>Platform</span><span>${esc(window.APP.platform)}</span></div>
      <div class="info-row"><span>School</span><span>${esc(window.APP.school_name)}</span></div>
      <div class="info-row"><span>Teacher</span><span>${esc(window.APP.teacher_name)}</span></div>
      <div class="info-row"><span>Role</span><span>${esc(window.APP.teacher_role)}</span></div>
      <div class="info-row"><span>Login</span><span>${esc(_loginMethodLabel(isWeb))}</span></div>
      <div class="info-row"><span>Telegram</span><span>${window.APP.telegram_id ? '🟢 Connected' : '⚪ Not connected'}</span></div>

      ${isAdmin ? `
        <button class="btn-primary mt16" onclick="closeModal(); openTeacherManager()">
          👥 Manage Teachers
        </button>
      ` : ''}

      ${isWeb && !window.APP.telegram_id ? `
        <button class="btn-secondary mt8" onclick="closeModal(); openTelegramConnectModal()">
          🔗 Connect Telegram
        </button>
      ` : ''}
      ${isWeb && window.APP.telegram_id ? `
        <button class="btn-secondary mt8" onclick="disconnectTelegram()">
          🔌 Disconnect Telegram
        </button>
      ` : ''}

      ${isWeb && window.APP.webSession?.auth_mode !== 'google' ? `
        <button class="btn-secondary mt8" onclick="closeModal(); openChangePasswordModal()">
          🔑 Change my password
        </button>
      ` : ''}
      ${isWeb ? `
        <button class="btn-secondary mt8" onclick="webLogout()">
          🚪 Sign out
        </button>
      ` : ''}

      <p class="settings-footer-note">
        SCMS is managed by your school administrator.
      </p>

      <button class="btn-secondary mt16" onclick="closeModal()">Close</button>
    </div>`;

  openModal(html);
};


/* ============================================================================
   TEACHER MANAGER (admin only)
============================================================================ */
window.openTeacherManager = async function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:480px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">👥 Manage Teachers</h3>
      <p class="modal-subtitle">Create login accounts for your teachers.</p>

      <button class="btn-primary" onclick="openCreateTeacherModal()">+ Add new teacher (Teacher ID + password)</button>
      <button class="btn-secondary mt8" onclick="openInviteCodeModal()">✉️ Invite via Google (share a code)</button>

      <div id="teacherList" class="teacher-list mt16">
        <div class="text-center text-muted">Loading…</div>
      </div>

      <button class="btn-secondary mt16" onclick="closeModal()">Close</button>
    </div>
  `);

  // Load teachers from the same school
  try {
    const res = await _webRpc('rpc_admin_list_teachers', {
      p_session_token: getWebSession()?.session_token,
    });
    _renderTeacherList(res.rows || []);
  } catch (e) {
    document.getElementById('teacherList').innerHTML =
      '<div class="form-error">Failed to load teachers</div>';
  }
};

function _renderTeacherList(teachers) {
  const el = document.getElementById('teacherList');
  if (!el) return;
  if (!teachers.length) {
    el.innerHTML = '<div class="text-muted text-center">No teachers yet.</div>';
    return;
  }
  el.innerHTML = teachers.map(t => {
    const lastLogin = t.last_web_login_at
      ? new Date(t.last_web_login_at).toLocaleDateString()
      : 'Never';
    const roleBadge = (t.role === 'admin' || t.role === 'super_admin') ? ' 👑' : '';
    const statusDot = t.status === 'active' ? '🟢' : '⚪';
    return `
      <div class="teacher-row" data-tid="${esc(t.teacher_id)}">
        <div class="teacher-row-info">
          <div class="teacher-row-name">${statusDot} ${esc(t.teacher_name)}${roleBadge}</div>
          <div class="teacher-row-sub">${esc(t.teacher_id)} · ${esc(t.role || 'teacher')} · Last login: ${esc(lastLogin)}</div>
        </div>
        <button class="icon-btn-mini" onclick="resetTeacherPassword('${esc(t.teacher_id)}', '${esc(t.teacher_name)}')" title="Reset password">🔑</button>
      </div>`;
  }).join('');
}

/* ============================================================================
   INVITE VIA GOOGLE (admin only) — v11.7
   Alternative to password-based accounts: admin generates a short code,
   shares it out-of-band, the teacher signs in with their own Google account
   and redeems the code to join this school.
============================================================================ */
window.openInviteCodeModal = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">✉️ Invite via Google</h3>
      <p class="modal-subtitle">Teacher သူ့ဖာသာ Google account နဲ့ login ဝင်ပြီး ဒီ code နဲ့ join နိုင်ပါမယ်။</p>

      <label class="field-label">Name (optional)</label>
      <input class="form-input" id="invTName" placeholder="e.g. Daw Hla Hla">

      <label class="field-label">Role *</label>
      <select class="form-input" id="invTRole">
        <option value="teacher">Teacher</option>
        <option value="admin">Admin</option>
      </select>

      <button class="btn-primary mt16" id="invGenBtn" onclick="doGenerateInvite()">Code ထုတ်မည်</button>

      <div id="invCodeResult" style="display:none" class="mt16">
        <div class="info-row"><span>Invite code</span><span id="invCodeValue" style="font-weight:700;letter-spacing:2px"></span></div>
        <p class="form-help">ဒီ code ကို teacher ဆီ ပို့ပေးပါ (14 ရက် အတွင်း သုံးရပါမယ်)။ Teacher က Google Sign-In ကနေ "Invite code ရှိပါတယ်" ရွေးပြီး ဒီ code ရိုက်ထည့်ရင် ရပါပြီ။</p>
      </div>

      <div id="invPastList" class="mt16"></div>

      <button class="btn-secondary mt16" onclick="closeModal(); openTeacherManager()">Back</button>
    </div>
  `);
  _loadPastInvites();
};

window.doGenerateInvite = async function() {
  const name = document.getElementById('invTName')?.value.trim() || null;
  const role = document.getElementById('invTRole')?.value;
  const btn = document.getElementById('invGenBtn');
  btn.disabled = true;
  btn.textContent = 'ထုတ်နေသည်…';

  const result = await createTeacherInvite(role, name);

  btn.disabled = false;
  btn.textContent = 'Code ထုတ်မည်';

  if (!result || !result.ok) {
    showToast('Invite ထုတ်မရပါ: ' + (result?.message || result?.error || 'unknown'));
    return;
  }

  document.getElementById('invCodeResult').style.display = 'block';
  document.getElementById('invCodeValue').textContent = result.invite_code;
  _loadPastInvites();
};

async function _loadPastInvites() {
  const el = document.getElementById('invPastList');
  if (!el) return;
  const result = await listTeacherInvites();
  if (!result || !result.ok || !result.invites?.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<div class="field-label">အရင် invites</div>' + result.invites.map(inv => {
    const status = inv.redeemed_at
      ? `✅ Used by ${esc(inv.redeemed_by_teacher_id || '')}`
      : (new Date(inv.expires_at) < new Date() ? '⌛ Expired' : '⏳ Pending');
    return `<div class="info-row"><span>${esc(inv.invite_code)} (${esc(inv.role)})</span><span>${status}</span></div>`;
  }).join('');
}

window.openCreateTeacherModal = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">+ New teacher</h3>
      <p class="modal-subtitle">Create a login. They'll be forced to change the starter password.</p>

      <label class="field-label">Teacher ID *</label>
      <input class="form-input" id="newTId" placeholder="e.g. T1001" autocapitalize="off">

      <label class="field-label">Teacher name *</label>
      <input class="form-input" id="newTName" placeholder="e.g. Daw Hla Hla">

      <label class="field-label">Email (optional)</label>
      <input class="form-input" id="newTEmail" type="email" placeholder="teacher@school.edu">

      <label class="field-label">Role *</label>
      <select class="form-input" id="newTRole">
        <option value="teacher">Teacher</option>
        <option value="admin">Admin (can manage other teachers)</option>
      </select>

      <label class="field-label">Starting password (≥ 6 characters) *</label>
      <input class="form-input" id="newTPw" type="text" placeholder="temp1234" value="temp1234">
      <p class="form-help">Share this password securely with the teacher. They'll change it on first login.</p>

      <div id="newTError" class="form-error" style="display:none"></div>

      <button class="btn-primary mt16" id="newTBtn" onclick="doCreateTeacher()">Create account</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window.doCreateTeacher = async function() {
  const id    = document.getElementById('newTId')?.value.trim();
  const name  = document.getElementById('newTName')?.value.trim();
  const email = document.getElementById('newTEmail')?.value.trim() || null;
  const role  = document.getElementById('newTRole')?.value;
  const pw    = document.getElementById('newTPw')?.value;
  const errEl = document.getElementById('newTError');
  const btn   = document.getElementById('newTBtn');
  errEl.style.display = 'none';

  if (!id || !name || !pw) {
    errEl.textContent = 'Teacher ID, name, password ၃ ခုလုံး ထည့်ပါ';
    errEl.style.display = 'block';
    return;
  }
  if (pw.length < 6) {
    errEl.textContent = 'Password က ၆ လုံး အနည်းဆုံး လိုပါမယ်';
    errEl.style.display = 'block';
    return;
  }

  const sess = getWebSession();
  if (!sess || !sess.session_token) {
    errEl.textContent = 'Admin session expired. Please sign in again.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_admin_create_teacher`, {
      method: 'POST',
      headers: {
        'apikey':        SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        p_session_token:    sess.session_token,
        p_teacher_id:       id,
        p_teacher_name:     name,
        p_initial_password: pw,
        p_role:             role,
        p_email:            email,
      }),
    });
    const result = await resp.json();
    if (!result || !result.ok) {
      errEl.textContent = (result && result.message) || 'Create failed';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create account';
      return;
    }
    closeModal();
    showToast('✓ Teacher account ဖန်တီးပြီးပါပြီ');
    // Reopen the manager to show the new teacher
    setTimeout(() => openTeacherManager(), 200);
  } catch (e) {
    errEl.textContent = 'Connection error';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Create account';
  }
};

window.resetTeacherPassword = async function(teacherId, teacherName) {
  const newPw = prompt(`Reset password for ${teacherName} (${teacherId}).\n\nNew password (≥ 6 characters):`);
  if (!newPw) return;
  if (newPw.length < 6) {
    showToast('Password က ၆ လုံး အနည်းဆုံး လိုပါမယ်');
    return;
  }

  const sess = getWebSession();
  if (!sess || !sess.session_token) {
    showToast('Admin session expired');
    return;
  }

  try {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_admin_reset_teacher_password`, {
      method: 'POST',
      headers: {
        'apikey':        SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        p_session_token: sess.session_token,
        p_teacher_id:    teacherId,
        p_new_password:  newPw,
      }),
    });
    const result = await resp.json();
    if (!result || !result.ok) {
      showToast('Reset failed: ' + (result?.error || 'unknown'));
      return;
    }
    showToast(`✓ ${teacherName} ၏ password အသစ်: ${newPw}\nshare ပြုလုပ်ပါ`);
  } catch (e) {
    showToast('Connection error');
  }
};
