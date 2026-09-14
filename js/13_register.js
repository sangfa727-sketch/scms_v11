/**
 * SCMS v11 — 13_register.js
 * Registration flows handled via Telegram bot — no frontend registration UI needed.
 * Kept for compatibility with existing module loading order.
 */

'use strict';

window.openRegisterModal = function() {
  openModal(`
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <h3 class="modal-title">Registration</h3>
      <p style="color:var(--muted);font-size:14px;line-height:1.6">
        To register a new school or join as a teacher,
        please use the <strong>Telegram bot</strong> commands:
      </p>
      <div class="cmd-block"><code>/register_school</code> — create new school</div>
      <div class="cmd-block"><code>/register_teacher</code> — join existing school</div>
      <p style="color:var(--muted);font-size:13px;margin-top:12px">
        Once approved by the admin, your account will be active
        and this dashboard will load automatically.
      </p>
      <button class="btn-secondary mt16" onclick="closeModal()">Got it</button>
    </div>`);
};
