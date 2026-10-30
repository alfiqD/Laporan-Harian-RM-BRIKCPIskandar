import { supabase } from '../config/supabaseClient.js';
import { isAdminRole } from '../config/rolesConfig.jsx';

/**
 * Layanan Tindak Lanjut.
 *
 * Satu baris tabel public.tindak_lanjut = satu tugas.
 * Nomor rekening / NIK hanya atribut pencocokan kandidat, bukan identitas unik.
 * Identitas tugas selalu kolom id (uuid).
 */

export const TASK_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
};

export const TASK_STATUS_LABEL = {
  pending: 'Perlu Ditindaklanjuti',
  done: 'Selesai',
};

export const HISTORY_ACTION_LABEL = {
  created: 'Tugas dibuat',
  updated: 'Tugas diperbarui',
  closed: 'Tugas diselesaikan',
  reopened: 'Tugas dibuka kembali',
  linked: 'Laporan dihubungkan',
};

const TIME_ZONE = 'Asia/Jakarta';

const TASK_COLUMNS = [
  'id',
  'user_id',
  'user_name',
  'form_type',
  'customer_name',
  'customer_identity',
  'customer_type',
  'phone',
  'activity',
  'status',
  'note',
  'source_report_id',
  'last_report_id',
  'last_report_at',
  'closed_at',
  'closed_by',
  'created_at',
  'updated_at',
].join(', ');

const HISTORY_COLUMNS = [
  'id',
  'tindak_lanjut_id',
  'report_id',
  'user_id',
  'user_name',
  'action',
  'status_before',
  'status_after',
  'note',
  'created_at',
].join(', ');

function errorText(error) {
  return `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
}

/** True jika migration tindak-lanjut.sql belum dijalankan di Supabase. */
export function isMissingFollowUpSchema(error) {
  const text = errorText(error);
  return (
    text.includes('tindak_lanjut')
    || text.includes('activity_result')
    || text.includes('follow_up_status')
    || text.includes('does not exist')
  );
}

export function formatJakartaDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatJakartaDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(date);
}

/** Menyamarkan nomor rekening / NIK agar tidak tampil utuh. */
export function maskIdentity(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= 4) return '••••';
  if (text.length <= 8) return `${text.slice(0, 2)}${'•'.repeat(text.length - 4)}${text.slice(-2)}`;
  return `${text.slice(0, 4)}${'•'.repeat(Math.max(4, text.length - 8))}${text.slice(-4)}`;
}

export function maskPhone(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= 4) return '••••';
  return `${text.slice(0, 4)}${'•'.repeat(Math.max(3, text.length - 7))}${text.slice(-3)}`;
}

export function normalizeTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || 'Relationship Manager',
    formType: row.form_type || 'rmft',
    customerName: row.customer_name || '-',
    customerIdentity: row.customer_identity || '',
    customerType: row.customer_type || '',
    phone: row.phone || '',
    activity: row.activity || '',
    status: row.status === 'done' ? TASK_STATUS.DONE : TASK_STATUS.PENDING,
    note: row.note || '',
    sourceReportId: row.source_report_id || null,
    lastReportId: row.last_report_id || null,
    lastReportAt: row.last_report_at || row.created_at || null,
    closedAt: row.closed_at || null,
    closedBy: row.closed_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  };
}

function normalizeHistory(row) {
  return {
    id: row.id,
    taskId: row.tindak_lanjut_id,
    reportId: row.report_id || null,
    userId: row.user_id || null,
    userName: row.user_name || 'Pengguna',
    action: row.action,
    actionLabel: HISTORY_ACTION_LABEL[row.action] || row.action,
    statusBefore: row.status_before || null,
    statusAfter: row.status_after || null,
    note: row.note || '',
    createdAt: row.created_at,
  };
}

function scopeToUser(query, user, column = 'user_id') {
  if (isAdminRole(user?.role)) return query;
  return query.eq(column, user?.id || '00000000-0000-0000-0000-000000000000');
}

/** Daftar tugas. status = 'pending' | 'done' | null (semua). */
export async function fetchTasks(user, { status = TASK_STATUS.PENDING, limit = 500 } = {}) {
  if (!user?.id) return { data: [], error: null };

  let query = supabase.from('tindak_lanjut').select(TASK_COLUMNS);
  if (status) query = query.eq('status', status);
  query = scopeToUser(query, user);

  const { data, error } = await query
    .order('last_report_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error };
  return { data: (data || []).map(normalizeTask), error: null };
}

export async function countActiveTasks(user) {
  if (!user?.id) return 0;

  const query = scopeToUser(
    supabase
      .from('tindak_lanjut')
      .select('id', { count: 'exact', head: true })
      .eq('status', TASK_STATUS.PENDING),
    user,
  );

  const { count, error } = await query;
  if (error) {
    console.warn('Gagal menghitung tugas tindak lanjut aktif:', error.message);
    return 0;
  }
  return count || 0;
}

export async function fetchTaskHistory(taskId) {
  if (!taskId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tindak_lanjut_riwayat')
    .select(HISTORY_COLUMNS)
    .eq('tindak_lanjut_id', taskId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error };
  return { data: (data || []).map(normalizeHistory), error: null };
}

/**
 * Kandidat tugas aktif untuk nasabah yang sedang diinput.
 * Pencocokan memeriksa nomor rekening / identitas DAN nama nasabah (tidak case-sensitive).
 * Mengembalikan kandidat tugas yang belum selesai untuk dipilih RM secara eksplisit.
 * Tidak pernah menutup tugas secara otomatis.
 */
export async function fetchTaskCandidates({ user, customerIdentity, customerName }) {
  if (!user?.id) return [];

  const identity = String(customerIdentity || '').trim();
  const name = String(customerName || '').trim();
  if (!identity && name.length < 3) return [];

  const candidateMap = new Map();

  // 1. Pencocokan nomor rekening / identitas jika diinput minimal 4 digit
  if (identity && identity.length >= 4) {
    let idQuery = scopeToUser(
      supabase
        .from('tindak_lanjut')
        .select(TASK_COLUMNS)
        .eq('status', TASK_STATUS.PENDING)
        .eq('customer_identity', identity),
      user,
    );
    const { data: idRows } = await idQuery
      .order('last_report_at', { ascending: false })
      .limit(20);

    (idRows || []).forEach((row) => {
      const item = normalizeTask(row);
      if (item) candidateMap.set(item.id, item);
    });
  }

  // 2. Pencocokan nama nasabah jika diinput minimal 3 huruf
  if (name && name.length >= 3) {
    let nameQuery = scopeToUser(
      supabase
        .from('tindak_lanjut')
        .select(TASK_COLUMNS)
        .eq('status', TASK_STATUS.PENDING)
        .ilike('customer_name', `%${name}%`),
      user,
    );
    const { data: nameRows } = await nameQuery
      .order('last_report_at', { ascending: false })
      .limit(20);

    (nameRows || []).forEach((row) => {
      const item = normalizeTask(row);
      if (item && !candidateMap.has(item.id)) candidateMap.set(item.id, item);
    });
  }

  return Array.from(candidateMap.values());
}

async function insertHistory(entry) {
  const { error } = await supabase.from('tindak_lanjut_riwayat').insert(entry);
  if (error) {
    console.warn('Gagal mencatat riwayat tindak lanjut:', error.message);
  }
  return error;
}

export async function createTaskFromReport({ user, form, formType, reportId }) {
  const note = String(form.followUp || '').trim();
  const payload = {
    user_id: user.id,
    user_name: user.name || 'Pegawai',
    form_type: formType,
    customer_name: form.fullName.trim(),
    customer_identity: form.identityNumber.trim(),
    customer_type: form.customerType,
    phone: form.phone.trim(),
    activity: form.transactionType,
    status: TASK_STATUS.PENDING,
    note: note,
    source_report_id: reportId,
    last_report_id: reportId,
    last_report_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tindak_lanjut')
    .insert(payload)
    .select(TASK_COLUMNS)
    .single();

  if (error) return { data: null, error };

  const task = normalizeTask(data);
  await insertHistory({
    tindak_lanjut_id: task.id,
    report_id: reportId,
    user_id: user.id,
    user_name: user.name || 'Pegawai',
    action: 'created',
    status_before: null,
    status_after: TASK_STATUS.PENDING,
    note: task.note || 'Tugas tindak lanjut dibuat dari laporan harian.',
  });

  return { data: task, error: null };
}

/** Perbarui tugas yang sudah ada memakai isi laporan lanjutan. */
export async function applyReportToTask({ user, task, form, formType, reportId, status }) {
  const nextStatus = status === TASK_STATUS.DONE ? TASK_STATUS.DONE : TASK_STATUS.PENDING;
  const now = new Date().toISOString();
  // Keterangan pembaruan: rencana lanjutan, atau hasil penyelesaian bila selesai.
  const nextNote = String(form.followUp || '').trim()
    || task.note
    || '';

  const payload = {
    status: nextStatus,
    note: nextNote,
    form_type: formType || task.formType,
    activity: form.transactionType || task.activity,
    customer_type: form.customerType || task.customerType,
    phone: form.phone?.trim() || task.phone,
    last_report_id: reportId,
    last_report_at: now,
    closed_at: nextStatus === TASK_STATUS.DONE ? now : null,
    closed_by: nextStatus === TASK_STATUS.DONE ? user.id : null,
  };

  const { data, error } = await supabase
    .from('tindak_lanjut')
    .update(payload)
    .eq('id', task.id)
    .select(TASK_COLUMNS)
    .single();

  if (error) return { data: null, error };

  let action = 'updated';
  if (task.status === TASK_STATUS.DONE && nextStatus === TASK_STATUS.PENDING) action = 'reopened';
  else if (nextStatus === TASK_STATUS.DONE && task.status !== TASK_STATUS.DONE) action = 'closed';

  await insertHistory({
    tindak_lanjut_id: task.id,
    report_id: reportId,
    user_id: user.id,
    user_name: user.name || 'Pegawai',
    action,
    status_before: task.status,
    status_after: nextStatus,
    note: nextNote || (nextStatus === TASK_STATUS.DONE ? 'Tugas diselesaikan melalui laporan lanjutan.' : 'Laporan lanjutan dihubungkan ke tugas ini.'),
  });

  return { data: normalizeTask(data), error: null };
}

/**
 * Sinkronisasi tugas setelah laporan tersimpan.
 * - terhubung ke tugas  -> perbarui tugas tersebut saja
 * - tanpa tugas + pending -> buat tugas baru
 * - tanpa tugas + done   -> tidak membuat tugas
 */
export async function syncTaskWithReport({ user, form, formType, reportId, linkedTask }) {
  const wantsFollowUp = form.followUpStatus !== TASK_STATUS.DONE;

  if (linkedTask?.id) {
    const { data, error } = await applyReportToTask({
      user,
      task: linkedTask,
      form,
      formType,
      reportId,
      status: wantsFollowUp ? TASK_STATUS.PENDING : TASK_STATUS.DONE,
    });
    return { taskId: data?.id || linkedTask.id, error };
  }

  if (wantsFollowUp) {
    const { data, error } = await createTaskFromReport({ user, form, formType, reportId });
    return { taskId: data?.id || null, error };
  }

  return { taskId: null, error: null };
}

/** Hubungkan laporan ke tugas yang baru dibuat (kolom tindak_lanjut_id). */
export async function setReportTaskLink(reportId, taskId) {
  if (!reportId || !taskId) return null;

  const { error } = await supabase
    .from('laporan_rm')
    .update({ tindak_lanjut_id: taskId })
    .eq('id', reportId);

  if (error) console.warn('Gagal menghubungkan laporan ke tugas:', error.message);
  return error;
}

/**
 * Sinkronkan tugas ketika laporan yang SUDAH ADA diedit (modal edit).
 * Hanya tugas yang tertaut ke laporan tersebut yang diperbarui.
 */
export async function syncTaskFromEditedReport({ user, taskId, form, formType, reportId }) {
  if (!taskId) return { taskId: null, error: null };

  const query = scopeToUser(
    supabase.from('tindak_lanjut').select(TASK_COLUMNS).eq('id', taskId),
    user,
  );

  const { data, error } = await query.maybeSingle();
  if (error) return { taskId, error };
  if (!data) return { taskId, error: null };

  const { error: applyError } = await applyReportToTask({
    user,
    task: normalizeTask(data),
    form,
    formType,
    reportId,
    status: form.followUpStatus === TASK_STATUS.DONE ? TASK_STATUS.DONE : TASK_STATUS.PENDING,
  });

  return { taskId, error: applyError };
}

/** Tutup tugas langsung dari menu Tindak Lanjut. */
export async function closeTask({ user, task, note }) {
  if (!task?.id) return { data: null, error: new Error('Tugas tidak ditemukan.') };

  const now = new Date().toISOString();
  const payload = {
    status: TASK_STATUS.DONE,
    closed_at: now,
    closed_by: user?.id || null,
    note: String(note || '').trim() || task.note || '',
  };

  const { data, error } = await supabase
    .from('tindak_lanjut')
    .update(payload)
    .eq('id', task.id)
    .select(TASK_COLUMNS)
    .single();

  if (error) return { data: null, error };

  await insertHistory({
    tindak_lanjut_id: task.id,
    report_id: null,
    user_id: user?.id || null,
    user_name: user?.name || 'Pegawai',
    action: 'closed',
    status_before: task.status,
    status_after: TASK_STATUS.DONE,
    note: payload.note || 'Tugas ditandai selesai dari menu Tindak Lanjut.',
  });

  return { data: normalizeTask(data), error: null };
}
