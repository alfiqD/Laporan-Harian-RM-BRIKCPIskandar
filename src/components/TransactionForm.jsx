import { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient.js';
import { recordActivity } from '../pages/auth/activityLog.js';
import { isAdminRole } from '../config/rolesConfig.jsx';
import {
  fetchTaskCandidates,
  formatJakartaDate,
  maskIdentity,
  setReportTaskLink,
  syncTaskFromEditedReport,
  syncTaskWithReport,
  TASK_STATUS,
} from '../services/tindakLanjut.js';
import Icon from './Icon.jsx';

const MAX_SAVED_RECORDS = 50;

function getStorageKey(user, formType) {
  return `bri-app-records-${formType}-${user?.id || 'guest'}`;
}

function readSavedRecords(user, formType) {
  try {
    const records = JSON.parse(localStorage.getItem(getStorageKey(user, formType)) || '[]');
    return Array.isArray(records)
      ? records.map((record) => ({ ...record, userId: record.userId || user?.id }))
      : [];
  } catch {
    return [];
  }
}

const blankForm = {
  fullName: '',
  customerType: '',
  identityNumber: '',
  phone: '',
  address: '',
  transactionType: '',
  followUpStatus: '',
  followUp: '',
  linkedTaskId: '',
  photo: '',
  photoName: '',
};

const FOLLOW_UP_STATUS_OPTIONS = [
  {
    value: 'pending',
    label: 'Perlu Ditindaklanjuti',
    hint: 'Keterangan rencana langkah berikutnya wajib diisi',
  },
  {
    value: 'done',
    label: 'Selesai',
    hint: 'Pekerjaan selesai; keterangan penyelesaian dapat dicatat',
  },
];

function normalizeFollowUpStatus(status) {
  return status === 'done' ? 'done' : 'pending';
}

// Kolom opsional hasil migration tindak-lanjut.sql. Selama belum ada di
// database, aplikasi tetap berjalan dengan memuat/menyimpan kolom lama.
const OPTIONAL_REPORT_COLUMNS = ['follow_up_status', 'tindak_lanjut_id'];

function isMissingOptionalColumn(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return OPTIONAL_REPORT_COLUMNS.some((column) => text.includes(column));
}

function stripOptionalColumns(payload) {
  const next = { ...payload };
  OPTIONAL_REPORT_COLUMNS.forEach((column) => delete next[column]);
  return next;
}

export default function TransactionForm({
  user,
  onBack,
  formType,
  title,
  transactionLabel,
  transactionOptions,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAllReports = isAdminRole(user?.role)
    && new URLSearchParams(window.location.search).get('scope') === 'all';
  const returnToDashboard = location.state?.returnToDashboard === true;
  // View mode: 'form' (input formulir) atau 'reports' (halaman kartu laporan)
  const [viewMode, setViewMode] = useState(
    new URLSearchParams(window.location.search).get('view') === 'reports' ? 'reports' : 'form',
  );

  const [form, setForm] = useState(() => {
    const task = location.state?.prefillTask;
    if (!task) return blankForm;
    return {
      ...blankForm,
      fullName: task.customerName || '',
      customerType: task.customerType || '',
      identityNumber: task.customerIdentity || '',
      phone: task.phone || '',
      transactionType: task.activity || '',
      linkedTaskId: task.id || '',
    };
  });
  const [records, setRecords] = useState(() => readSavedRecords(user, isAllReports ? 'all' : formType));
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingSaving, setIsEditingSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [followUpFilter, setFollowUpFilter] = useState('ALL');
  const [reportTypeFilter, setReportTypeFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportsLoadError, setReportsLoadError] = useState('');
  const [taskCandidates, setTaskCandidates] = useState(() => {
    const task = location.state?.prefillTask;
    return task ? [task] : [];
  });
  const [isLoadingTaskCandidates, setIsLoadingTaskCandidates] = useState(false);
  const submitLockRef = useRef(false);

  const linkedTask = useMemo(
    () => taskCandidates.find((task) => task.id === form.linkedTaskId) || null,
    [taskCandidates, form.linkedTaskId],
  );

  const isRMFT = formType === 'rmft';
  const editingIsRMFT = (editingRecord?.formType || formType) === 'rmft';
  const editingTransactionLabel = editingIsRMFT ? 'Jenis Transaksi' : 'Jenis Layanan Kredit';
  const editingTransactionOptions = editingIsRMFT
    ? ['Pembukaan rekening', 'Setoran', 'Tarikan', 'Transfer', 'Aktivasi layanan', 'Lainnya']
    : [
      'Konsultasi kredit',
      'Pengajuan kredit',
      'Follow up pengajuan',
      'Pembayaran angsuran',
      'Restrukturisasi kredit',
      'Lainnya',
    ];

  // Ambil laporan dari Supabase; halaman admin gabungan memuat kedua jenis laporan.
  useEffect(() => {
    // level 0 = kolom lama, 1 = +follow_up_status, 2 = +tindak_lanjut_id
    const reportColumns = (level) => [
      'id', 'user_id', 'user_name', 'form_type', 'full_name', 'customer_type',
      'identity_number', 'phone', 'address', 'transaction_type', 'follow_up',
      ...(level >= 1 ? ['follow_up_status'] : []),
      ...(level >= 2 ? ['tindak_lanjut_id'] : []),
      'photo_url', 'created_at',
    ].join(', ');

    async function fetchReports() {
      if (!user?.id) return;
      setIsLoadingReports(true);
      setReportsLoadError('');
      try {
        let data = [];
        if (isAllReports) {
          const loadAllPages = async (level) => {
            const pageSize = 1000;
            const rows = [];
            for (let offset = 0; ; offset += pageSize) {
              const { data: page, error } = await supabase
                .from('laporan_rm')
                .select(reportColumns(level))
                .in('form_type', ['rmft', 'rmkredit'])
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
                .range(offset, offset + pageSize - 1);
              if (error) return { data: null, error };
              rows.push(...(page || []));
              if (!page || page.length < pageSize) return { data: rows, error: null };
            }
          };

          let result = await loadAllPages(2);
          // Turunkan level kolom bila migration terbaru belum dijalankan,
          // agar laporan lama tetap tampil.
          for (const level of [1, 0]) {
            if (!result.error || !isMissingOptionalColumn(result.error)) break;
            result = await loadAllPages(level);
          }
          if (result.error) throw result.error;
          data = result.data || [];
        } else {
          const { data: page, error } = await supabase
            .from('laporan_rm')
            .select('*')
            .eq('form_type', formType)
            .order('created_at', { ascending: false })
            .limit(100);
          if (error) throw error;
          data = page || [];
        }

        const mapped = data.map((d) => ({
            id: d.id,
            userId: d.user_id,
            userName: d.user_name || '',
            formType: d.form_type || formType,
            fullName: d.full_name || '',
            customerType: d.customer_type || '',
            identityNumber: d.identity_number || '',
            phone: d.phone || '',
            address: d.address || '',
            transactionType: d.transaction_type || '',
            activityResult: d.activity_result || '',
            followUpStatus: normalizeFollowUpStatus(d.follow_up_status),
            followUp: d.follow_up || '',
            tindakLanjutId: d.tindak_lanjut_id || '',
            photo: d.photo_url || '',
            createdAt: d.created_at || new Date().toISOString(),
          }));
        setRecords(mapped);
        if (!isAllReports) {
          localStorage.setItem(getStorageKey(user, formType), JSON.stringify(mapped));
        }
      } catch (err) {
        console.error('Gagal memuat laporan Supabase:', err);
        setReportsLoadError('Laporan belum dapat dimuat dari server. Periksa koneksi lalu coba lagi.');
      } finally {
        setIsLoadingReports(false);
      }
    }
    fetchReports();
  }, [user, formType, isAllReports]);

  // Cari tugas tindak lanjut aktif milik nasabah yang sedang diinput.
  // Hanya sebagai kandidat — tidak pernah menutup tugas secara otomatis.
  useEffect(() => {
    if (viewMode !== 'form' || !user?.id) return undefined;
    const identity = form.identityNumber.trim();
    const name = form.fullName.trim();
    const shouldSearch = identity.length >= 4 || name.length >= 3;

    let isActive = true;
    const timer = setTimeout(async () => {
      if (!isActive) return;
      if (!shouldSearch) {
        setTaskCandidates([]);
        return;
      }
      setIsLoadingTaskCandidates(true);
      const rows = await fetchTaskCandidates({
        user,
        customerIdentity: identity,
        customerName: name,
      });
      if (!isActive) return;
      setTaskCandidates(rows);
      setIsLoadingTaskCandidates(false);
    }, 450);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [viewMode, user, form.identityNumber, form.fullName]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage({ text: '', type: '' });
  };

  // Dropdown status tindak lanjut: RM dapat mengisi rencana langkah berikutnya atau keterangan penyelesaian.
  const handleFollowUpStatusChange = (event) => {
    const { value } = event.target;
    setForm((current) => ({
      ...current,
      followUpStatus: value,
    }));
    setMessage({ text: '', type: '' });
  };

  const updateEditingField = (event) => {
    const { name, value } = event.target;
    setEditingRecord((current) => ({ ...current, [name]: value }));
  };

  const handleEditingFollowUpStatusChange = (event) => {
    const { value } = event.target;
    setEditingRecord((current) => ({
      ...current,
      followUpStatus: value,
    }));
  };

  const canManageRecord = (record) =>
    isAdminRole(user?.role) || (Boolean(user?.id) && record.userId === user.id);

  // Buka modal edit dengan status tindak lanjut yang selalu valid.
  const startEditingRecord = (record) => {
    setEditingRecord({
      ...record,
      followUpStatus: normalizeFollowUpStatus(record.followUpStatus),
      followUp: record.followUp || '',
    });
  };

  // Kompresi otomatis foto agar cepat diupload
  const handlePhotoUpload = (file, onSuccess) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('File yang dipilih harus berupa gambar.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        onSuccess(compressed, file.name);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (event) => {
    const [file] = event.target.files || [];
    handlePhotoUpload(file, (compressed, name) => {
      setForm((current) => ({
        ...current,
        photo: compressed,
        photoName: name,
      }));
      setMessage({ text: 'Foto berhasil dimuat dan dioptimalkan.', type: 'info' });
    });
  };

  const handleEditingPhotoChange = (event) => {
    const [file] = event.target.files || [];
    handlePhotoUpload(file, (compressed) => {
      setEditingRecord((current) => ({
        ...current,
        photo: compressed,
      }));
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Cegah klik ganda / submit berulang.
    if (submitLockRef.current) return;

    if (!form.followUpStatus) {
      setMessage({ text: 'Pilih status tindak lanjut terlebih dahulu.', type: 'error' });
      return;
    }
    if (form.followUpStatus === 'pending' && !form.followUp.trim()) {
      setMessage({ text: 'Keterangan tindak lanjut (rencana langkah berikutnya) wajib diisi jika status "Perlu Ditindaklanjuti".', type: 'error' });
      return;
    }

    // Konfirmasi sebelum menutup tugas tindak lanjut.
    if (linkedTask && form.followUpStatus === TASK_STATUS.DONE) {
      const confirmed = window.confirm(
        `Laporan ini akan menutup tugas tindak lanjut "${linkedTask.activity || 'pekerjaan'}" `
        + `milik ${linkedTask.customerName}. Lanjutkan?`,
      );
      if (!confirmed) return;
    }

    submitLockRef.current = true;
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    const record = {
      ...form,
      id: crypto.randomUUID(),
      userId: user?.id || null,
      userName: user?.name || '',
      createdAt: new Date().toISOString(),
    };

    let savedId = record.id;
    let savedCreatedAt = record.createdAt;
    let reportPersisted = false;
    let taskSyncNote = '';

    try {
      const payload = {
        // id eksplisit membuat submit ganda gagal (konflik primary key)
        // alih-alih membuat laporan duplikat.
        id: record.id,
        user_id: user?.id || null,
        user_name: user?.name || 'Pegawai',
        form_type: formType,
        full_name: form.fullName.trim(),
        customer_type: form.customerType,
        identity_number: form.identityNumber.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        transaction_type: form.transactionType,
        follow_up_status: form.followUpStatus,
        follow_up: form.followUp.trim(),
        photo_url: form.photo,
      };

      let { data: dbData, error: dbError } = await supabase
        .from('laporan_rm')
        .insert(payload)
        .select()
        .single();

      if (dbError && isMissingOptionalColumn(dbError)) {
        // Kolom hasil migration belum tersedia; simpan dengan kolom lama.
        ({ data: dbData, error: dbError } = await supabase
          .from('laporan_rm')
          .insert(stripOptionalColumns(payload))
          .select()
          .single());
      }

      if (dbError) {
        console.warn('Supabase insert notice:', dbError.message);
      } else if (dbData) {
        savedId = dbData.id;
        savedCreatedAt = dbData.created_at;
        reportPersisted = true;
      }
    } catch (dbErr) {
      console.warn('Supabase offline/error, menyimpan lokal:', dbErr);
    }

    // Sinkronkan tugas tindak lanjut (hanya jika laporan benar-benar tersimpan).
    if (reportPersisted) {
      try {
        const { taskId, error } = await syncTaskWithReport({
          user,
          form,
          formType,
          reportId: savedId,
          linkedTask,
        });

        if (error) {
          taskSyncNote = ' Laporan tersimpan, namun tugas tindak lanjut gagal disinkronkan.';
          console.warn('Sinkronisasi tugas tindak lanjut:', error.message);
        } else if (taskId) {
          await setReportTaskLink(savedId, taskId);
          record.tindakLanjutId = taskId;
        }
      } catch (taskErr) {
        console.warn('Sinkronisasi tugas tindak lanjut error:', taskErr);
        taskSyncNote = ' Laporan tersimpan, namun tugas tindak lanjut gagal disinkronkan.';
      }
    }

    try {
      const nextRecord = {
        ...record,
        id: savedId,
        createdAt: savedCreatedAt,
      };
      // Simpan di posisi paling atas (data terbaru)
      const nextRecords = [nextRecord, ...records.filter((r) => r.id !== savedId)].slice(
        0,
        MAX_SAVED_RECORDS,
      );
      localStorage.setItem(getStorageKey(user, formType), JSON.stringify(nextRecords));
      setRecords(nextRecords);

      recordActivity(
        user,
        `Upload ${formType.toUpperCase()}`,
        `Mengunggah laporan ${form.fullName} - ${form.transactionType}`,
      );
      setForm(blankForm);
      setTaskCandidates([]);
      setMessage({
        text: `Data laporan berhasil diupload!${taskSyncNote}`,
        type: taskSyncNote ? 'info' : 'success',
      });
    } catch {
      setMessage({ text: `Data tersimpan ke server.${taskSyncNote}`, type: 'success' });
    } finally {
      setIsSaving(false);
      submitLockRef.current = false;
    }
  };

  // Simpan hasil Edit data laporan
  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editingRecord || !canManageRecord(editingRecord)) return;

    if (!editingRecord.followUpStatus) {
      window.alert('Pilih status tindak lanjut terlebih dahulu.');
      return;
    }
    if (editingRecord.followUpStatus === 'pending' && !editingRecord.followUp.trim()) {
      window.alert('Keterangan tindak lanjut (rencana langkah berikutnya) wajib diisi jika status "Perlu Ditindaklanjuti".');
      return;
    }

    // Konfirmasi bila perubahan menutup tugas tindak lanjut yang terhubung.
    if (editingRecord.tindakLanjutId && editingRecord.followUpStatus === TASK_STATUS.DONE) {
      const confirmed = window.confirm(
        'Menyimpan perubahan ini akan menandai tugas tindak lanjut terkait sebagai selesai. Lanjutkan?',
      );
      if (!confirmed) return;
    }

    setIsEditingSaving(true);
    let editSyncNote = '';

    try {
      const payload = {
        full_name: editingRecord.fullName.trim(),
        customer_type: editingRecord.customerType,
        identity_number: editingRecord.identityNumber.trim(),
        phone: editingRecord.phone.trim(),
        address: editingRecord.address.trim(),
        transaction_type: editingRecord.transactionType,
        follow_up_status: editingRecord.followUpStatus,
        follow_up: (editingRecord.followUp || '').trim(),
        photo_url: editingRecord.photo,
      };

      let updateQuery = supabase
        .from('laporan_rm')
        .update(payload)
        .eq('id', editingRecord.id);

      if (user?.id && !isAdminRole(user.role)) {
        updateQuery = updateQuery.eq('user_id', user.id);
      }
      let { error: dbError } = await updateQuery;

      if (dbError && isMissingOptionalColumn(dbError)) {
        // Kolom hasil migration belum tersedia; simpan dengan kolom lama.
        let legacyQuery = supabase
          .from('laporan_rm')
          .update(stripOptionalColumns(payload))
          .eq('id', editingRecord.id);
        if (user?.id && !isAdminRole(user.role)) {
          legacyQuery = legacyQuery.eq('user_id', user.id);
        }
        ({ error: dbError } = await legacyQuery);
      }

      if (dbError) {
        console.warn('Supabase update notice:', dbError.message);
      }
    } catch (err) {
      console.warn('Supabase update error:', err);
    }

    // Sinkronkan tugas tindak lanjut yang tertaut ke laporan ini (bila ada).
    if (editingRecord.tindakLanjutId) {
      try {
        const { error: taskError } = await syncTaskFromEditedReport({
          user,
          taskId: editingRecord.tindakLanjutId,
          form: editingRecord,
          formType: editingRecord.formType || formType,
          reportId: editingRecord.id,
        });
        if (taskError) {
          console.warn('Sinkronisasi tugas setelah edit:', taskError.message);
          editSyncNote = ' Tugas tindak lanjut gagal disinkronkan.';
        }
      } catch (taskErr) {
        console.warn('Sinkronisasi tugas setelah edit error:', taskErr);
        editSyncNote = ' Tugas tindak lanjut gagal disinkronkan.';
      }
    }

    // 2. Update LocalStorage dan State
    const updatedRecords = records.map((r) =>
      r.id === editingRecord.id ? { ...editingRecord } : r,
    );
    setRecords(updatedRecords);
    if (!isAllReports) {
      localStorage.setItem(getStorageKey(user, formType), JSON.stringify(updatedRecords));
    }

    // Jika sedang membuka popup detail dari data yang diedit, sinkronkan juga
    if (selectedDetailRecord && selectedDetailRecord.id === editingRecord.id) {
      setSelectedDetailRecord({ ...editingRecord });
    }

    recordActivity(
      user,
      `Edit ${(editingRecord.formType || formType).toUpperCase()}`,
      `Memperbarui data laporan ${editingRecord.fullName}`,
    );

    setIsEditingSaving(false);
    setEditingRecord(null);
    setMessage({
      text: `Data laporan berhasil diperbarui.${editSyncNote}`,
      type: editSyncNote ? 'info' : 'success',
    });
  };

  // Hapus data laporan
  const handleDeleteRecord = async (recordId, recordName = '') => {
    const recordToDelete = records.find((record) => record.id === recordId);
    if (!recordToDelete || !canManageRecord(recordToDelete)) return;

    if (
      !window.confirm(
        `Yakin ingin menghapus laporan nasabah ${recordName || 'ini'}? Tindakan ini tidak dapat dibatalkan.`,
      )
    ) {
      return;
    }

    try {
      let deleteQuery = supabase.from('laporan_rm').delete().eq('id', recordId);
      if (user?.id && !isAdminRole(user.role)) {
        deleteQuery = deleteQuery.eq('user_id', user.id);
      }
      const { error } = await deleteQuery;
      if (error) console.warn('Supabase delete notice:', error.message);
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }

    const updated = records.filter((r) => r.id !== recordId);
    setRecords(updated);
    if (!isAllReports) {
      localStorage.setItem(getStorageKey(user, formType), JSON.stringify(updated));
    }

    if (selectedDetailRecord?.id === recordId) {
      setSelectedDetailRecord(null);
    }

    recordActivity(
      user,
      `Hapus ${(recordToDelete.formType || formType).toUpperCase()}`,
      `Menghapus data laporan ${recordName}`,
    );
  };

  // Urutan data: data paling baru diupload selalu berada di paling atas
  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }, [records]);

  // Filter pencarian dan status nasabah
  const filteredRecords = useMemo(() => {
    let result = sortedRecords;

    if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.customerType === statusFilter);
    }

    if (followUpFilter !== 'ALL') {
      result = result.filter(
        (r) => normalizeFollowUpStatus(r.followUpStatus) === followUpFilter,
      );
    }

    if (isAllReports && reportTypeFilter !== 'ALL') {
      result = result.filter((record) => record.formType === reportTypeFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.fullName?.toLowerCase().includes(q) ||
          r.transactionType?.toLowerCase().includes(q) ||
          r.identityNumber?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.address?.toLowerCase().includes(q) ||
          r.followUp?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [sortedRecords, searchTerm, statusFilter, followUpFilter, reportTypeFilter, isAllReports]);

  // Jumlah laporan per status tindak lanjut
  const followUpCounts = useMemo(() => {
    const pending = sortedRecords.filter(
      (record) => normalizeFollowUpStatus(record.followUpStatus) === 'pending',
    ).length;
    return { pending, done: sortedRecords.length - pending };
  }, [sortedRecords]);

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <main className="relative min-h-screen font-sans text-slate-800 pb-16 overflow-x-hidden bg-[#C9DCEF]">
      {/* Background Decor Layer - Serasi dengan Home */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden print:hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[#C9DCEF] via-[#A9C6E5] to-[#C9DCEF]" />

        <div
          className="absolute top-16 right-10 w-72 h-72 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(1, 65, 129, 0.3) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="absolute bottom-20 left-10 w-64 h-64 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255, 116, 1, 0.35) 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#014181]/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-[#FF7401]/20 blur-[110px]" />
        <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] rounded-full bg-[#0A5AA3]/20 blur-[130px]" />
      </div>

      <div className="relative z-10">
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/90 border-b border-slate-200/70 shadow-xs transition-all duration-300 print:hidden">
          <div className="h-1 bg-[#FF7401] w-full" />
          <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            {/* Tombol Kembali / Navigasi View */}
            {viewMode === 'reports' ? (
              <button
                type="button"
                onClick={() => (
                  isAllReports || returnToDashboard ? onBack() : setViewMode('form')
                )}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-[#014181] text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer group"
                title={
                  isAllReports || returnToDashboard
                    ? 'Kembali ke dashboard'
                    : 'Kembali ke Formulir Input'
                }
              >
                <svg
                  className="w-4 h-4 text-[#014181] group-hover:-translate-x-0.5 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>
                  {isAllReports || returnToDashboard
                    ? isAllReports ? 'Dashboard Admin' : 'Dashboard'
                    : 'Formulir Input'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-[#014181] text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer group"
                title="Kembali ke Beranda"
              >
                <svg
                  className="w-4 h-4 text-[#014181] group-hover:-translate-x-0.5 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Beranda</span>
              </button>
            )}

            {/* Toggle View & User Profile */}
            <div className="flex items-center gap-2 sm:gap-2.5">

              {/* Tombol menu Tindak Lanjut */}
              <button
                type="button"
                onClick={() => navigate('/tindak-lanjut')}
                className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3 rounded-full border border-[#FF7401]/40 bg-[#FF7401]/10 text-[11px] font-bold text-[#B34A02] hover:bg-[#FF7401]/20 active:scale-95 transition-all cursor-pointer"
                title="Buka menu Tindak Lanjut"
              >
                <Icon name="target" size={14} />
                <span className="hidden sm:inline">Tindak Lanjut</span>
              </button>

              {/* User Profile Pill */}
              <div className="flex items-center h-9 sm:h-10 gap-2 p-1 pr-3 rounded-full border border-slate-200/80 bg-white shadow-xs">
                <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#014181] text-white text-xs font-bold ring-2 ring-[#FF7401]/40 overflow-hidden shrink-0">
                  {user?.photo ? (
                    <img
                      src={user.photo}
                      alt={user?.name || 'Foto'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name?.slice(0, 2).toUpperCase() || 'RM'
                  )}
                </span>
                <span className="text-xs font-bold text-[#014181] max-w-[90px] sm:max-w-none truncate hidden sm:inline">
                  {user?.name || 'Insan BRILiaN'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ============================================================
            TAMPILAN 1: HALAMAN LAPORAN DALAM BENTUK CARD (viewMode === 'reports')
            ============================================================ */}
        {viewMode === 'reports' ? (
          <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-5 animate-in fade-in duration-300">
            {/* Hero Banner Laporan */}
            <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#014181] via-[#002D5B] to-[#001D3D] text-white p-5 sm:p-7 shadow-[0_20px_50px_-15px_rgba(1,65,129,0.5)] border border-blue-900/30">
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#FF7401]/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF7401] via-[#FF9B3D] to-transparent" />

              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#FF7401] text-white shadow-xs">
                      {isAllReports ? 'Rekap Gabungan' : isRMFT ? 'Rekap Funding' : 'Rekap Kredit'}
                    </span>
                    <span className="text-[11px] text-blue-200/80 font-medium">
                      Semua Data Tersimpan
                    </span>
                    {followUpCounts.pending > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-orange-200 border border-orange-300/40">
                        {followUpCounts.pending} perlu ditindaklanjuti
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm truncate">
                    {isAllReports ? 'Semua Laporan' : `Laporan ${title}`}
                  </h1>
                  <p className="text-xs text-blue-100/80 max-w-xl leading-relaxed">
                    {isAllReports
                      ? 'Daftar gabungan laporan RMFT dan RM Kredit dari seluruh pegawai, diurutkan dari yang terbaru.'
                      : 'Daftar seluruh laporan nasabah. Data paling atas merupakan laporan terbaru.'}
                  </p>
                </div>

                {!isAllReports && (
                  <button
                    type="button"
                    onClick={() => setViewMode('form')}
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#014181] hover:bg-blue-50 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer whitespace-nowrap"
                  >
                    <span>+ Upload Laporan Baru</span>
                  </button>
                )}
              </div>
            </section>

            {/* Filter & Pencarian Laporan */}
            <section className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Input Search */}
                <div className="relative flex-1 min-w-0">
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari berdasarkan nama nasabah, NIK, nomor HP, atau transaksi..."
                    className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Kategori Laporan */}
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                  {isAllReports && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReportTypeFilter('ALL')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                          reportTypeFilter === 'ALL'
                            ? 'bg-[#014181] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Semua Jenis
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportTypeFilter('rmft')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                          reportTypeFilter === 'rmft'
                            ? 'bg-[#014181] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        RMFT
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportTypeFilter('rmkredit')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                          reportTypeFilter === 'rmkredit'
                            ? 'bg-[#014181] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        RM Kredit
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === 'ALL'
                        ? 'bg-[#014181] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({sortedRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Nasabah')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === 'Nasabah'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Nasabah BRI
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('Non-Nasabah')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === 'Non-Nasabah'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Non-Nasabah
                  </button>
                </div>
              </div>

              {/* Filter Status Tindak Lanjut */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                <span className="mr-0.5 text-[11px] font-bold text-slate-500">
                  Tindak lanjut:
                </span>
                <button
                  type="button"
                  onClick={() => setFollowUpFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    followUpFilter === 'ALL'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Status
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpFilter('pending')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    followUpFilter === 'pending'
                      ? 'bg-[#FF7401] text-white shadow-xs'
                      : 'bg-orange-50 text-[#B34A02] hover:bg-orange-100 border border-orange-200/70'
                  }`}
                >
                  <Icon name="target" size={13} />
                  Perlu Tindak Lanjut
                  <span className={`rounded-full px-1.5 text-[10px] ${followUpFilter === 'pending' ? 'bg-white/25' : 'bg-orange-100'}`}>
                    {followUpCounts.pending}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpFilter('done')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    followUpFilter === 'done'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70'
                  }`}
                >
                  <Icon name="check" size={13} />
                  Sudah Selesai
                  <span className={`rounded-full px-1.5 text-[10px] ${followUpFilter === 'done' ? 'bg-white/25' : 'bg-emerald-100'}`}>
                    {followUpCounts.done}
                  </span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-slate-500 border-t border-slate-100 pt-2 px-1">
                <span>
                  Menampilkan <strong>{filteredRecords.length}</strong> dari{' '}
                  <strong>{records.length}</strong> total laporan
                </span>
                <span className="text-[#FF7401] font-semibold flex items-center gap-1">
                  <span>↓</span>
                  <span>Urutan: Data Terbaru Paling Atas</span>
                </span>
              </div>
            </section>

            {/* DAFTAR CARD LAPORAN */}
            {reportsLoadError && viewMode === 'reports' && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800" role="alert">
                {reportsLoadError}
              </p>
            )}

            {isLoadingReports && viewMode === 'reports' ? (
              <p className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-sm text-slate-500" role="status">
                Memuat laporan...
              </p>
            ) : filteredRecords.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                {filteredRecords.map((record, index) => {
                  const needsFollowUp = normalizeFollowUpStatus(record.followUpStatus) === 'pending';
                  const isNewest = index === 0 && !searchTerm && statusFilter === 'ALL'
                    && followUpFilter === 'ALL' && reportTypeFilter === 'ALL';
                  return (
                    <div
                      key={record.id}
                      className={`relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden min-w-0 ${
                        isNewest
                          ? 'border-[#FF7401]/70 ring-1 ring-[#FF7401]/30 bg-gradient-to-b from-orange-50/20 via-white to-white'
                          : 'border-slate-200/80 hover:border-blue-200'
                      }`}
                    >
                      <div className="space-y-3 min-w-0">
                        {/* Header Baris: Badge Terbaru (jika ada), Status, & Tanggal */}
                        <div className="space-y-2 pb-2.5 border-b border-slate-100 min-w-0">
                          {isNewest && (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF7401] to-[#FF9B3D] text-black text-[10px] font-extrabold tracking-wider uppercase w-fit shadow-xs">
                              <Icon name="sparkles" size={13} />
                              <span>Terbaru Diupload</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                              {isAllReports && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#014181]/10 text-[#014181] border border-[#014181]/15 shrink-0">
                                  {record.formType === 'rmkredit' ? 'RM KREDIT' : 'RMFT'}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                                  record.customerType === 'Nasabah'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {record.customerType || 'Nasabah'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#014181] border border-blue-200 truncate min-w-0">
                                {record.transactionType || 'Transaksi'}
                              </span>
                            </div>

                            <time className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 shrink-0 whitespace-nowrap">
                              {new Intl.DateTimeFormat('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }).format(new Date(record.createdAt))}
                            </time>
                          </div>
                        </div>

                        {/* Strip Status Tindak Lanjut */}
                        <div
                          className={`flex items-start gap-2 rounded-xl px-2.5 py-2 border min-w-0 ${
                            needsFollowUp
                              ? 'bg-orange-50/90 border-orange-200/70'
                              : 'bg-emerald-50/90 border-emerald-200/70'
                          }`}
                        >
                          <span
                            className={`mt-0.5 shrink-0 ${
                              needsFollowUp ? 'text-[#FF7401]' : 'text-emerald-600'
                            }`}
                          >
                            <Icon name={needsFollowUp ? 'target' : 'check'} size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-[10px] font-extrabold uppercase tracking-wide ${
                                needsFollowUp ? 'text-[#B34A02]' : 'text-emerald-700'
                              }`}
                            >
                              {needsFollowUp ? 'Perlu Tindak Lanjut' : 'Sudah Selesai'}
                            </p>
                            <p
                              className={`truncate text-[11px] ${
                                needsFollowUp
                                  ? 'font-semibold text-[#8A3A02]'
                                  : 'text-emerald-700/80'
                              }`}
                              title={needsFollowUp ? record.followUp || '' : ''}
                            >
                              {needsFollowUp
                                ? record.followUp || 'Keterangan belum diisi'
                                : 'Tidak perlu keterangan tambahan'}
                            </p>
                          </div>
                        </div>

                        {/* Customer Info Row */}
                        <div className="flex items-start gap-3 min-w-0">
                          {record.photo ? (
                            <img
                              src={record.photo}
                              alt={record.fullName}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewPhoto(record.photo)}
                              title="Klik untuk perbesar foto"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-lg shrink-0">
                              <Icon name="user" size={21} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h3 className="text-sm font-bold text-[#014181] truncate" title={record.fullName}>
                              {record.fullName}
                            </h3>
                            {record.userName && (
                              <p className="truncate text-[10px] font-medium text-slate-400">
                                Dibuat oleh {record.userName}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 truncate">
                              <span className="font-semibold text-slate-700">
                                {record.customerType === 'Non-Nasabah' ? 'NIK:' : 'No. Rek/NIK:'}
                              </span>{' '}
                              <span className="font-mono text-slate-700">{record.identityNumber || '-'}</span>
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                              <span className="font-semibold text-slate-700 shrink-0">HP:</span>{' '}
                              <span className="font-mono text-slate-700 truncate">{record.phone || '-'}</span>
                              {record.phone && (
                                <a
                                  href={`https://wa.me/${record.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 hover:bg-emerald-100 shrink-0 cursor-pointer"
                                  title="Chat WhatsApp"
                                >
                                  WA <Icon name="externalLink" size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Alamat Snippet Box */}
                        <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 text-[11px] text-slate-600 min-w-0 overflow-hidden">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <Icon name="pin" size={13} className="shrink-0 text-slate-400" />
                            <p className="truncate min-w-0 flex-1">
                              <strong className="text-slate-700">Alamat:</strong>{' '}
                              {record.address || '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ACTION BUTTONS: DETAIL, EDIT, HAPUS */}
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2 min-w-0 print:hidden">
                        {/* Tombol Detail */}
                        <button
                          type="button"
                          onClick={() => setSelectedDetailRecord(record)}
                          className="flex-1 py-1.5 px-2.5 text-xs font-bold text-[#014181] bg-blue-50 hover:bg-[#014181] hover:text-white border border-blue-200/60 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0"
                        >
                          <Icon name="eye" size={14} />
                          <span>Detail</span>
                        </button>

                        {/* Tombol Edit */}
                        {canManageRecord(record) && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingRecord(record)}
                              className="flex-1 py-1.5 px-2.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-200/60 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0"
                            >
                              <Icon name="edit" size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(record.id, record.fullName)}
                              className="flex-1 py-1.5 px-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200/60 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0"
                              title="Hapus data ini"
                            >
                              <Icon name="trash" size={13} />
                              <span>Hapus</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center bg-white/90 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-[#014181] flex items-center justify-center text-3xl mx-auto">
                  <Icon name="clipboard" size={22} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-700">
                  {searchTerm || statusFilter !== 'ALL' || followUpFilter !== 'ALL' || reportTypeFilter !== 'ALL'
                    ? 'Tidak ada data laporan yang cocok'
                    : 'Belum Ada Laporan Tersimpan'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== 'ALL' || followUpFilter !== 'ALL' || reportTypeFilter !== 'ALL'
                    ? 'Coba ganti kata kunci pencarian atau ubah filter status nasabah / tindak lanjut.'
                    : 'Mulai dokumentasikan aktivitas transaksi nasabah Anda melalui formulir input.'}
                </p>
                {!isAllReports && (
                  <button
                    type="button"
                    onClick={() => setViewMode('form')}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#014181] to-[#0A5AA3] hover:from-[#002D5B] hover:to-[#014181] rounded-xl transition-all shadow-md active:scale-95 cursor-pointer inline-flex items-center gap-2 mt-2"
                  >
                    <span>+ Input Laporan Sekarang</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
              TAMPILAN 2: HALAMAN FORMULIR INPUT TRANSAKSI (viewMode === 'form')
              ============================================================ */
          <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-5 space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            {/* Hero Executive Banner */}
            <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#014181] via-[#002D5B] to-[#001D3D] text-white p-5 sm:p-7 shadow-[0_20px_50px_-15px_rgba(1,65,129,0.5)] border border-blue-900/30">
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#FF7401]/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF7401] via-[#FF9B3D] to-transparent" />

              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#FF7401] text-white shadow-xs">
                      {isRMFT ? 'Funding & Transaction' : 'Lending & Financing'}
                    </span>
                    <span className="text-[11px] text-blue-200/80 font-medium">
                      BRI KCP Iskandar
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
                    {title}
                  </h1>
                  <p className="text-xs text-blue-100/80 max-w-xl leading-relaxed">
                    {isRMFT
                      ? 'Pencatatan kunjungan nasabah, pembukaan rekening simpanan, dan aktivitas transaksi funding harian.'
                      : 'Pencatatan kunjungan prospek, konsultasi fasilitas kredit, restrukturisasi, dan tindak lanjut pinjaman nasabah.'}
                  </p>
                </div>

                {/* Tombol Lihat Laporan */}
                <button
                  type="button"
                  onClick={() => setViewMode('reports')}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all active:scale-95 shadow-sm backdrop-blur-md cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5"><Icon name="clipboard" size={14} /> Lihat Laporan</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#FF7401] text-[10px] font-bold">
                    {records.length}
                  </span>
                </button>
              </div>
            </section>

            {/* Main Form Card */}
            <section className="relative bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#014181] to-[#FF7401]" />

              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#014181] flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-[#FF7401]" />
                    Input Data Nasabah & Transaksi
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 pl-3.5">
                    Lengkapi data di bawah ini untuk mendokumentasikan aktivitas harian Anda.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">* Wajib diisi</span>
              </div>

              {/* Notification Banner */}
              {message.text && (
                <div
                  className={`mb-5 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border ${
                    message.type === 'error'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : message.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  <span>
                    <Icon
                      name={message.type === 'error' ? 'warning' : message.type === 'success' ? 'check' : 'info'}
                      size={15}
                    />
                  </span>
                  <span>{message.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* Row 1: Nama Lengkap & Status Nasabah */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Nama Lengkap Nasabah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={form.fullName}
                      onChange={updateField}
                      placeholder="Masukkan nama lengkap nasabah"
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Status Nasabah <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="customerType"
                      value={form.customerType}
                      onChange={updateField}
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all"
                    >
                      <option value="" disabled>
                        Pilih Status Nasabah
                      </option>
                      <option value="Nasabah">Nasabah BRI</option>
                      <option value="Non-Nasabah">Non-Nasabah (Calon Nasabah)</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: No. Identitas & No. HP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {form.customerType === 'Non-Nasabah'
                        ? 'No. KTP / NIK'
                        : 'No. Rekening / No. NIK'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="identityNumber"
                      value={form.identityNumber}
                      onChange={updateField}
                      placeholder={
                        form.customerType === 'Non-Nasabah'
                          ? 'Masukkan 16 digit NIK'
                          : 'Nomor rekening atau 16 digit NIK'
                      }
                      inputMode="numeric"
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      No. Handphone / WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={updateField}
                      placeholder="Contoh: 081234567890"
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Row 3: Jenis Transaksi & Tindak Lanjut */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {transactionLabel} (Aktivitas) <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="transactionType"
                      value={form.transactionType}
                      onChange={updateField}
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all"
                    >
                      <option value="" disabled>
                        Pilih {transactionLabel.toLowerCase()}
                      </option>
                      {transactionOptions.map((opt) => (
                        <option value={opt} key={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Status Tindak Lanjut <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="followUpStatus"
                      value={form.followUpStatus}
                      onChange={handleFollowUpStatusChange}
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all"
                    >
                      <option value="" disabled>
                        Pilih status tindak lanjut
                      </option>
                      {FOLLOW_UP_STATUS_OPTIONS.map((opt) => (
                        <option value={opt.value} key={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      {FOLLOW_UP_STATUS_OPTIONS.find((opt) => opt.value === form.followUpStatus)?.hint
                        || 'Pilih status tindak lanjut: Perlu Ditindaklanjuti atau Selesai.'}
                    </p>
                  </div>
                </div>

                {/* Keterangan Tindak Lanjut: Kondisional sesuai status yang dipilih */}
                {form.followUpStatus === 'pending' && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-slate-700">
                      Keterangan Tindak Lanjut (Rencana Langkah Berikutnya) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="followUp"
                      rows="2"
                      value={form.followUp}
                      onChange={updateField}
                      placeholder="Contoh: Jadwalkan akad kredit / ambil kelengkapan berkas minggu depan"
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400 resize-none"
                    />
                    <p className="text-[10px] font-semibold text-[#B34A02]">
                      Wajib diisi karena status &quot;Perlu Ditindaklanjuti&quot; dipilih. Tugas akan masuk ke daftar aktif menu Tindak Lanjut.
                    </p>
                  </div>
                )}

                {form.followUpStatus === 'done' && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-slate-700">
                      Keterangan Penyelesaian (Hasil Penyelesaian)
                    </label>
                    <textarea
                      name="followUp"
                      rows="2"
                      value={form.followUp}
                      onChange={updateField}
                      placeholder="Contoh: Berkas telah lengkap dan rekening/fasilitas berhasil diproses dengan tuntas."
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400 resize-none"
                    />
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <span className="mt-0.5 shrink-0 text-emerald-600">
                        <Icon name="check" size={14} />
                      </span>
                      <p className="text-[11px] font-semibold text-emerald-700">
                        Status &quot;Selesai&quot; dipilih — pekerjaan ditandai tuntas. Anda dapat mencatat keterangan penyelesaian di atas jika diperlukan.
                      </p>
                    </div>
                  </div>
                )}

                {/* Hubungkan laporan ke tugas tindak lanjut yang masih aktif */}
                {(isLoadingTaskCandidates || taskCandidates.length > 0) && (
                  <div className="space-y-2.5 rounded-2xl border border-[#014181]/15 bg-blue-50/60 p-3.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-[#014181]">
                        <Icon name="target" size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#014181]">
                          Lanjutkan tugas tindak lanjut yang sudah ada?
                        </p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                          Ditemukan tugas aktif untuk nasabah ini. Pilih tugas yang benar bila ada lebih
                          dari satu. Laporan tetap tersimpan sebagai catatan baru.
                        </p>
                      </div>
                    </div>

                    {isLoadingTaskCandidates ? (
                      <p className="text-[11px] font-semibold text-slate-500" role="status">
                        Mencari tugas aktif nasabah ini...
                      </p>
                    ) : (
                      <select
                        name="linkedTaskId"
                        value={form.linkedTaskId}
                        onChange={updateField}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                      >
                        <option value="">Tidak terhubung — simpan sebagai laporan biasa</option>
                        {taskCandidates.map((task) => (
                          <option key={task.id} value={task.id}>
                            {`${task.activity || 'Pekerjaan'} • ${task.note || 'Tanpa keterangan'} • ${formatJakartaDate(task.lastReportAt)}`}
                          </option>
                        ))}
                      </select>
                    )}

                    {linkedTask && (
                      <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] text-slate-600">
                        <p className="truncate font-bold text-[#014181]">{linkedTask.customerName}</p>
                        <p className="truncate">
                          Rek/NIK: <span className="font-mono">{maskIdentity(linkedTask.customerIdentity)}</span>
                        </p>
                        <p className="truncate">Pekerjaan: {linkedTask.activity || '-'}</p>
                        <p className="truncate">Keterangan: {linkedTask.note || '-'}</p>
                        <p className="truncate">Laporan terakhir: {formatJakartaDate(linkedTask.lastReportAt)}</p>
                        {form.followUpStatus === TASK_STATUS.DONE ? (
                          <p className="pt-0.5 font-bold text-[#B34A02]">
                            Tugas ini akan ditutup setelah laporan disimpan.
                          </p>
                        ) : (
                          <p className="pt-0.5 font-bold text-[#014181]">
                            Keterangan dan tanggal tugas ini akan diperbarui.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({ ...current, linkedTaskId: '' }))
                          }
                          className="mt-1 text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Batalkan tautan
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Row 4: Alamat Domisili */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Alamat Lengkap / Lokasi Kunjungan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    rows="2"
                    value={form.address}
                    onChange={updateField}
                    placeholder="Masukkan alamat domisili atau lokasi usaha nasabah..."
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* Row 5: Upload Foto Dokumentasi */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Foto Dokumentasi Kunjungan
                  </label>

                  {form.photo ? (
                    <div className="flex items-center gap-4 p-3 rounded-2xl bg-blue-50/50 border border-blue-200/60">
                      <img
                        src={form.photo}
                        alt="Pratinjau dokumentasi"
                        className="w-16 h-16 object-cover rounded-xl border border-blue-200 shadow-xs cursor-pointer hover:opacity-90"
                        onClick={() => setPreviewPhoto(form.photo)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#014181] truncate">
                          {form.photoName || 'Foto Terlampir'}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          ✓ Foto siap diupload (terkompresi otomatis)
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({ ...current, photo: '', photoName: '' }))
                          }
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 mt-1 cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 hover:border-[#FF7401]/60 rounded-2xl bg-slate-50/60 hover:bg-white transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#014181] group-hover:bg-orange-50 group-hover:text-[#FF7401] flex items-center justify-center text-lg mb-2 transition-colors">
                        <Icon name="camera" size={22} />
                      </div>
                      <p className="text-xs font-bold text-slate-700 group-hover:text-[#014181]">
                        Pilih atau Ambil Foto Dokumentasi
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Format PNG, JPG, JPEG (otomatis dioptimalkan)
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-[#014181] bg-white  border-[#014181]/30 hover:bg-blue-50 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95">

                  <div className="w-full sm:w-auto flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(blankForm);
                        setMessage({ text: '', type: '' });
                      }}
                      className="w-1/3 sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                      Reset
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-2/3 sm:w-auto px-6 py-2.5 text-xs font-bold !text-white rounded-xl shadow-md shadow-[#FF7401]/30 hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                      style={{ backgroundColor: '#FF7401', color: '#ffffff' }}
                    >
                      {isSaving ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Mengupload...</span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5"><Icon name="upload" size={14} /> Upload Laporan</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>

      {/* ============================================================
          POPUP MODAL DETAIL DATA NASABAH (selectedDetailRecord !== null)
          ============================================================ */}
      {selectedDetailRecord && (
        <article className="report-print-document" aria-hidden="true">
          <header className="report-print-header">
            <img src="/Img/bri-logo.png" alt="Bank BRI" />
            <div>
              <p>BRI DIGITAL</p>
              <h1>LAPORAN KUNJUNGAN NASABAH</h1>
              <span>
                {(selectedDetailRecord.formType || formType) === 'rmft'
                  ? 'Relationship Manager Funding & Transaksi'
                  : 'Relationship Manager Kredit'}
              </span>
            </div>
          </header>

          <p className="report-print-intro">
            Berikut disampaikan laporan kegiatan dan tindak lanjut nasabah yang telah dicatat melalui aplikasi Laporan Harian Relationship Manager.
          </p>

          <table className="report-print-table">
            <tbody>
              <tr>
                <th>Nama Nasabah</th>
                <td>{selectedDetailRecord.fullName || '-'}</td>
              </tr>
              <tr>
                <th>Status Nasabah</th>
                <td>{selectedDetailRecord.customerType || '-'}</td>
              </tr>
              <tr>
                <th>No. Rekening / NIK</th>
                <td>{selectedDetailRecord.identityNumber || '-'}</td>
              </tr>
              <tr>
                <th>No. Handphone / WhatsApp</th>
                <td>{selectedDetailRecord.phone || '-'}</td>
              </tr>
              <tr>
                <th>Alamat / Lokasi Kunjungan</th>
                <td>{selectedDetailRecord.address || '-'}</td>
              </tr>
              <tr>
                <th>Jenis Layanan / Transaksi</th>
                <td>{selectedDetailRecord.transactionType || '-'}</td>
              </tr>
              <tr>
                <th>Status Tindak Lanjut</th>
                <td>
                  {normalizeFollowUpStatus(selectedDetailRecord.followUpStatus) === 'pending'
                    ? 'Perlu Tindak Lanjut'
                    : 'Sudah Selesai'}
                </td>
              </tr>
              <tr>
                <th>Keterangan Tindak Lanjut</th>
                <td>
                  {normalizeFollowUpStatus(selectedDetailRecord.followUpStatus) === 'pending'
                    ? selectedDetailRecord.followUp || '-'
                    : 'Tidak diperlukan'}
                </td>
              </tr>
              <tr>
                <th>Waktu Pencatatan</th>
                <td>
                  {new Intl.DateTimeFormat('id-ID', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  }).format(new Date(selectedDetailRecord.createdAt))}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="report-print-note">
            Laporan ini dibuat secara elektronik berdasarkan data yang dicatat oleh petugas.
          </p>

          <footer className="report-print-signatures">
            <div>
              <p>Petugas Relationship Manager,</p>
              <strong>{selectedDetailRecord.userName || user?.name || 'Pegawai'}</strong>
            </div>
            <div>
              <p>Mengetahui,</p>
              <strong>________________________</strong>
            </div>
          </footer>
          <p className="report-print-generated">
            Dicetak pada {new Intl.DateTimeFormat('id-ID', {
              dateStyle: 'full',
              timeStyle: 'short',
            }).format(new Date())}
          </p>
        </article>
      )}

      {selectedDetailRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedDetailRecord(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Top Bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#014181] via-[#0A5AA3] to-[#FF7401] shrink-0" />

            {/* Header Detail */}
            <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-[#FF7401]" />
                  <p className="text-[10px] font-bold tracking-wider text-[#FF7401] uppercase">
                    Rincian Nasabah
                  </p>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#014181] mt-0.5 truncate">
                  {selectedDetailRecord.fullName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      selectedDetailRecord.customerType === 'Nasabah'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {selectedDetailRecord.customerType || 'Nasabah'}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#014181] border border-blue-200">
                    {selectedDetailRecord.transactionType}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      normalizeFollowUpStatus(selectedDetailRecord.followUpStatus) === 'pending'
                        ? 'bg-orange-50 text-[#B34A02] border-orange-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <Icon
                      name={
                        normalizeFollowUpStatus(selectedDetailRecord.followUpStatus) === 'pending'
                          ? 'target'
                          : 'check'
                      }
                      size={11}
                    />
                    {normalizeFollowUpStatus(selectedDetailRecord.followUpStatus) === 'pending'
                      ? 'Perlu Tindak Lanjut'
                      : 'Sudah Selesai'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all text-lg font-semibold active:scale-95 shrink-0"
              >
                ×
              </button>
            </div>

            {/* Body Detail Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              {/* Box 1: Informasi Kontak & Identitas */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {selectedDetailRecord.customerType === 'Non-Nasabah'
                      ? 'No. NIK / KTP'
                      : 'No. Rekening / NIK'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-xs text-[#014181] font-mono">
                      {selectedDetailRecord.identityNumber || '-'}
                    </strong>
                    {selectedDetailRecord.identityNumber && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedDetailRecord.identityNumber)}
                        className="text-[10px] text-slate-400 hover:text-[#014181] font-semibold p-1"
                        title="Salin nomor"
                      >
                        {copiedId ? '✓ Tersalin' : <><Icon name="clipboard" size={12} /> Salin</>}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    No. Handphone / WA
                  </span>
                  <div className="flex items-center gap-2">
                    <strong className="text-xs text-slate-800 font-mono">
                      {selectedDetailRecord.phone || '-'}
                    </strong>
                    {selectedDetailRecord.phone && (
                      <a
                        href={`https://wa.me/${selectedDetailRecord.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hover:bg-emerald-100"
                      >
                        <><Icon name="chat" size={12} /> Chat WA</>
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Alamat Domisili / Lokasi
                  </span>
                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-relaxed break-words">
                    {selectedDetailRecord.address || 'Alamat tidak dicantumkan.'}
                  </p>
                </div>
              </div>

              {/* Box 2: Detail Transaksi & Rencana Follow Up */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Layanan Transaksi
                  </span>
                  <strong className="text-xs text-[#014181] text-right break-words">
                    {selectedDetailRecord.transactionType || '-'}
                  </strong>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Rencana Tindak Lanjut (Follow-Up)
                  </span>
                  {normalizeFollowUpStatus(selectedDetailRecord.followUpStatus) === 'pending' ? (
                    <>
                      <p className="text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-orange-200/60 text-[#FF7401] font-semibold break-words">
                        {selectedDetailRecord.followUp || 'Keterangan tindak lanjut belum diisi.'}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#B34A02]">
                        <Icon name="target" size={11} />
                        Masih perlu ditindaklanjuti
                      </p>
                    </>
                  ) : (
                    <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <Icon name="check" size={14} />
                        <span>Pekerjaan Selesai</span>
                      </div>
                      {selectedDetailRecord.followUp ? (
                        <p className="rounded-lg bg-white p-2 text-xs text-slate-700 break-words border border-emerald-100 leading-relaxed">
                          {selectedDetailRecord.followUp}
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700">
                          Pekerjaan ditandai selesai tanpa catatan tambahan.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>Waktu Pencatatan Laporan</span>
                  <span className="font-semibold text-slate-600">
                    {new Intl.DateTimeFormat('id-ID', {
                      dateStyle: 'full',
                      timeStyle: 'medium',
                    }).format(new Date(selectedDetailRecord.createdAt))}
                  </span>
                </div>
              </div>

              {/* Box 3: Foto Dokumentasi */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Foto Dokumentasi Kunjungan
                </span>
                {selectedDetailRecord.photo ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 group bg-slate-50">
                    <img
                      src={selectedDetailRecord.photo}
                      alt="Dokumentasi Kunjungan"
                      className="w-full max-h-64 object-contain mx-auto cursor-pointer"
                      onClick={() => setPreviewPhoto(selectedDetailRecord.photo)}
                    />
                    <div
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => setPreviewPhoto(selectedDetailRecord.photo)}
                    >
                      <span className="text-white text-xs font-bold px-3 py-1.5 rounded-full bg-black/60">
                        <><Icon name="eye" size={13} /> Klik untuk perbesar</>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                    Tidak ada foto dokumentasi terlampir.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Detail */}
            <div className="p-3 sm:p-4 px-4 sm:px-6 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {canManageRecord(selectedDetailRecord) && (
                  <>
                <button
                  type="button"
                  onClick={() => {
                    startEditingRecord(selectedDetailRecord);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Icon name="edit" size={13} />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteRecord(
                      selectedDetailRecord.id,
                      selectedDetailRecord.fullName,
                    )
                  }
                  className="px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Icon name="trash" size={13} />
                  <span>Hapus</span>
                </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#014181] hover:bg-[#0A5AA3] rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDetailRecord(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          POPUP MODAL EDIT DATA LAPORAN (editingRecord !== null)
          ============================================================ */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingRecord(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-[#FF7401] to-[#014181] shrink-0" />

            <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
              <div>
                <p className="text-[10px] font-bold tracking-wider text-amber-600 uppercase">
                  Perbarui Informasi
                </p>
                <h2 className="text-base sm:text-lg font-bold text-[#014181] mt-0.5">
                  Edit Data Laporan
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Perubahan akan otomatis disinkronkan ke Supabase dan perangkat Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all text-lg font-semibold active:scale-95"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Nama Lengkap</label>
                  <input
                    type="text"
                    name="fullName"
                    value={editingRecord.fullName}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Status Nasabah</label>
                  <select
                    name="customerType"
                    value={editingRecord.customerType}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  >
                    <option value="Nasabah">Nasabah BRI</option>
                    <option value="Non-Nasabah">Non-Nasabah</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    No. Rekening / NIK
                  </label>
                  <input
                    type="text"
                    name="identityNumber"
                    value={editingRecord.identityNumber}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">No. Handphone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editingRecord.phone}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">{editingTransactionLabel}</label>
                  <select
                    name="transactionType"
                    value={editingRecord.transactionType}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  >
                    {editingTransactionOptions.map((opt) => (
                      <option value={opt} key={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Status Tindak Lanjut</label>
                  <select
                    name="followUpStatus"
                    value={editingRecord.followUpStatus}
                    onChange={handleEditingFollowUpStatusChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  >
                    {FOLLOW_UP_STATUS_OPTIONS.map((opt) => (
                      <option value={opt.value} key={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Keterangan tindak lanjut: kondisional sesuai status */}
              {normalizeFollowUpStatus(editingRecord.followUpStatus) === 'pending' ? (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Keterangan Tindak Lanjut (Rencana Langkah Berikutnya) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="followUp"
                    rows="2"
                    value={editingRecord.followUp || ''}
                    onChange={updateEditingField}
                    placeholder="Contoh: Jadwalkan akad kredit / ambil berkas minggu depan"
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800 resize-none"
                  />
                  <p className="text-[10px] font-semibold text-[#B34A02]">
                    Wajib diisi karena status &quot;Perlu Ditindaklanjuti&quot; dipilih.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Keterangan Penyelesaian (Hasil Penyelesaian)
                  </label>
                  <textarea
                    name="followUp"
                    rows="2"
                    value={editingRecord.followUp || ''}
                    onChange={updateEditingField}
                    placeholder="Contoh: Berkas telah lengkap dan rekening/fasilitas berhasil diproses dengan tuntas."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800 resize-none"
                  />
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <span className="mt-0.5 shrink-0 text-emerald-600">
                      <Icon name="check" size={14} />
                    </span>
                    <p className="text-[11px] font-semibold text-emerald-700">
                      Status &quot;Selesai&quot; dipilih. Anda dapat mencatat keterangan penyelesaian jika diperlukan.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Alamat Lengkap</label>
                <textarea
                  name="address"
                  rows="2"
                  value={editingRecord.address}
                  onChange={updateEditingField}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800 resize-none"
                />
              </div>

              {/* Ganti / Hapus Foto Dokumentasi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Foto Dokumentasi</label>
                {editingRecord.photo ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <img
                      src={editingRecord.photo}
                      alt="Foto"
                      className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">Foto Terlampir</p>
                      <div className="flex items-center gap-2 mt-1">
                        <label className="text-[11px] font-bold text-[#014181] hover:underline cursor-pointer">
                          Ganti Foto
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditingPhotoChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingRecord((curr) => ({ ...curr, photo: '' }))
                          }
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-xs font-bold text-[#014181]">
                    <span className="inline-flex items-center gap-1.5"><Icon name="camera" size={14} /> Upload Foto Baru</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditingPhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isEditingSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#014181] hover:bg-[#0A5AA3] rounded-xl transition-all active:scale-95 shadow-sm disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isEditingSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          LIGHTBOX PREVIEW FOTO
          ============================================================ */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center text-lg font-bold z-10 transition-colors cursor-pointer"
            >
              ×
            </button>
            <img
              src={previewPhoto}
              alt="Dokumentasi Penuh"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}