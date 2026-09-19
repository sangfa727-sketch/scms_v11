// ═══════════════════════════════════════════════════════════
// i18n Engine — ဘာသာစကား စီမံခန့်ခွဲမှု
// ═══════════════════════════════════════════════════════════

const I18N = {
  current: 'en',           // default language
  fallback: 'en',
  storageKey: 'scms_lang', // localStorage key

  // ── Available locales ──
  locales: {
    en: () => window.I18N_EN || {},
    my: () => window.I18N_MY || {},
  },

  // ── Init: localStorage ကနေ ဖတ်ပြီး apply ──
  init() {
    const saved = localStorage.getItem(this.storageKey);
    // Telegram user language ကို auto-detect (ရှိရင်)
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const browserLang = navigator.language?.startsWith('my') ? 'my' : 'en';

    this.current = saved || (tgLang === 'my' ? 'my' : browserLang) || 'en';
    this.apply();
  },

  // ── Translation lookup ──
  // t('btn.save') → 'သိမ်းရန်' (or 'Save')
  // t('msg.count', { n: 5 }) → variable interpolation
  t(key, vars) {
    const dict = this.locales[this.current]?.() || {};
    const fallbackDict = this.locales[this.fallback]?.() || {};
    let text = dict[key] ?? fallbackDict[key] ?? key;

    // {n} လို placeholder တွေ replace
    if (vars) {
      Object.keys(vars).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return text;
  },

  // ── ဘာသာစကား ပြောင်း ──
  setLang(lang) {
    if (!this.locales[lang]) return;
    this.current = lang;
    localStorage.setItem(this.storageKey, lang);
    this.apply();
    // Custom event — တခြား module တွေ နားထောင်နိုင်ဖို့
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { lang }
    }));
  },

  // ── HTML ထဲက [data-i18n] အားလုံးကို apply ──
  apply(root = document) {
    // 1. Text content
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });

    // 2. Placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', this.t(key));
    });

    // 3. Title attribute (tooltip)
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', this.t(key));
    });

    // 4. aria-label
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', this.t(key));
    });
 // ═══════════════════════════════════════════════════════════
// Language Switch UI Wiring
// ═══════════════════════════════════════════════════════════
(function initI18n() {
  I18N.init();

  function wireSwitch() {
    const switchBtn = document.getElementById('langSwitch');
    if (!switchBtn) {
      console.warn('[i18n] #langSwitch button not found');
      return;
    }
    switchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = I18N.current === 'en' ? 'my' : 'en';
      I18N.setLang(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSwitch);
  } else {
    wireSwitch();
  }
})();

    // 5. <html lang="..."> update
    document.documentElement.lang = this.current;

        // 6. Language switch button ရဲ့ label/flag ကို update
    const label = document.getElementById('langLabel');
    const flag  = document.getElementById('langFlag');
    if (label) label.textContent = this.current === 'my' ? 'မြန်မာ' : 'EN';
    if (flag)  flag.textContent  = this.current === 'my' ? '🇲🇲' : '🇬🇧';
  },
};

// Global export
window.I18N = I18N;
window.t = (key, vars) => I18N.t(key, vars);
