/**
 * SCMS v11 — 02_api.js
 * All data operations. Read = Supabase anon. Write = n8n TWA webhook.
 * Every call automatically includes school_id + teacher_id + platform from APP context.
 */

'use strict';


/** Call a Postgres RPC directly via PostgREST for web sessions.
 *  Throws on transport/HTTP error or on {ok:false} from the function,
 *  with e.duplicate/e.existing_student_id/etc. carried through when present. */
async function _webRpc(fnName, params) {
  const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method:  'POST',
    headers: {
      'apikey':        SCMS_CONFIG.SUPABASE_ANON,
      'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${txt.slice(0, 200)}`);
  }
  const result = await resp.json();
  if (!result || !result.ok) {
    const err = new Error(result?.message || result?.error || `${fnName} failed`);
    Object.assign(err, result || {});
    throw err;
  }
  return result;
}

const API = {

  // ─── BOOTSTRAP ───────────────────────────────────────────────────────────

  async bootstrap(telegram_id, school_id) {
    const initData = window.APP.initData || '';
    const body = {
      action:        'bootstrap',
      telegram_id,
      school_id:     school_id || undefined,
      // Send under BOTH key names so the backend works whether it expects
      // `initData` (v10 convention) or `tg_init_data` (n8n convention).
      initData,
      tg_init_data:  initData,
      platform:      window.APP.platform,
    };

    console.log('[API.bootstrap] POST', SCMS_CONFIG.N8N_BOOTSTRAP);
    console.log('[API.bootstrap] body keys:', Object.keys(body));
    console.log('[API.bootstrap] telegram_id:', telegram_id, 'has initData:', !!initData);

    let resp;
    try {
      resp = await fetch(SCMS_CONFIG.N8N_BOOTSTRAP, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (netErr) {
      // Network / CORS / DNS failure
      throw new Error('Network error: ' + (netErr.message || netErr));
    }

    if (!resp.ok) {
      let txt = '';
      try { txt = await resp.text(); } catch (_) {}
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${txt.slice(0, 200)}`);
    }

    let json;
    try {
      json = await resp.json();
    } catch (e) {
      throw new Error('Server returned non-JSON response');
    }
    return json;
  },

  /** v11.6 — bootstrap via web session (no Telegram, direct RPC).
   *  Verifies session token and returns full school+teacher bootstrap data
   *  in one call. Doesn't depend on n8n. */
  async bootstrapByTeacher(teacher_id, session_token) {
    const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_web_bootstrap`, {
      method:  'POST',
      headers: {
        'apikey':        SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        p_session_token: session_token,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${txt.slice(0, 200)}`);
    }
    const result = await resp.json();
    if (!result || !result.ok) {
      throw new Error((result && result.message) || 'Web bootstrap failed');
    }
    return result;
  },

  // ─── ATTENDANCE ──────────────────────────────────────────────────────────

    async saveAttendance(cls, date, records) {
    if (window.APP.platform === 'web') return _webRpc('rpc_save_attendance', {
      p_session_token: getWebSession()?.session_token,
      p_class: cls, p_date: date, p_records: records,
    });
    return twaPost('save_attendance', { class: cls, date, records });
  },

  async getAttendance(daysBack = 30) {
    const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    return sbQuery('attendance',
      `school_id=eq.${window.APP.school_id}&date=gte.${since}&order=date.desc,class`);
  },

  // ─── STUDENTS ────────────────────────────────────────────────────────────

  async getStudents() {
    return sbQuery('students',
      `school_id=eq.${window.APP.school_id}&status=eq.Active&order=class,name_en`);
  },

    /** Register new student.
   *  Web sessions call rpc_register_student directly — no n8n dependency,
   *  and it de-dupes server-side (same school+class+english name) so manual
   *  entry and future AI/chat entry can never create two rows for one student.
   *  Telegram/native platforms still go through the n8n TWA webhook. */
  async registerStudent(data) {
    if (window.APP.platform === 'web') {
      const sess = getWebSession();
      if (!sess || !sess.session_token) {
        throw new Error('No active web session — please sign in again.');
      }
      const resp = await fetch(`${SCMS_CONFIG.SUPABASE_URL}/rest/v1/rpc/rpc_register_student`, {
        method:  'POST',
        headers: {
          'apikey':        SCMS_CONFIG.SUPABASE_ANON,
          'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          p_session_token:  sess.session_token,
          p_name_local:     data.name_local || null,
          p_name_en:        data.name_en,
          p_class:          data.class,
          p_grade:          data.grade || null,
          p_gender:         data.gender || null,
          p_date_of_birth:  data.date_of_birth || null,
          p_home_color:     data.home_color || null,
          p_parent_name:    data.parent_name || null,
          p_parent_phone:   data.parent_phone || null,
          p_parent_email:   data.parent_email || null,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${txt.slice(0, 200)}`);
      }
      const result = await resp.json();
      if (!result || !result.ok) {
        const err = new Error(result?.message || result?.error || 'Registration failed');
        err.duplicate = !!result?.duplicate;
        err.existing_student_id = result?.existing_student_id;
        throw err;
      }
      return { student: result.student };
    }
    return twaPost('register_student', data);
  },

    /** Upload a student's photo to Supabase Storage and return its public URL.
   *  Path convention: <school_id>/<student_id>.<ext> — re-upload overwrites. */
  async uploadStudentPhoto(studentId, file) {
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${window.APP.school_id}/${studentId}.${ext}`;
    const resp = await fetch(
      `${SCMS_CONFIG.SUPABASE_URL}/storage/v1/object/student-photos/${path}`,
      {
        method:  'POST',
        headers: {
          'apikey':        SCMS_CONFIG.SUPABASE_ANON,
          'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
          'Content-Type':  file.type || 'image/jpeg',
          'x-upsert':      'true',
        },
        body: file,
      }
    );
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`Photo upload failed (${resp.status}): ${t.slice(0, 200)}`);
    }
    return `${SCMS_CONFIG.SUPABASE_URL}/storage/v1/object/public/student-photos/${path}?t=${Date.now()}`;
  },

  async setStudentPhoto(studentId, photoUrl) {
    return _webRpc('rpc_set_student_photo', {
      p_session_token: getWebSession()?.session_token,
      p_student_id: studentId,
      p_photo_url: photoUrl,
    });
  },
  /** Edit / update an existing student.
   *  Backend has no `update_student` TWA route yet — we PATCH Supabase directly
   *  (allowed by RLS for authenticated reads). For best results, replicate
   *  fields the bot's `/editstudent` wizard supports. */
    async updateStudent(studentId, patch) {
    if (window.APP.platform === 'web') return _webRpc('rpc_update_student', {
      p_session_token: getWebSession()?.session_token,
      p_student_id: studentId,
      p_name_local: patch.name_local || null,
      p_name_en:    patch.name_en,
      p_class:      patch.class,
      p_grade:      patch.grade || null,
      p_gender:     patch.gender || null,
      p_date_of_birth: patch.date_of_birth || null,
      p_home_color: patch.home_color || null,
      p_parent_name:  patch.parent_name || null,
      p_parent_phone: patch.parent_phone || null,
      p_parent_email: patch.parent_email || null,
    });

    // Whitelist fields that exist in the DB schema (matches Apply Student Edit)
    const allowed = ['name_en', 'name_mm', 'name_local', 'class', 'grade',
                     'gender', 'date_of_birth', 'parent_name', 'parent_phone',
                     'parent_tg_id', 'status', 'parent_email', 'home_color'];
    const clean = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    clean.updated_at = new Date().toISOString();

    const url = `${SCMS_CONFIG.SUPABASE_URL}/rest/v1/students`
              + `?student_id=eq.${encodeURIComponent(studentId)}`
              + `&school_id=eq.${encodeURIComponent(window.APP.school_id)}`;
    const resp = await fetch(url, {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(clean),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`update_student failed (${resp.status}): ${t}`);
    }
    const rows = await resp.json();
    return { ok: true, success: true, student: rows[0] || null };
  },

  /** Soft-delete (status=Inactive) — admin only. */
  async deleteStudent(studentId) {
    if (window.APP.platform === 'web') return _webRpc('rpc_delete_student', {
      p_session_token: getWebSession()?.session_token,
      p_student_id: studentId,
    });

    const url = `${SCMS_CONFIG.SUPABASE_URL}/rest/v1/students`
              + `?student_id=eq.${encodeURIComponent(studentId)}`
              + `&school_id=eq.${encodeURIComponent(window.APP.school_id)}`;
    const resp = await fetch(url, {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
      },
      body: JSON.stringify({
        status: 'Inactive',
        updated_at: new Date().toISOString(),
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`delete_student failed (${resp.status}): ${t}`);
    }
    return { ok: true, success: true };
  },

  /** Poll Supabase to see if the bot has captured the parent's Telegram ID
   *  (via the `/start parent_<STU-id>` deep link → `Update Parent TG ID` node).
   *  Returns { parent_tg_id, parent_name } once linked, else { parent_tg_id: null }. */
  async checkParentLink(studentId) {
    const url = `${SCMS_CONFIG.SUPABASE_URL}/rest/v1/students`
              + `?student_id=eq.${encodeURIComponent(studentId)}`
              + `&school_id=eq.${encodeURIComponent(window.APP.school_id)}`
              + `&select=parent_tg_id,parent_name`;
    const resp = await fetch(url, {
      headers: {
        'apikey':        SCMS_CONFIG.SUPABASE_ANON,
        'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
      },
    });
    if (!resp.ok) return { parent_tg_id: null };
    const rows = await resp.json();
    const r = rows[0] || {};
    const tg = r.parent_tg_id ? String(r.parent_tg_id).trim() : '';
    return {
      ok: true,
      parent_tg_id: tg || null,
      parent_name:  r.parent_name || null,
    };
  },

  /** Update the school logo.
   *  Reuses the existing `update_school_config` TWA route — backend stores
   *  the data URL inside `schools.config_json.school_logo` (or wherever your
   *  rpc_update_school_config writes patches). */
  async updateSchoolLogo(logoDataUrl) {
    return twaPost('update_school_config', {
      school_id: window.APP.school_id,
      patch: { school_logo: logoDataUrl || null },
    });
  },

  // ─── STAFF CHAT (native-only) ─────────────────────────────────────────────
  // Reads come straight from Supabase; writes go through the chat_send TWA
  // route (you must add this on the backend — see README).

  // ─── DAILY REPORTS ───────────────────────────────────────────────────────

    async saveDailyReport(data) {
    const date = data.date || new Date().toISOString().slice(0, 10);
    if (window.APP.platform === 'web') return _webRpc('rpc_save_daily_report', {
      p_session_token: getWebSession()?.session_token,
      p_student_id: data.student_id, p_name_en: data.name_en, p_class: data.class,
      p_date: date, p_meal: data.meal, p_nap_min: data.nap_min ?? null,
      p_mood: data.mood, p_behaviour_note: data.behaviour_note || null,
      p_toilet_ok: data.toilet_ok ?? null,
    });
    return twaPost('save_daily_report', { ...data, date });
  },

  async updateDailyReport(id, patch) {
    return twaPost('update_daily_report', { id, patch });
  },

  async deleteDailyReport(id) {
    return twaPost('delete_daily_report', { id });
  },

  async getDailyReports(daysBack = 7) {
    const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    return sbQuery('daily_reports',
      `school_id=eq.${window.APP.school_id}&date=gte.${since}&order=date.desc,name_en`);
  },

  // ─── HOMEWORK ────────────────────────────────────────────────────────────

   async saveHomework(data) {
    const date = data.date || new Date().toISOString().slice(0, 10);
    if (window.APP.platform === 'web') return _webRpc('rpc_save_homework', {
      p_session_token: getWebSession()?.session_token,
      p_class: data.class, p_subject: data.subject, p_type: data.type,
      p_description: data.description, p_lb_page: data.lb_page || null,
      p_wb_page: data.wb_page || null, p_due_date: data.due_date || null,
      p_date: date,
    });
    return twaPost('save_homework', {
      ...data,
      date,
      school_id:  window.APP.school_id,
      teacher_id: window.APP.teacher_id,
    });
  },

    async updateHomework(id, patch) {
    if (window.APP.platform === 'web') return _webRpc('rpc_update_homework', {
      p_session_token: getWebSession()?.session_token,
      p_id: id, p_subject: patch.subject, p_class: patch.class, p_type: patch.type,
      p_description: patch.description, p_lb_page: patch.lb_page || null,
      p_wb_page: patch.wb_page || null, p_due_date: patch.due_date || null,
    });
    return twaPost('update_homework', { id, patch });
  },

  async deleteHomework(id) {
    if (window.APP.platform === 'web') return _webRpc('rpc_delete_homework', {
      p_session_token: getWebSession()?.session_token,
      p_id: id,
    });
    return twaPost('delete_homework', { id });
  },
  async getHomework(daysBack = 30) {
    const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    return sbQuery('homework_log',
      `school_id=eq.${window.APP.school_id}&date=gte.${since}&order=date.desc`);
  },

  // ─── INCIDENTS ───────────────────────────────────────────────────────────

  async saveIncident(data) {
    if (window.APP.platform === 'web') return _webRpc('rpc_save_incident', {
      p_session_token: getWebSession()?.session_token,
      p_student_id: data.student_id, p_name_en: data.name_en, p_class: data.class,
      p_type: data.type, p_severity: data.severity, p_description: data.description,
      p_action_taken: data.action_taken, p_parent_notified: !!data.parent_notified,
      p_date: data.date,
    });
    return twaPost('save_incident', {
      ...data,
      date: data.date || new Date().toISOString().slice(0, 10),
      school_id:  window.APP.school_id,
      teacher_id: window.APP.teacher_id,
    });
  },

  async updateIncident(id, patch) {
    if (window.APP.platform === 'web') return _webRpc('rpc_update_incident', {
      p_session_token: getWebSession()?.session_token,
      p_id: id, p_type: patch.type, p_severity: patch.severity,
      p_description: patch.description, p_action_taken: patch.action_taken,
      p_parent_notified: !!patch.parent_notified,
    });
    return twaPost('update_incident', { id, patch });
  },

  async deleteIncident(id) {
    if (window.APP.platform === 'web') return _webRpc('rpc_delete_incident', {
      p_session_token: getWebSession()?.session_token, p_id: id,
    });
    return twaPost('delete_incident', { id });
  },

  async getIncidents(daysBack = 30) {
    const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    return sbQuery('incidents',
      `school_id=eq.${window.APP.school_id}&date=gte.${since}&order=date.desc`);
  },

  // ─── PARENT COMMS ────────────────────────────────────────────────────────

    async sendParentComm(data) {
    if (window.APP.platform === 'web') return _webRpc('rpc_send_parent_comm', {
      p_session_token: getWebSession()?.session_token,
      p_student_id: data.student_id, p_name_en: data.name_en, p_class: data.class,
      p_type: data.type, p_message_preview: data.message_preview, p_date: data.date,
    });
    return twaPost('send_parent_comm', {
      ...data,
      school_id:  window.APP.school_id,
      teacher_id: window.APP.teacher_id,
    });
  },

  async updateParentComm(id, patch) {
    return twaPost('update_parent_comm', { id, patch });
  },

  async deleteParentComm(id) {
    if (window.APP.platform === 'web') return _webRpc('rpc_delete_parent_comm', {
      p_session_token: getWebSession()?.session_token, p_id: id,
    });
    return twaPost('delete_parent_comm', { id });
  },

  async getParentComms(daysBack = 30) {
    const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    return sbQuery('parent_comms',
      `school_id=eq.${window.APP.school_id}&date=gte.${since}&order=date.desc`);
  },

  // ─── TIMETABLE ───────────────────────────────────────────────────────────

    async saveTimetable(data) {
    if (window.APP.platform === 'web') return _webRpc('rpc_save_timetable', {
      p_session_token: getWebSession()?.session_token,
      p_day: data.day, p_period: data.period, p_start_time: data.start_time,
      p_class: data.class, p_subject: data.subject, p_room: data.room,
    });
    return twaPost('save_timetable', {
      ...data,
      school_id:  window.APP.school_id,
    });
  },

  async updateTimetable(id, patch) {
    if (window.APP.platform === 'web') return _webRpc('rpc_update_timetable', {
      p_session_token: getWebSession()?.session_token,
      p_id: id, p_day: patch.day, p_period: patch.period, p_start_time: patch.start_time,
      p_class: patch.class, p_subject: patch.subject, p_room: patch.room,
    });
    return twaPost('update_timetable', { id, patch });
  },

  async deleteTimetable(id) {
    if (window.APP.platform === 'web') return _webRpc('rpc_delete_timetable', {
      p_session_token: getWebSession()?.session_token, p_id: id,
    });
    return twaPost('delete_timetable', { id });
  },

  async getTimetable() {
    return sbQuery('timetable',
      `school_id=eq.${window.APP.school_id}&order=day,period`);
  },

  // ─── MONTHLY SUMMARY ─────────────────────────────────────────────────────

  async getMonthlySummary(yearMonth) {
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    return sbQuery('monthly_summary',
      `school_id=eq.${window.APP.school_id}&year_month=eq.${ym}&order=class,name_en`);
  },

  // ─── SCHOOL CONFIG ───────────────────────────────────────────────────────

    async updateSchoolConfig(patch) {
    if (window.APP.platform === 'web') return _webRpc('rpc_update_school_config_web', {
      p_session_token: getWebSession()?.session_token,
      p_patch: patch,
    });
    return twaPost('update_school_config', { patch });
  },

    // ─── GRADING & ASSESSMENT (web only for now — new feature, not on n8n) ────

  async getSubjects() {
    return sbQuery('subjects',
      `school_id=eq.${window.APP.school_id}&is_active=eq.true&order=display_order`);
  },

  async addSubject(name, code, color) {
    return _webRpc('rpc_add_subject', {
      p_session_token: getWebSession()?.session_token,
      p_subject_name: name, p_subject_code: code || null, p_subject_color: color || null,
    });
  },

  async getTerms() {
    return sbQuery('terms', `school_id=eq.${window.APP.school_id}&order=term_order`);
  },

  async addTerm(data) {
    return _webRpc('rpc_add_term', {
      p_session_token:  getWebSession()?.session_token,
      p_academic_year:  data.academic_year || null,
      p_term_name:      data.term_name,
      p_term_order:     data.term_order || null,
      p_start_date:     data.start_date || null,
      p_end_date:       data.end_date || null,
      p_is_current:     !!data.is_current,
    });
  },

  async getAssessments(filters = {}) {
    let params = `school_id=eq.${window.APP.school_id}&order=date.desc`;
    if (filters.class)      params += `&class=eq.${encodeURIComponent(filters.class)}`;
    if (filters.subject_id) params += `&subject_id=eq.${filters.subject_id}`;
    if (filters.term_id)    params += `&term_id=eq.${filters.term_id}`;
    return sbQuery('assessments', params);
  },

  async createAssessment(data) {
    return _webRpc('rpc_create_assessment', {
      p_session_token: getWebSession()?.session_token,
      p_term_id:    data.term_id || null,
      p_subject_id: data.subject_id || null,
      p_class:      data.class,
      p_title:      data.title,
      p_type:       data.type,
      p_max_score:  data.max_score,
      p_weight:     data.weight,
      p_date:       data.date,
    });
  },

  async deleteAssessment(id) {
    return _webRpc('rpc_delete_assessment', {
      p_session_token: getWebSession()?.session_token,
      p_id: id,
    });
  },

  async getGrades(assessmentId) {
    return sbQuery('grades', `assessment_id=eq.${assessmentId}`);
  },

  async saveGrades(assessmentId, records) {
    return _webRpc('rpc_save_grades', {
      p_session_token: getWebSession()?.session_token,
      p_assessment_id: assessmentId,
      p_records:       records,
    });
  },
  // ─── STAFF CHAT (native app only — hidden in TWA) ────────────────────────
  // Reads: direct Supabase query on `chat_messages` table.
  // Writes: TWA `chat_send` action (backend must add this route — see README).

  async getChatMessages(channel = 'staff', limit = 50) {
    const url = `${SCMS_CONFIG.SUPABASE_URL}/rest/v1/chat_messages`
              + `?school_id=eq.${encodeURIComponent(window.APP.school_id)}`
              + `&channel=eq.${encodeURIComponent(channel)}`
              + `&order=created_at.desc&limit=${Number(limit) || 50}`;
    try {
      const resp = await fetch(url, {
        headers: {
          'apikey':        SCMS_CONFIG.SUPABASE_ANON,
          'Authorization': `Bearer ${SCMS_CONFIG.SUPABASE_ANON}`,
        },
      });
      if (!resp.ok) return [];
      const rows = await resp.json();
      // Return oldest-first so the UI can append normally
      return Array.isArray(rows) ? rows.reverse() : [];
    } catch (err) {
      console.warn('[chat] read failed', err);
      return [];
    }
  },

  async sendChatMessage(channel, text) {
    return twaPost('chat_send', {
      channel,
      text,
      // Server fills these in too, but echoing them helps if the route is a
      // thin Supabase passthrough.
      teacher_id:   window.APP.teacher_id,
      teacher_name: window.APP.teacher_name,
      created_at:   new Date().toISOString(),
    });
  },

  // ─── REFRESH ALL ─────────────────────────────────────────────────────────

  async refreshAll() {
    const [students, attendance, dailyReports, homework, parentComms, incidents, timetable] =
      await Promise.allSettled([
        API.getStudents(),
        API.getAttendance(30),
        API.getDailyReports(30),
        API.getHomework(30),
        API.getParentComms(30),
        API.getIncidents(30),
        API.getTimetable(),
      ]);

    if (students.status     === 'fulfilled') window.APP.students     = students.value     || [];
    if (attendance.status   === 'fulfilled') window.APP.attendance   = attendance.value   || [];
    if (dailyReports.status === 'fulfilled') window.APP.dailyReports = dailyReports.value || [];
    if (homework.status     === 'fulfilled') window.APP.homework     = homework.value     || [];
    if (parentComms.status  === 'fulfilled') window.APP.parentComms  = parentComms.value  || [];
    if (incidents.status    === 'fulfilled') window.APP.incidents    = incidents.value    || [];
    if (timetable.status    === 'fulfilled') window.APP.timetable    = timetable.value    || [];

    return window.APP;
  },
};

window.API = API;
