/**
 * SCMS v11 — 03_utils.js
 * Shared utility functions.
 */

'use strict';

/** Format ISO date as "Mon 12 Jan" */
window.fmtDate = function(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday:'short', day:'numeric', month:'short' });
  } catch { return iso; }
};

/** Format ISO date as "Jan 12, 2017" */
window.fmtDateLong = function(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  } catch { return iso; }
};

/** Compute age in years from an ISO birthday. */
window.computeAge = function(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

/** Days until next birthday — useful for "🎂 in 3 days" badges. */
window.daysUntilBirthday = function(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return Math.ceil((next - now) / 86400000);
};

/** Short relative time: "2h ago", "Yesterday", etc. */
window.relTime = function(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m <   2) return 'Just now';
  if (m <  60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h <  24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d ===  1) return 'Yesterday';
  if (d <    7) return `${d} days ago`;
  return fmtDate(iso);
};

/** Debounce helper */
window.debounce = function(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/** Escape HTML to prevent injection in dynamic strings. */
window.esc = function(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]
  );
};

/** Group array by key */
window.groupBy = function(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Other';
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
};

/** Attendance rate % */
window.attendRate = function(studentId, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const records = window.APP.attendance.filter(
    a => a.student_id === studentId && a.date >= since
  );
  if (!records.length) return null;
  const present = records.filter(a => ['P', 'H'].includes(a.status)).length;
  return Math.round((present / records.length) * 100);
};

/** Validate email (loose RFC-ish check) */
window.isValidEmail = function(s) {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
};

/** Validate phone (digits, +, -, space, parentheses, 5+ chars) */
window.isValidPhone = function(s) {
  if (!s) return false;
  const digits = s.replace(/[^\d]/g, '');
  return digits.length >= 5;
};

/** Predefined "home colors" — the colour assigned to a student's house/team.
 *  Picked as accessible, distinct hues that look good on both light and dark themes. */
window.HOME_COLORS = [
  { id: 'red',     name: 'Red',     hex: '#DC2626' },
  { id: 'orange',  name: 'Orange',  hex: '#EA580C' },
  { id: 'amber',   name: 'Amber',   hex: '#D97706' },
  { id: 'yellow',  name: 'Yellow',  hex: '#CA8A04' },
  { id: 'lime',    name: 'Lime',    hex: '#65A30D' },
  { id: 'green',   name: 'Green',   hex: '#059669' },
  { id: 'teal',    name: 'Teal',    hex: '#0D9488' },
  { id: 'cyan',    name: 'Cyan',    hex: '#0891B2' },
  { id: 'sky',     name: 'Sky',     hex: '#0284C7' },
  { id: 'blue',    name: 'Blue',    hex: '#2563EB' },
  { id: 'indigo',  name: 'Indigo',  hex: '#4F46E5' },
  { id: 'violet',  name: 'Violet',  hex: '#7C3AED' },
  { id: 'fuchsia', name: 'Fuchsia', hex: '#C026D3' },
  { id: 'pink',    name: 'Pink',    hex: '#DB2777' },
  { id: 'rose',    name: 'Rose',    hex: '#E11D48' },
  { id: 'slate',   name: 'Slate',   hex: '#475569' },
];

/** Lookup the hex value for a home_color id; returns a neutral grey for unknown. */
window.homeColorHex = function(id) {
  const c = window.HOME_COLORS.find(c => c.id === id);
  return c ? c.hex : '#8A8A82';
};

/** Lookup the display name for a home_color id. */
window.homeColorName = function(id) {
  const c = window.HOME_COLORS.find(c => c.id === id);
  return c ? c.name : (id || '—');
};

/** Friendly attendance code dictionary.
 *  Used everywhere we need to translate a single-letter code (P/A/L/T/S/E/H)
 *  into a human-readable label. Falls back to the code itself if not found. */
window.ATTENDANCE_CODE_LABELS = {
  P: { label: 'Present',  short: 'Pres',  color: '#10B981', desc: 'Student is here'              },
  A: { label: 'Absent',   short: 'Abs',   color: '#EF4444', desc: 'Unexcused absence'            },
  L: { label: 'Leave',    short: 'Lv',    color: '#3B82F6', desc: 'Approved leave / on holiday'  },
  T: { label: 'Tardy',    short: 'Late',  color: '#F59E0B', desc: 'Arrived late'                 },
  S: { label: 'Sick',     short: 'Sick',  color: '#DC2626', desc: 'Out sick'                     },
  E: { label: 'Excused',  short: 'Exc',   color: '#0891B2', desc: 'Excused absence'              },
  H: { label: 'Half-day', short: '½ day', color: '#7C3AED', desc: 'Attended only part of the day'},
};

window.attendCodeLabel = function(code) {
  return window.ATTENDANCE_CODE_LABELS[code]?.label || code || '—';
};

window.attendCodeColor = function(code) {
  return window.ATTENDANCE_CODE_LABELS[code]?.color || '#8A8A82';
};

/* ─── Class & Grade lists (user-defined per school) ───────────────────────
 * Stored in school config (config.classes / config.grades) and editable
 * from Settings → School setup. Falls back to existing-data discovery so
 * old schools work without admin setup.
 */

/** Return the list of class names the school uses. */
window.getClassList = function() {
  const cfg = (window.APP.config || {});
  if (Array.isArray(cfg.classes) && cfg.classes.length) {
    return cfg.classes.slice();
  }
  // Fallback: discover from existing student data
  const set = new Set(
    (window.APP.students || [])
      .map(s => s.class)
      .filter(Boolean)
  );
  return [...set].sort();
};

/** Return the list of grade names the school uses. */
window.getGradeList = function() {
  const cfg = (window.APP.config || {});
  if (Array.isArray(cfg.grades) && cfg.grades.length) {
    return cfg.grades.slice();
  }
  const set = new Set(
    (window.APP.students || [])
      .map(s => s.grade)
      .filter(Boolean)
  );
  return [...set].sort();
};
