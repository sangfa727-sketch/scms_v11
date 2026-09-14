/**
 * SCMS v11.7 — 19_google_auth.js
 * Google Sign-In (email-based auth) + "Connect Telegram" linking.
 *
 * Architecture:
 *   • Landing screen gets a "Sign in with Google" button (Google Identity
 *     Services / GIS) alongside the existing Telegram + Teacher ID options.
 *   • GIS returns a signed ID token to the browser. We do NOT trust it
 *     ourselves — we POST it to the `google-login` Supabase Edge Function,
 *     which verifies the token server-side (signature/audience/issuer) and
 *     only then calls rpc_google_login with the service_role key.
 *   • Session shape returned is identical to the existing web-session
 *     (session_token, teacher_id, role, ...) so it reuses getWebSession(),
 *     verifyWebSession(), webLogout() etc. from 00_landing.js untouched.
 *   • First-time sign-in with no matching account and no invite code shows
 *     a choice screen: "Register a new school" (becomes admin) or
 *     "I have an invite code" (join existing school as teacher/admin).
 *   • Once logged in (any method), Settings gets a "Connect Telegram" /
 *     "Disconnect Telegram" control using the same deep-link + poll pattern
 *     as the original Telegram login, via rpc_telegram_connect_start/finish.
 */

'use strict';

/* ============================================================================
   GOOGLE SIGN-IN BUTTON (landing screen)
============================================================================ */

let _gisInitialized = false;
let _gisPendingChoice = null; // { id_token } while waiting on invite/new-school choice

function _ensureGisInitialized() {
  if (_gisInitialized) return true;
  if (!window.google?.accounts?.id) return false;
  if (!SCMS_CONFIG.GOOGLE_CLIENT_ID || SCMS_CONFIG.GOOGLE_CLIENT_ID.indexOf('PASTE_') === 0) {
    console.warn('[SCMS] GOOGLE_CLIENT_ID not configured — Google Sign-In disabled.');
    return false;
  }
  window.google.accounts.id.initialize({
    client_id: SCMS_CONFIG.GOOGLE_CLIENT_ID,
    callback: _onGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  _gisInitialized = true;
  return true;
}

/**
 * Renders the official Google button into a container. Call this after
 * renderLanding() has put #googleSignInBtn into the DOM.
 */
window.renderGoogleSignInButton = function (containerId) {
  if (!_ensureGisInitialized()) return;
  const el = document.getElementById(containerId || 'googleSignInBtn');
  if (!el) return;
  try {
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 280,
    });
  } catch (e) { /* GIS not ready yet — ignore, button area stays empty */ }
};

async function _onGoogleCredential(response) {
  const idToken = response?.credential;
  if (!idToken) return;
  await _submitGoogleLogin(idToken, {});
}

/**
 * Sends the Google ID token (plus optional invite_code / new_school_name)
 * to the Edge Function, which verifies it and returns a session — or a
 * needs_choice response if this is a brand-new Google account.
 */
async function _submitGoogleLogin(idToken, extra) {
  _setGoogleStatus('Signing in…');
  try {
    const resp = await fetch(SCMS_CONFIG.GOOGLE_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: idToken,
        device_ua: navigator.userAgent.slice(0, 200),
        invite_code: extra.invite_code || null,
        new_school_name: extra.new_school_name || null,
        teacher_name: extra.teacher_name || null,
      }),
    });
    const result = await resp.json();

    if (result && result.ok) {
      const webSession = {
        type: 'web',
        auth_mode: 'google',
        session_token: result.session_token,
        teacher_id: result.teacher_id,
        teacher_name: result.teacher_name,
        school_id: result.school_id,
        role: result.role,
        must_change_password: false,
        logged_in_at: Date.now(),
      };
      try { localStorage.setItem('scms_web_session', JSON.stringify(webSession)); } catch (e) {}
      _closeGoogleChoiceModal();
      if (typeof window.bootAfterLogin === 'function') window.bootAfterLogin({ webSession });
      else window.location.reload();
      return;
    }

    if (result && result.error === 'no_account' && result.needs_choice) {
      _gisPendingChoice = { id_token: idToken };
      _openGoogleChoiceModal();
      return;
    }

    _setGoogleStatus(result?.message || 'Sign-in မအောင်မြင်ပါ', true);
  } catch (e) {
    _setGoogleStatus('Connection error — အင်တာနက် စစ်ပါ', true);
  }
}

function _setGoogleStatus(text, isError) {
  // Prefer the choice-modal's status element when it's open (it's the one
  // the user is actually looking at); fall back to the landing page's.
  const el = document.getElementById('googleChoiceStatus') || document.getElementById('googleAuthStatus');
  if (!el) return;
  el.textContent = text || '';
  el.style.display = text ? 'block' : 'none';
  el.className = isError ? 'form-error' : 'login-help-text';
}

/* ============================================================================
   NEW-ACCOUNT CHOICE MODAL — "Register a new school" vs "I have an invite code"
============================================================================ */

window.openGoogleChoiceModal = _openGoogleChoiceModal;
function _openGoogleChoiceModal() {
  const wrap = document.createElement('div');
  wrap.id = 'googleChoiceModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">👋 ကြိုဆိုပါတယ်</h3>
      <p class="modal-subtitle">ဒီ Google account နဲ့ account မရှိသေးပါ။ ဘာလုပ်ချင်ပါသလဲ?</p>

      <button class="landing-btn-ghost" onclick="showGoogleNewSchoolForm()">
        <span class="landing-btn-icon">🏫</span>
        <div class="landing-btn-text">
          <div class="landing-btn-title">School အသစ် စတင်မည်</div>
          <div class="landing-btn-sub">သင်က admin ဖြစ်လာပါမယ်</div>
        </div>
      </button>
      <button class="landing-btn-ghost mt8" onclick="showGoogleInviteForm()">
        <span class="landing-btn-icon">✉️</span>
        <div class="landing-btn-text">
          <div class="landing-btn-title">Invite code ရှိပါတယ်</div>
          <div class="landing-btn-sub">Admin ပေးထားတဲ့ code နဲ့ join ဝင်မည်</div>
        </div>
      </button>

      <div id="googleChoiceForm"></div>
      <div id="googleChoiceStatus" class="form-error" style="display:none"></div>

      <button class="btn-secondary mt16" onclick="closeGoogleChoiceModal()">Cancel</button>
    </div>`;
  wrap.onclick = _closeGoogleChoiceModal;
  document.body.appendChild(wrap);
}

window.closeGoogleChoiceModal = _closeGoogleChoiceModal;
function _closeGoogleChoiceModal() {
  document.getElementById('googleChoiceModal')?.remove();
  _gisPendingChoice = null;
}

window.showGoogleNewSchoolForm = function () {
  const form = document.getElementById('googleChoiceForm');
  if (!form) return;
  form.innerHTML = `
    <label class="field-label">Your name</label>
    <input class="form-input" id="gNewTeacherName" type="text" placeholder="e.g. Sangfa">
    <label class="field-label">School name</label>
    <input class="form-input" id="gNewSchoolName" type="text" placeholder="e.g. Vavida ISB">
    <button class="btn-primary mt16" onclick="submitGoogleNewSchool()">School စတင်မည်</button>
  `;
};

window.submitGoogleNewSchool = async function () {
  if (!_gisPendingChoice) return;
  const name = document.getElementById('gNewTeacherName')?.value.trim();
  const school = document.getElementById('gNewSchoolName')?.value.trim();
  if (!school) { _setGoogleStatus('School name ထည့်ပါ', true); return; }
  await _submitGoogleLogin(_gisPendingChoice.id_token, {
    new_school_name: school,
    teacher_name: name || null,
  });
};

window.showGoogleInviteForm = function () {
  const form = document.getElementById('googleChoiceForm');
  if (!form) return;
  form.innerHTML = `
    <label class="field-label">Your name</label>
    <input class="form-input" id="gInviteTeacherName" type="text" placeholder="e.g. Sangfa">
    <label class="field-label">Invite code</label>
    <input class="form-input" id="gInviteCode" type="text" placeholder="e.g. AC3F79"
           autocapitalize="characters" style="text-transform:uppercase">
    <button class="btn-primary mt16" onclick="submitGoogleInvite()">Join</button>
  `;
};

window.submitGoogleInvite = async function () {
  if (!_gisPendingChoice) return;
  const name = document.getElementById('gInviteTeacherName')?.value.trim();
  const code = document.getElementById('gInviteCode')?.value.trim().toUpperCase();
  if (!code) { _setGoogleStatus('Invite code ထည့်ပါ', true); return; }
  await _submitGoogleLogin(_gisPendingChoice.id_token, {
    invite_code: code,
    teacher_name: name || null,
  });
};

/* ============================================================================
   TELEGRAM-CONNECT (Settings — for users who logged in via Google/password)
   Same deep-link + poll pattern as the original Telegram login in
   00_landing.js, but hitting rpc_telegram_connect_start/finish instead of
   directly reading/writing app_sessions, and attaching to the CURRENT
   logged-in teacher rather than creating a new session.
============================================================================ */

let _tgConnectTimer = null;
let _tgConnectToken = null;

window.openTelegramConnectModal = function () {
  const sess = (typeof getWebSession === 'function') ? getWebSession() : null;
  if (!sess || !sess.session_token) return;

  const wrap = document.createElement('div');
  wrap.id = 'tgConnectModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal-sheet" onclick="event.stopPropagation()" style="max-width:380px">
      <div class="modal-handle"></div>
      <h3 class="modal-title">🔗 Telegram ချိတ်ဆက်မည်</h3>
      <p class="modal-subtitle">Parent report များနှင့် backup login အတွက် Telegram ကို ချိတ်ဆက်ထားပါ။</p>

      <div id="tgConnectStatus" class="login-help-text">Telegram bot ကို ဖွင့်ပြီး Start နှိပ်ပါ…</div>

      <button class="btn-primary mt16" id="tgConnectOpenBtn" onclick="startTelegramConnect()">
        Telegram ဖွင့်မည်
      </button>
      <button class="btn-secondary" onclick="closeTelegramConnectModal()">Cancel</button>
    </div>`;
  wrap.onclick = closeTelegramConnectModal;
  document.body.appendChild(wrap);
};

window.closeTelegramConnectModal = function () {
  _stopTelegramConnectPolling();
  document.getElementById('tgConnectModal')?.remove();
};

window.startTelegramConnect = async function () {
  const sess = getWebSession();
  if (!sess || !sess.session_token) return;

  const statusEl = document.getElementById('tgConnectStatus');
  const btn = document.getElementById('tgConnectOpenBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening Telegram…'; }

  try {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_telegram_connect_start`, {
      method: 'POST',
      headers: {
        'apikey': SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_session_token: sess.session_token }),
    });
    const result = await resp.json();
    if (!result || !result.ok) {
      if (statusEl) statusEl.textContent = result?.message || 'ချိတ်ဆက်မရပါ — ထပ်ကြိုးစားပါ';
      if (btn) { btn.disabled = false; btn.textContent = 'Telegram ဖွင့်မည်'; }
      return;
    }

    _tgConnectToken = result.connect_token;
    const bot = SCMS_CONFIG.BOT_USERNAME || 'VavidaISBbot';
    const url = `https://t.me/${bot}?start=connect_${encodeURIComponent(_tgConnectToken)}`;

    if (typeof _openTelegram === 'function') _openTelegram(url);
    else window.open(url, '_blank', 'noopener');

    if (statusEl) statusEl.textContent = 'Telegram ထဲမှာ Start နှိပ်ပါ… စောင့်နေပါတယ်';
    if (btn) btn.textContent = 'ထပ်ဖွင့်မည်';
    if (btn) btn.disabled = false;

    _startTelegramConnectPolling(sess.session_token, _tgConnectToken);
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Connection error';
    if (btn) { btn.disabled = false; btn.textContent = 'Telegram ဖွင့်မည်'; }
  }
};

function _startTelegramConnectPolling(sessionToken, connectToken) {
  _stopTelegramConnectPolling();
  let attempts = 0;
  _tgConnectTimer = setInterval(async () => {
    attempts++;
    if (attempts > 150) { // ~5 min at 2s
      _stopTelegramConnectPolling();
      const statusEl = document.getElementById('tgConnectStatus');
      if (statusEl) statusEl.textContent = 'Timed out — ထပ်ကြိုးစားပါ';
      return;
    }
    try {
      const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_telegram_connect_finish`, {
        method: 'POST',
        headers: {
          'apikey': SCMS_CONFIG.SUPABASE_ANON,
          'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_session_token: sessionToken, p_connect_token: connectToken }),
      });
      const result = await resp.json();
      if (result && result.ok) {
        _stopTelegramConnectPolling();
        if (window.APP) window.APP.telegram_id = result.telegram_id;
        showToast?.('✓ Telegram ချိတ်ဆက်ပြီးပါပြီ');
        closeTelegramConnectModal();
        if (typeof window.openSettings === 'function') window.openSettings();
      } else if (result && result.error && result.error !== 'not_linked_yet') {
        _stopTelegramConnectPolling();
        const statusEl = document.getElementById('tgConnectStatus');
        if (statusEl) statusEl.textContent = result.message || 'ချိတ်ဆက်မရပါ';
      }
      // 'not_linked_yet' → keep polling silently
    } catch (e) { /* keep polling */ }
  }, 2000);
}

function _stopTelegramConnectPolling() {
  if (_tgConnectTimer) { clearInterval(_tgConnectTimer); _tgConnectTimer = null; }
  _tgConnectToken = null;
}

window.disconnectTelegram = async function () {
  const sess = getWebSession();
  if (!sess || !sess.session_token) return;
  if (!confirm('Telegram ချိတ်ဆက်မှုကို ဖြုတ်မလား?')) return;

  try {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_telegram_disconnect`, {
      method: 'POST',
      headers: {
        'apikey': SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_session_token: sess.session_token }),
    });
    const result = await resp.json();
    if (result && result.ok) {
      if (window.APP) window.APP.telegram_id = null;
      showToast?.('Telegram ဖြုတ်ပြီးပါပြီ');
      if (typeof window.openSettings === 'function') window.openSettings();
    }
  } catch (e) { /* best effort */ }
};

/* ============================================================================
   ADMIN — INVITE MANAGEMENT (Settings → Manage Teachers)
============================================================================ */

window.createTeacherInvite = async function (role, teacherName) {
  const sess = getWebSession();
  if (!sess || !sess.session_token) return null;

  try {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_admin_create_invite`, {
      method: 'POST',
      headers: {
        'apikey': SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_session_token: sess.session_token,
        p_role: role || 'teacher',
        p_teacher_name: teacherName || null,
      }),
    });
    return await resp.json();
  } catch (e) {
    return { ok: false, error: 'connection_error' };
  }
};

window.listTeacherInvites = async function () {
  const sess = getWebSession();
  if (!sess || !sess.session_token) return { ok: false, invites: [] };

  try {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_admin_list_invites`, {
      method: 'POST',
      headers: {
        'apikey': SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_session_token: sess.session_token }),
    });
    return await resp.json();
  } catch (e) {
    return { ok: false, invites: [] };
  }
};
