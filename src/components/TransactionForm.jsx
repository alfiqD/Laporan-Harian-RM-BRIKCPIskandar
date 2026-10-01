import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../config/supabaseClient.js';
import { recordActivity } from '../pages/auth/activityLog.js';

const MAX_SAVED_RECORDS = 50;

function getStorageKey(user, formType) {
  return `bri-app-records-${formType}-${user?.id || 'guest'}`;
}

function readSavedRecords(user, formType) {
  try {
    const records = JSON.parse(localStorage.getItem(getStorageKey(user, formType)) || '[]');
    return Array.isArray(records) ? records : [];
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
  followUp: '',
  photo: '',
  photoName: '',
};

export default function TransactionForm({
  user,
  onBack,
  formType,
  title,
  transactionLabel,
  transactionOptions,
}) {
  // View mode: 'form' (input formulir) atau 'reports' (halaman kartu laporan)
  const [viewMode, setViewMode] = useState('form');

  const [form, setForm] = useState(blankForm);
  const [records, setRecords] = useState(() => readSavedRecords(user, formType));
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingSaving, setIsEditingSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(false);

  const isRMFT = formType === 'rmft';

  // Ambil data laporan dari Supabase saat formType/user dimuat
  useEffect(() => {
    async function fetchReports() {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('laporan_rm')
          .select('*')
          .eq('form_type', formType)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d) => ({
            id: d.id,
            fullName: d.full_name || '',
            customerType: d.customer_type || '',
            identityNumber: d.identity_number || '',
            phone: d.phone || '',
            address: d.address || '',
            transactionType: d.transaction_type || '',
            followUp: d.follow_up || '',
            photo: d.photo_url || '',
            createdAt: d.created_at || new Date().toISOString(),
          }));
          setRecords(mapped);
          localStorage.setItem(getStorageKey(user, formType), JSON.stringify(mapped));
        }
      } catch (err) {
        console.warn('Gagal memuat laporan Supabase:', err);
      }
    }
    fetchReports();
  }, [user, formType]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage({ text: '', type: '' });
  };

  const updateEditingField = (event) => {
    const { name, value } = event.target;
    setEditingRecord((current) => ({ ...current, [name]: value }));
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
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    const record = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    let savedId = record.id;
    let savedCreatedAt = record.createdAt;

    try {
      const { data: dbData, error: dbError } = await supabase
        .from('laporan_rm')
        .insert({
          user_id: user?.id || null,
          form_type: formType,
          full_name: form.fullName.trim(),
          customer_type: form.customerType,
          identity_number: form.identityNumber.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          transaction_type: form.transactionType,
          follow_up: form.followUp.trim(),
          photo_url: form.photo,
        })
        .select()
        .single();

      if (dbError) {
        console.warn('Supabase insert notice:', dbError.message);
      } else if (dbData) {
        savedId = dbData.id;
        savedCreatedAt = dbData.created_at;
      }
    } catch (dbErr) {
      console.warn('Supabase offline/error, menyimpan lokal:', dbErr);
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
      setMessage({ text: 'Data laporan berhasil diupload!', type: 'success' });
    } catch {
      setMessage({ text: 'Data tersimpan ke server.', type: 'success' });
    } finally {
      setIsSaving(false);
    }
  };

  // Simpan hasil Edit data laporan
  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editingRecord) return;
    setIsEditingSaving(true);

    try {
      // 1. Update ke Supabase
      const { error: dbError } = await supabase
        .from('laporan_rm')
        .update({
          full_name: editingRecord.fullName.trim(),
          customer_type: editingRecord.customerType,
          identity_number: editingRecord.identityNumber.trim(),
          phone: editingRecord.phone.trim(),
          address: editingRecord.address.trim(),
          transaction_type: editingRecord.transactionType,
          follow_up: editingRecord.followUp.trim(),
          photo_url: editingRecord.photo,
        })
        .eq('id', editingRecord.id);

      if (dbError) {
        console.warn('Supabase update notice:', dbError.message);
      }
    } catch (err) {
      console.warn('Supabase update error:', err);
    }

    // 2. Update LocalStorage dan State
    const updatedRecords = records.map((r) =>
      r.id === editingRecord.id ? { ...editingRecord } : r,
    );
    setRecords(updatedRecords);
    localStorage.setItem(getStorageKey(user, formType), JSON.stringify(updatedRecords));

    // Jika sedang membuka popup detail dari data yang diedit, sinkronkan juga
    if (selectedDetailRecord && selectedDetailRecord.id === editingRecord.id) {
      setSelectedDetailRecord({ ...editingRecord });
    }

    recordActivity(
      user,
      `Edit ${formType.toUpperCase()}`,
      `Memperbarui data laporan ${editingRecord.fullName}`,
    );

    setIsEditingSaving(false);
    setEditingRecord(null);
    setMessage({ text: 'Data laporan berhasil diperbarui.', type: 'success' });
  };

  // Hapus data laporan
  const handleDeleteRecord = async (recordId, recordName = '') => {
    if (
      !window.confirm(
        `Yakin ingin menghapus laporan nasabah ${recordName || 'ini'}? Tindakan ini tidak dapat dibatalkan.`,
      )
    ) {
      return;
    }

    try {
      await supabase.from('laporan_rm').delete().eq('id', recordId);
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }

    const updated = records.filter((r) => r.id !== recordId);
    setRecords(updated);
    localStorage.setItem(getStorageKey(user, formType), JSON.stringify(updated));

    if (selectedDetailRecord?.id === recordId) {
      setSelectedDetailRecord(null);
    }

    recordActivity(
      user,
      `Hapus ${formType.toUpperCase()}`,
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
  }, [sortedRecords, searchTerm, statusFilter]);

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <main className="relative min-h-screen font-sans text-slate-800 pb-16 overflow-x-hidden bg-[#C9DCEF]">
      {/* Background Decor Layer - Serasi dengan Home */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
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
        <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/90 border-b border-slate-200/70 shadow-xs transition-all duration-300">
          <div className="h-1 bg-[#FF7401] w-full" />
          <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            {/* Tombol Kembali / Navigasi View */}
            {viewMode === 'reports' ? (
              <button
                type="button"
                onClick={() => setViewMode('form')}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-[#014181] text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer group"
                title="Kembali ke Formulir Input"
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
                <span>Formulir Input</span>
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
                      {isRMFT ? 'Rekap Funding' : 'Rekap Kredit'}
                    </span>
                    <span className="text-[11px] text-blue-200/80 font-medium">
                      Semua Data Tersimpan
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm truncate">
                    Laporan {title}
                  </h1>
                  <p className="text-xs text-blue-100/80 max-w-xl leading-relaxed">
                    Daftar seluruh laporan nasabah yang telah diupload oleh admin. Data paling atas
                    merupakan laporan terbaru yang baru saja diunggah.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('form')}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#014181] hover:bg-blue-50 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer whitespace-nowrap"
                >
                  <span>+ Upload Laporan Baru</span>
                </button>
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

                {/* Filter Kategori Nasabah */}
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
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
            {filteredRecords.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-stretch">
                {filteredRecords.map((record, index) => {
                  const isNewest = index === 0 && !searchTerm && statusFilter === 'ALL';
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
                              <span>✨</span>
                              <span>Terbaru Diupload</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
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
                              👤
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h3 className="text-sm font-bold text-[#014181] truncate" title={record.fullName}>
                              {record.fullName}
                            </h3>
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
                                  WA ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Alamat & Follow Up Snippet Box */}
                        <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 text-[11px] text-slate-600 space-y-1 min-w-0 overflow-hidden">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <span className="shrink-0 text-slate-400">📍</span>
                            <p className="truncate min-w-0 flex-1">
                              <strong className="text-slate-700">Alamat:</strong>{' '}
                              {record.address || '-'}
                            </p>
                          </div>
                          <div className="flex items-start gap-1.5 min-w-0">
                            <span className="shrink-0 text-[#FF7401]">🎯</span>
                            <p className="truncate min-w-0 flex-1">
                              <strong className="text-[#FF7401]">Tindak Lanjut:</strong>{' '}
                              {record.followUp || '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ACTION BUTTONS: DETAIL, EDIT, HAPUS */}
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2 min-w-0">
                        {/* Tombol Detail */}
                        <button
                          type="button"
                          onClick={() => setSelectedDetailRecord(record)}
                          className="flex-1 py-1.5 px-2.5 text-xs font-bold text-[#014181] bg-blue-50 hover:bg-[#014181] hover:text-white border border-blue-200/60 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0"
                        >
                          <span>👁️</span>
                          <span>Detail</span>
                        </button>

                        {/* Tombol Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ ...record })}
                          className="flex-1 py-1.5 px-2.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-200/60 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0"
                        >
                          <span>✏️</span>
                          <span>Edit</span>
                        </button>

                        {/* Tombol Hapus */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id, record.fullName)}
                          className="flex-1 py-1.5 px-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200/60 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0"
                          title="Hapus data ini"
                        >
                          <span>🗑️</span>
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center bg-white/90 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-[#014181] flex items-center justify-center text-3xl mx-auto">
                  📋
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-700">
                  {searchTerm || statusFilter !== 'ALL'
                    ? 'Tidak ada data laporan yang cocok'
                    : 'Belum Ada Laporan Tersimpan'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== 'ALL'
                    ? 'Coba ganti kata kunci pencarian atau ubah filter status nasabah.'
                    : 'Mulai dokumentasikan aktivitas transaksi nasabah Anda melalui formulir input.'}
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode('form')}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#014181] to-[#0A5AA3] hover:from-[#002D5B] hover:to-[#014181] rounded-xl transition-all shadow-md active:scale-95 cursor-pointer inline-flex items-center gap-2 mt-2"
                >
                  <span>+ Input Laporan Sekarang</span>
                </button>
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
                  <span>📋 Lihat Laporan</span>
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
                    {message.type === 'error' ? '⚠️' : message.type === 'success' ? '✅' : 'ℹ️'}
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
                      {transactionLabel} <span className="text-red-500">*</span>
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
                      Rencana Tindak Lanjut (Follow-Up) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="followUp"
                      value={form.followUp}
                      onChange={updateField}
                      placeholder="Contoh: Jadwalkan akad kredit / ambil berkas"
                      required
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] text-slate-800 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

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
                        📷
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
                        <span>📤 Upload Laporan</span>
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
                <div className="flex items-center gap-2 mt-1">
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
                        {copiedId ? '✓ Tersalin' : '📋 Salin'}
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
                        💬 Chat WA
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
                  <p className="text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-orange-200/60 text-[#FF7401] font-semibold break-words">
                    {selectedDetailRecord.followUp || 'Tidak ada rencana tindak lanjut.'}
                  </p>
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
                        🔍 Klik untuk perbesar
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
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord({ ...selectedDetailRecord });
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <span>✏️</span>
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
                  <span>🗑️</span>
                  <span>Hapus</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#014181] hover:bg-[#0A5AA3] rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                Tutup
              </button>
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
                  <label className="block text-xs font-bold text-slate-700">{transactionLabel}</label>
                  <select
                    name="transactionType"
                    value={editingRecord.transactionType}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  >
                    {transactionOptions.map((opt) => (
                      <option value={opt} key={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Tindak Lanjut</label>
                  <input
                    type="text"
                    name="followUp"
                    value={editingRecord.followUp}
                    onChange={updateEditingField}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#014181]/20 text-slate-800"
                  />
                </div>
              </div>

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
                    <span>📷 Upload Foto Baru</span>
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