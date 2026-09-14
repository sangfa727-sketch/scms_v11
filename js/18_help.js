/**
 * SCMS v11 — 18_help.js
 * In-app help system:
 *   • renderHelp()        — full "How to use" page (opened from More menu)
 *   • startFirstTour()    — first-launch coachmark tour
 *   • maybeStartTour()    — runs the tour once for new users
 *
 * Bilingual (Burmese + English). No external dependencies.
 */

'use strict';

/* ────────────────────────────────────────────────────────────────────────
   HELP PAGE — "How to use SCMS"
   Opened via openHelpModal() from the More menu.
   ──────────────────────────────────────────────────────────────────────── */

window.openHelpModal = function () {
  const isAdmin = window.APP.is_admin;

  const html = `
    <div class="modal-sheet help-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>

      <div class="help-hero">
        <div class="help-hero-mark">S</div>
        <div>
          <h3 class="help-hero-title">SCMS အသုံးပြုနည်း</h3>
          <p class="help-hero-sub">How to use · Quick guide</p>
        </div>
      </div>

      <div class="help-tabs">
        <button class="help-tab active" onclick="switchHelpTab(this,'help-basics')">အခြေခံ</button>
        <button class="help-tab" onclick="switchHelpTab(this,'help-features')">လုပ်ဆောင်ချက်</button>
        <button class="help-tab" onclick="switchHelpTab(this,'help-ai')">AI Chat</button>
        ${isAdmin ? `<button class="help-tab" onclick="switchHelpTab(this,'help-admin')">Admin</button>` : ''}
        <button class="help-tab" onclick="switchHelpTab(this,'help-trouble')">ပြဿနာ</button>
        <button class="help-tab" onclick="switchHelpTab(this,'help-about')">About</button>
      </div>

      <div class="help-body">

        <!-- BASICS -->
        <div class="help-pane active" id="help-basics">
          ${_helpSection('🏫', 'SCMS ဆိုတာ ဘာလဲ?',
            'School Class Management System — ကျောင်းတစ်ခုလုံးကို Telegram တစ်ခုထဲက စီမံခန့်ခွဲနိုင်တဲ့ စနစ်ပါ။ Attendance, homework, daily report, parent message အကုန် တစ်နေရာတည်းမှာ။')}

          ${_helpStep('1', 'အကောင့်ဝင်ရန်', 'Telegram bot ထဲက menu button နှိပ်ပြီး app ဖွင့်ပါ။ သင့်အကောင့် auto-detect ဖြစ်ပါတယ်။')}
          ${_helpStep('2', 'အောက်ခြေ tab များ', 'Students · Attend · Daily · HW · More — တစ်ခုချင်း နှိပ်ပြီး သွားနိုင်ပါတယ်။')}
          ${_helpStep('3', '+ ခလုတ် (FAB)', 'ညာဘက်အောက်ခြေက + ခလုတ်က — ဘယ် page မှာ ရှိနေတယ်ဆို အဲ့ဒီ "add" အလုပ်လုပ်ပါတယ်။ ဥပမာ — Students page မှာ ဆို Student အသစ်ထည့်။')}
          ${_helpStep('4', 'Refresh', 'အပေါ်ညာက ↻ ခလုတ်နဲ့ နောက်ဆုံး data ပြန်ဆွဲနိုင်ပါတယ်။')}

          <div class="help-tip">
            <span class="help-tip-icon">💡</span>
            <span><b>Tip:</b> ပထမဆုံး အကြိမ်အတွက် — student တွေ အရင် ထည့်ပါ။ ပြီးမှ attendance, homework စတာတွေ လုပ်လို့ ရပါတယ်။</span>
          </div>
        </div>

        <!-- FEATURES -->
        <div class="help-pane" id="help-features">
          ${_helpFeature('👥', 'Students', [
            'Student card တစ်ခု နှိပ် → အသေးစိတ် ကြည့်ရန်',
            '✎ Edit ခလုတ်နဲ့ — နာမည်, class, birthday, parent email ပြောင်းရန်',
            'Student ထည့်တာနဲ့ — parent link ပေါ်လာ → မိဘဆီ ပို့ → Telegram auto-connect',
            '🎂 emoji — birthday နီးနေတဲ့ student ပြ',
          ])}
          ${_helpFeature('✅', 'Attendance', [
            'Date strip — ဘယ်ရက်အတွက် မှတ်မလဲ ရွေး',
            'Student တစ်ယောက်ချင်း — P/A/L/T/S/E/H code နှိပ်',
            '"All Present" — အကုန်လုံး Present တစ်ချက်တည်း',
            '✏️ note — "ဘာကြောင့်" ဆိုတဲ့ မှတ်ချက် ထည့်နိုင်',
            '"Save Attendance" — အဆုံးမှာ နှိပ်ဖို့ မမေ့ပါနဲ့',
          ])}
          ${_helpFeature('📋', 'Daily Reports', [
            'Student တစ်ယောက်ချင်း — meal, mood, nap, behaviour မှတ်',
            'မိဘဆီ ပို့ဖို့ အသင့်',
            '✎ နဲ့ ပြန်ပြင်, 🗑 နဲ့ ဖျက်နိုင်',
          ])}
          ${_helpFeature('📚', 'Homework', [
            'Subject, class, type, description ထည့်',
            'LB/WB page number ထည့်နိုင်',
            'Due date သတ်မှတ်နိုင်',
            '✎ Edit / 🗑 Delete',
          ])}
          ${_helpFeature('💬', 'Parent Messages', [
            'Whole class ဒါမှမဟုတ် individual student ရွေး',
            'Message ရိုက်ပြီး ပို့',
            'Telegram ထဲ parent ဆီ တိုက်ရိုက် ရောက်',
          ])}
          ${_helpFeature('⚡', 'Incidents', [
            'Behaviour, achievement, health မှတ်တမ်း',
            'Severity (Info/Low/Medium/High) သတ်မှတ်',
            'Parent notified checkbox',
          ])}
        </div>

        <!-- AI CHAT -->
        <div class="help-pane" id="help-ai">
          ${_helpSection('🤖', 'AI Smart Assistant',
            'Telegram chat ထဲမှာ — form မဖြည့်ဘဲ — စကားပြောရုံနဲ့ data ထည့်လို့ ရပါတယ်။ မြန်မာလို ရော English လို ရော နားလည်ပါတယ်။')}

          <div class="help-ai-examples">
            <div class="help-ai-label">ဒီလို ပြောကြည့်ပါ —</div>
            ${_helpChat('teacher', 'Adam ဒီနေ့ မလာဘူး')}
            ${_helpChat('ai', '✓ Adam → Absent မှတ်ပြီးပါပြီ')}
            ${_helpChat('teacher', 'Hannah ဖျားနေတယ်')}
            ${_helpChat('ai', '✓ Hannah → Sick မှတ်ပြီးပါပြီ')}
            ${_helpChat('teacher', 'P4 ကို မနက်ဖြန် Maths test ရှိတယ်လို့ ပြော')}
            ${_helpChat('ai', '✓ Homework saved · မိဘဆီ broadcast ပို့ပြီး')}
            ${_helpChat('teacher', 'မနေ့က Maths HW ဖျက်')}
            ${_helpChat('ai', 'ဘယ်ဟာလဲ? 1. Maths P4 · 2. Maths KG')}
          </div>

          <div class="help-ai-label" style="margin-top:18px">📋 အမျိုးအစားအလိုက် command များ</div>

          ${_helpCheat('✅ Attendance (အတန်းတိုက်)', [
            '"Adam လာတယ်" / "Adam present"',
            '"Hannah မလာဘူး" / "Hannah absent"',
            '"Mg Mg ဖျားနေတယ်" → Sick',
            '"Su Su နောက်ကျတယ်" → Tardy',
            '"P4 အကုန် လာတယ်" → All present',
          ])}

          ${_helpCheat('📚 Homework (အိမ်စာ)', [
            '"P4 ကို Maths page 24-25 ပေး"',
            '"KG ကို English worksheet 3"',
            '"မနေ့က Science HW description ပြောင်း"',
            '"ဒီနေ့ Maths HW ဖျက်"',
          ])}

          ${_helpCheat('📋 Daily Report (နေ့စဉ်)', [
            '"Adam ဒီနေ့ ထမင်း အကုန်စားတယ်၊ ပျော်ရွှင်တယ်"',
            '"Hannah အိပ်ချိန် ၃၀ မိနစ်"',
            '"Adam report ထဲ mood Happy ပြောင်း"',
          ])}

          ${_helpCheat('⚡ Incident (မှတ်တမ်း)', [
            '"Adam သူငယ်ချင်းကို ကူညီတယ် - good behaviour"',
            '"Mg Mg incident severity High ပြောင်း"',
            '"Hannah ရဲ့ incident ဖျက်"',
          ])}

          ${_helpCheat('💬 Parent / Broadcast', [
            '"Adam မိဘကို ဖုန်းဆက်ဖို့ ပြော"',
            '"P4 အကုန်ကို မနက်ဖြန် ကျောင်းပိတ်တယ်လို့ ပြော"',
            '"မှားပို့မိတဲ့ broadcast ဖျက်"',
          ])}

          ${_helpCheat('🔍 မေးမြန်းခြင်း', [
            '"P4 မှာ ဘယ်နှယောက်ရှိလဲ"',
            '"Adam ရဲ့ ဖုန်းနံပါတ်"',
            '"ဒီနေ့ ဘယ်သူတွေ မလာဘူးလဲ"',
            '"student list ပြ"',
          ])}

          <div class="help-tip">
            <span class="help-tip-icon">⚡</span>
            <span><b>AI က လုပ်နိုင်တာ:</b> attendance, daily report, homework, incident, parent message, broadcast, timetable — ထည့်/ပြင်/ဖျက် အကုန်လုံး။ Student list, info တွေ မေးကြည့်လို့လည်း ရ။</span>
          </div>

          <div class="help-tip" style="background:rgba(245,158,11,0.08); border-color:rgba(245,158,11,0.3)">
            <span class="help-tip-icon">💡</span>
            <span><b>သတိ:</b> ဖျက်/ပြင်တဲ့အခါ — AI က "ဘယ်ဟာလဲ?" ဆိုပြီး အရင်မေးပါတယ်။ မှန်တဲ့ဟာ ရွေးပြီးမှ လုပ်ပါတယ် — မှားဖျက်တာ မဖြစ်အောင်။</span>
          </div>
        </div>

        <!-- TROUBLESHOOTING -->
        <div class="help-pane" id="help-trouble">
          ${_helpSection('🔧', 'ပြဿနာ ဖြေရှင်းနည်း',
            'အသုံးပြုရင်း ပြဿနာ တွေ့ရင် — အောက်က ဖြေရှင်းနည်းတွေ စမ်းကြည့်ပါ။')}

          ${_helpTrouble('App မဖွင့်ဘူး / "Connection failed" ပြတယ်',
            'အင်တာနက် ချိတ်ဆက်မှု စစ်ပါ။ ပြီးရင် Retry နှိပ်ပါ။ ၂-၃ ကြိမ် မရရင် — admin ဆီ အကြောင်းကြားပါ။')}

          ${_helpTrouble('Attendance save လုပ်လို့ မရဘူး',
            'အပေါ်က date မှန်/မမှန် စစ်ပါ။ Student တွေ မှတ်ပြီးတဲ့အခါ — အောက်ဆုံးက "Save Attendance" ခလုတ် နှိပ်ဖို့ မမေ့ပါနဲ့။')}

          ${_helpTrouble('Student အသစ်ထည့်လို့ မရဘူး',
            'English name က မဖြစ်မနေ လိုပါတယ် (* မှတ်ထားတဲ့ field)။ Class လည်း ရွေးထားဖို့ လိုပါတယ်။')}

          ${_helpTrouble('မိဘ Telegram ချိတ်လို့ မရဘူး',
            'Student ထည့်ပြီးတဲ့အခါ ပေါ်လာတဲ့ link ကို မိဘဆီ ပို့ပါ။ မိဘက အဲ့ link နှိပ်ပြီး bot ထဲ Start နှိပ်ရပါမယ်။ ၁ မိနစ်လောက် စောင့်ပါ။')}

          ${_helpTrouble('AI က နားမလည်ဘူး',
            'ပိုရှင်းအောင် ပြောကြည့်ပါ။ ဥပမာ — "Adam" တစ်ခုတည်းမဟုတ်ဘဲ "Adam ဒီနေ့ မလာဘူး" လို့ အပြည့်ပြောပါ။ Student နာမည် မှန်အောင် ရိုက်ပါ။')}

          ${_helpTrouble('Data မမြင်ရဘူး / အဟောင်းတွေ ပြနေတယ်',
            'အပေါ်ညာက ↻ refresh ခလုတ် နှိပ်ပါ။ App ပြန်ပိတ်ဖွင့်ကြည့်ပါ။')}

          <div class="help-tip">
            <span class="help-tip-icon">🆘</span>
            <span>ဖြေရှင်းလို့ မရရင် — သင့်ကျောင်း <b>admin</b> ဆီ ဒါမှမဟုတ် <b>support channel</b> ဆီ ဆက်သွယ်ပါ။</span>
          </div>
        </div>

        ${isAdmin ? `
        <!-- ADMIN -->
        <div class="help-pane" id="help-admin">
          ${_helpSection('🛠️', 'Admin Tools',
            'Admin အနေနဲ့ — ကျောင်းတစ်ခုလုံး setting ပြောင်းနိုင်ပါတယ်။')}
          ${_helpFeature('🖼️', 'School Logo', [
            'More → School logo → image upload',
            'Header, sidebar, report တွေမှာ ပေါ်လာ',
          ])}
          ${_helpFeature('🏷️', 'Classes & Grades', [
            'More → Classes & grades',
            'သင့်ကျောင်းသုံး class name (P4 Online, C1...) ထည့်/ဖျက်',
            'Student ထည့်တဲ့အခါ ဒီ list ပေါ်လာ',
          ])}
          ${_helpFeature('🗓️', 'Timetable', [
            'More → Timetable → + နဲ့ period ထည့်',
            'Day, period, class, subject, room',
          ])}
          ${_helpFeature('🏫', 'Registration', [
            'New teacher — bot ထဲ /register_teacher',
            'Admin approve ပြီးမှ teacher account active',
          ])}
        </div>` : ''}

        <!-- ABOUT -->
        <div class="help-pane" id="help-about">
          ${_helpSection('📱', 'About SCMS',
            'SCMS v11 — Telegram-first school management. Made for Myanmar schools.')}
          <div class="help-about-rows">
            <div class="help-about-row"><span>Version</span><span>v${esc(SCMS_CONFIG.VERSION)}</span></div>
            <div class="help-about-row"><span>Platform</span><span>${esc(window.APP.platform)}</span></div>
            <div class="help-about-row"><span>School</span><span>${esc(window.APP.school_name || '—')}</span></div>
          </div>
          ${_helpSection('🆘', 'အကူအညီ လိုရင်',
            'ပြဿနာ တစ်ခုခု ဖြစ်ရင် — သင့်ကျောင်း admin ဆီ ဒါမှမဟုတ် support channel ဆီ ဆက်သွယ်ပါ။')}
          <button class="help-replay-btn" onclick="closeModal(); setTimeout(startFirstTour, 300);">
            🔄 Welcome tour ပြန်ကြည့်မယ်
          </button>
        </div>

      </div>

      <button class="btn-secondary" style="margin-top:14px" onclick="closeModal()">ပိတ်မယ်</button>
    </div>`;

  openModal(html);
};

window.switchHelpTab = function (btn, paneId) {
  document.querySelectorAll('.help-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.help-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(paneId)?.classList.add('active');
  // Scroll body to top
  document.querySelector('.help-body')?.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Help content builders ──────────────────────────────────────────────────
function _helpSection(icon, title, text) {
  return `
    <div class="help-section">
      <div class="help-section-head"><span class="help-section-icon">${icon}</span><h4>${esc(title)}</h4></div>
      <p class="help-section-text">${esc(text)}</p>
    </div>`;
}
function _helpStep(num, title, text) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-body">
        <div class="help-step-title">${esc(title)}</div>
        <div class="help-step-text">${esc(text)}</div>
      </div>
    </div>`;
}
function _helpFeature(icon, title, points) {
  return `
    <div class="help-feature">
      <div class="help-feature-head"><span class="help-feature-icon">${icon}</span><h4>${esc(title)}</h4></div>
      <ul class="help-feature-list">
        ${points.map(p => `<li>${esc(p)}</li>`).join('')}
      </ul>
    </div>`;
}
function _helpChat(who, text) {
  return `<div class="help-chat-row ${who}"><div class="help-chat-bubble">${esc(text)}</div></div>`;
}
function _helpCheat(title, examples) {
  return `
    <div class="help-cheat">
      <div class="help-cheat-title">${esc(title)}</div>
      <ul class="help-cheat-list">
        ${examples.map(e => `<li>${esc(e)}</li>`).join('')}
      </ul>
    </div>`;
}
function _helpTrouble(problem, solution) {
  return `
    <div class="help-trouble">
      <div class="help-trouble-q">❓ ${esc(problem)}</div>
      <div class="help-trouble-a">${esc(solution)}</div>
    </div>`;
}


/* ────────────────────────────────────────────────────────────────────────
   FIRST-LAUNCH TOUR — coachmark overlay
   ──────────────────────────────────────────────────────────────────────── */

const TOUR_KEY = 'scms_tour_done_v1';

const TOUR_STEPS = [
  {
    title: 'SCMS မှ ကြိုဆိုပါတယ် 👋',
    text: 'ကျောင်းတစ်ခုလုံးကို ဒီနေရာက စီမံနိုင်ပါတယ်။ ၅ ဆင့်နဲ့ မိတ်ဆက်ပေးပါမယ်။',
    target: null,  // centered welcome
    emoji: '🏫',
  },
  {
    title: 'Students',
    text: 'ကျောင်းသားတွေ ဒီမှာ ရှိတယ်။ Card တစ်ခု နှိပ်ရင် — အသေးစိတ်ကြည့်/ပြင်နိုင်တယ်။',
    target: '.tab-btn[data-page="students"]',
    emoji: '👥',
  },
  {
    title: 'Attendance',
    text: 'ဒီနေ့ ဘယ်သူလာ/မလာ — P/A/L/T/S/E/H code နဲ့ တစ်ချက်တည်း မှတ်နိုင်တယ်။',
    target: '.tab-btn[data-page="attend"]',
    emoji: '✅',
  },
  {
    title: '+ ခလုတ်',
    text: 'ဒီ + ခလုတ်က — ဘယ် page မှာ ရှိနေတယ်ဆို အဲ့ဒီ "အသစ်ထည့်" အလုပ်လုပ်တယ်။',
    target: '#fab',
    emoji: '➕',
  },
  {
    title: 'More — အကူအညီ ဒီမှာ',
    text: 'More tab ထဲမှာ — အသုံးပြုနည်း အပြည့်အစုံ, admin tools, settings အကုန် ရှိတယ်။',
    target: '.tab-btn[data-page="more"]',
    emoji: '⋯',
  },
];

window.maybeStartTour = function () {
  // Only in TWA or native — skip on landing/web preview; only once.
  try {
    if (localStorage.getItem(TOUR_KEY)) return;
  } catch (e) { /* localStorage disabled — show anyway */ }
  // Small delay so the UI has settled
  setTimeout(startFirstTour, 800);
};

let _tourIdx = 0;

window.startFirstTour = function () {
  _tourIdx = 0;
  _renderTourStep();
};

function _renderTourStep() {
  _removeTour();
  const step = TOUR_STEPS[_tourIdx];
  if (!step) { _finishTour(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  overlay.id = 'tourOverlay';

  // Spotlight on target (if any)
  let spotlightHtml = '';
  let cardPosClass = 'tour-card-center';
  if (step.target) {
    const el = document.querySelector(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 8;
      spotlightHtml = `
        <div class="tour-spotlight" style="
          left:${r.left - pad}px; top:${r.top - pad}px;
          width:${r.width + pad * 2}px; height:${r.height + pad * 2}px;">
        </div>`;
      // Position card above or below the target
      cardPosClass = r.top > window.innerHeight / 2 ? 'tour-card-above' : 'tour-card-below';
    }
  }

  overlay.innerHTML = `
    ${spotlightHtml}
    <div class="tour-card ${cardPosClass}">
      <div class="tour-emoji">${step.emoji}</div>
      <h3 class="tour-title">${esc(step.title)}</h3>
      <p class="tour-text">${esc(step.text)}</p>
      <div class="tour-dots">
        ${TOUR_STEPS.map((_, i) => `<span class="tour-dot ${i === _tourIdx ? 'active' : ''}"></span>`).join('')}
      </div>
      <div class="tour-actions">
        <button class="tour-skip" onclick="skipTour()">ကျော်မယ်</button>
        <button class="tour-next" onclick="nextTourStep()">
          ${_tourIdx === TOUR_STEPS.length - 1 ? 'ပြီးပြီ ✓' : 'နောက်တစ်ခု →'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

window.nextTourStep = function () {
  _tourIdx++;
  if (_tourIdx >= TOUR_STEPS.length) { _finishTour(); return; }
  _renderTourStep();
};

window.skipTour = function () { _finishTour(); };

function _finishTour() {
  _removeTour();
  try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {}
}

function _removeTour() {
  document.getElementById('tourOverlay')?.remove();
}
