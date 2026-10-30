import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar.jsx';
import ProfileModal from '../../components/ProfileModal.jsx';
import Icon from '../../components/Icon.jsx';
import { isAdminRole } from '../../config/rolesConfig.jsx';
import {
  fetchTaskHistory,
  fetchTasks,
  formatJakartaDate,
  formatJakartaDateTime,
  maskIdentity,
  TASK_STATUS,
  TASK_STATUS_LABEL,
} from '../../services/tindakLanjut.js';

const FORM_TYPE_LABEL = {
  rmft: 'RMFT',
  rmkredit: 'RM Kredit',
};

const TAB_OPTIONS = [
  { value: TASK_STATUS.PENDING, label: 'Aktif' },
  { value: TASK_STATUS.DONE, label: 'Riwayat' },
];

function StatusChip({ status }) {
  const isPending = status !== TASK_STATUS.DONE;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
        isPending
          ? 'border-orange-200 bg-orange-50 text-[#B34A02]'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      <Icon name={isPending ? 'target' : 'check'} size={11} />
      {TASK_STATUS_LABEL[isPending ? 'pending' : 'done']}
    </span>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] font-semibold text-slate-500">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-[11px] font-semibold text-slate-700 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value || '-'}
      </span>
    </div>
  );
}

export default function TindakLanjutPage({ user, onBack, onLogout, onUpdateUser }) {
  const navigate = useNavigate();
  const isAdmin = isAdminRole(user?.role);

  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab] = useState(TASK_STATUS.PENDING);
  const [tasksByStatus, setTasksByStatus] = useState({ pending: [], done: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [notice, setNotice] = useState('');

  const [detailTask, setDetailTask] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setLoadError('');

    const [pendingResult, doneResult] = await Promise.all([
      fetchTasks(user, { status: TASK_STATUS.PENDING }),
      fetchTasks(user, { status: TASK_STATUS.DONE }),
    ]);

    if (pendingResult.error || doneResult.error) {
      console.error('Gagal memuat tugas tindak lanjut:', pendingResult.error || doneResult.error);
      setLoadError(
        'Daftar tindak lanjut belum dapat dimuat. Pastikan migration tindak-lanjut.sql sudah dijalankan dan koneksi tersedia.',
      );
    }

    setTasksByStatus({
      pending: pendingResult.data || [],
      done: doneResult.data || [],
    });
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    // Dijalankan asinkron agar tidak memicu cascading render saat mount.
    const run = async () => {
      await Promise.resolve();
      if (isMounted) loadTasks();
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const ownerOptions = useMemo(() => {
    if (!isAdmin) return [];
    const names = new Set();
    [...tasksByStatus.pending, ...tasksByStatus.done].forEach((task) => {
      if (task.userName) names.add(task.userName);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'id'));
  }, [isAdmin, tasksByStatus]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasksByStatus[tab].filter((task) => {
      const matchesFormType = formTypeFilter === 'all' || task.formType === formTypeFilter;
      const matchesOwner = ownerFilter === 'all' || task.userName === ownerFilter;
      const matchesSearch = !query
        || `${task.customerName} ${task.customerIdentity} ${task.activity} ${task.note} ${task.userName}`
          .toLowerCase()
          .includes(query);
      return matchesFormType && matchesOwner && matchesSearch;
    });
  }, [tasksByStatus, tab, search, formTypeFilter, ownerFilter]);

  const activeCount = tasksByStatus.pending.length;
  const doneCount = tasksByStatus.done.length;

  const openHistory = async (task) => {
    setDetailTask(task);
    setHistory([]);
    setHistoryError('');
    setIsLoadingHistory(true);

    const { data, error } = await fetchTaskHistory(task.id);
    if (error) {
      setHistoryError('Riwayat tugas belum dapat dimuat dari server.');
    }
    setHistory(data || []);
    setIsLoadingHistory(false);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#C9DCEF] font-sans text-slate-800">
      <div
        className="fixed inset-0 pointer-events-none bg-linear-to-b from-[#C9DCEF] via-[#A9C6E5] to-[#C9DCEF]"
        aria-hidden="true"
      />
      <div className="relative z-10">
        <Navbar
          user={user}
          onLogout={onLogout}
          onOpenProfile={() => setShowProfile(true)}
        />

        <div className="mx-auto max-w-6xl space-y-5 px-3.5 pb-10 pt-4 sm:px-6 sm:pt-6">
          {/* HERO */}
          <section className="flex flex-col gap-4 rounded-2xl border border-blue-900/30 bg-linear-to-br from-[#014181] via-[#002D5B] to-[#001D3D] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-7">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
                {isAdmin ? 'Pemantauan Tindak Lanjut' : 'Tugas Saya'}
              </p>
              <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">Tindak Lanjut</h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-blue-100 sm:text-sm">
                {isAdmin
                  ? 'Pantau tugas yang masih perlu ditindaklanjuti oleh seluruh RM beserta riwayat penyelesaiannya.'
                  : 'Daftar pekerjaan nasabah yang masih perlu ditindaklanjuti. Tugas otomatis ditutup setelah Anda menyimpan laporan berstatus Selesai.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-orange-200 ring-1 ring-white/15">
                  <Icon name="target" size={13} />
                  {activeCount} tugas aktif
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-blue-50 ring-1 ring-white/15">
                  <Icon name="check" size={13} />
                  {doneCount} selesai
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              <Icon name="arrowLeft" size={15} />
              Kembali ke Dashboard
            </button>
          </section>

          {/* FILTER */}
          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {TAB_OPTIONS.map((option) => {
                const isActive = tab === option.value;
                const count = option.value === TASK_STATUS.PENDING ? activeCount : doneCount;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTab(option.value)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      isActive
                        ? option.value === TASK_STATUS.PENDING
                          ? 'bg-[#FF7401] text-white shadow-sm'
                          : 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {option.label}
                    <span
                      className={`rounded-full px-1.5 text-[10px] ${
                        isActive ? 'bg-white/25' : 'bg-white text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {isAdmin && (
                <label className="space-y-1.5 text-xs font-bold text-slate-600">
                  Penanggung jawab
                  <select
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#014181]"
                  >
                    <option value="all">Semua RM</option>
                    {ownerOptions.map((name) => (
                      <option value={name} key={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Jenis laporan
                <select
                  value={formTypeFilter}
                  onChange={(event) => setFormTypeFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#014181]"
                >
                  <option value="all">Semua jenis</option>
                  <option value="rmft">RMFT</option>
                  <option value="rmkredit">RM Kredit</option>
                </select>
              </label>

              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Pencarian
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama nasabah, rekening, atau pekerjaan..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 placeholder:text-slate-400"
                />
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Menampilkan <strong className="text-[#014181]">{visibleTasks.length}</strong> dari{' '}
              <strong className="text-[#014181]">{tasksByStatus[tab].length}</strong>{' '}
              {tab === TASK_STATUS.PENDING ? 'tugas aktif' : 'tugas selesai'}.
            </p>
          </section>

          {loadError && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              role="alert"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={loadTasks}
                className="rounded-lg border border-amber-300 px-3 py-1.5 font-bold hover:bg-amber-100"
              >
                Muat ulang
              </button>
            </div>
          )}

          {/* DAFTAR TUGAS */}
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 text-center text-xs text-slate-500" role="status">
              Memuat daftar tindak lanjut...
            </div>
          ) : visibleTasks.length ? (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
              {visibleTasks.map((task) => {
                const isPending = task.status === TASK_STATUS.PENDING;
                return (
                  <article
                    key={task.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm transition hover:shadow-md"
                  >
                    <span
                      className={`block h-1.5 w-full ${
                        isPending
                          ? 'bg-gradient-to-r from-[#B34A02] via-[#FF7401] to-[#F7A95B]'
                          : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                      }`}
                      aria-hidden="true"
                    />

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-[#014181]/15 bg-[#014181]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#014181]">
                            {FORM_TYPE_LABEL[task.formType] || 'RM'}
                          </span>
                          {task.customerType && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              {task.customerType}
                            </span>
                          )}
                        </div>
                        <StatusChip status={task.status} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-extrabold text-[#014181]">
                          {task.customerName}
                        </h3>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                          {maskIdentity(task.customerIdentity)}
                        </p>
                      </div>

                      <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/90 p-2.5">
                        <InfoRow label="Pekerjaan" value={task.activity || '-'} />
                        <InfoRow
                          label="Tanggal laporan terakhir"
                          value={formatJakartaDate(task.lastReportAt)}
                        />
                        <InfoRow label="Penanggung jawab" value={task.userName} />
                      </div>

                      <div
                        className={`rounded-xl border p-2.5 ${
                          isPending
                            ? 'border-orange-200/70 bg-orange-50/80'
                            : 'border-emerald-200/70 bg-emerald-50/80'
                        }`}
                      >
                        <p
                          className={`text-[10px] font-extrabold uppercase tracking-wide ${
                            isPending ? 'text-[#B34A02]' : 'text-emerald-700'
                          }`}
                        >
                          Keterangan tindak lanjut
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-700 break-words">
                          {task.note
                            || (isPending
                              ? 'Belum ada keterangan tindak lanjut.'
                              : 'Tugas diselesaikan tanpa keterangan tambahan.')}
                        </p>
                      </div>

                      <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/${task.formType || 'rmft'}`, {
                                state: { prefillTask: task },
                              });
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FF7401] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#E56801] shadow-xs cursor-pointer"
                          >
                            <Icon name="edit" size={13} />
                            Lanjutkan Laporan
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openHistory(task)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#014181]/20 bg-blue-50 px-3 py-2 text-xs font-bold text-[#014181] transition hover:bg-blue-100 cursor-pointer"
                        >
                          <Icon name="clipboard" size={13} />
                          Riwayat Tugas
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#014181]">
                <Icon name={tab === TASK_STATUS.PENDING ? 'target' : 'check'} size={22} />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-700">
                {search || formTypeFilter !== 'all' || ownerFilter !== 'all'
                  ? 'Tidak ada tugas yang cocok'
                  : tab === TASK_STATUS.PENDING
                    ? 'Tidak ada tugas aktif'
                    : 'Belum ada tugas selesai'}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                {search || formTypeFilter !== 'all' || ownerFilter !== 'all'
                  ? 'Ubah kata kunci atau filter untuk melihat tugas lainnya.'
                  : tab === TASK_STATUS.PENDING
                    ? 'Semua pekerjaan sudah selesai. Tugas baru akan muncul saat laporan berstatus "Perlu tindak lanjut" disimpan.'
                    : 'Tugas yang sudah ditutup akan muncul di sini sebagai riwayat.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RIWAYAT TUGAS */}
      {detailTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailTask(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="h-1.5 shrink-0 bg-gradient-to-r from-[#014181] via-[#0A5AA3] to-[#FF7401]" />

            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-4 pb-3 sm:p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF7401]">
                  Riwayat Tindak Lanjut
                </p>
                <h2 className="mt-0.5 truncate text-base font-bold text-[#014181]">
                  {detailTask.customerName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusChip status={detailTask.status} />
                  <span className="rounded-full border border-[#014181]/15 bg-[#014181]/10 px-2 py-0.5 text-[10px] font-bold text-[#014181]">
                    {FORM_TYPE_LABEL[detailTask.formType] || 'RM'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailTask(null)}
                className="h-8 w-8 shrink-0 rounded-full bg-slate-100 text-lg font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <InfoRow label="Rekening / NIK" value={maskIdentity(detailTask.customerIdentity)} mono />
                <InfoRow label="Pekerjaan" value={detailTask.activity || '-'} />
                <InfoRow label="Penanggung jawab" value={detailTask.userName} />
                <InfoRow label="Laporan terakhir" value={formatJakartaDate(detailTask.lastReportAt)} />
                <InfoRow label="Dibuat pada" value={formatJakartaDateTime(detailTask.createdAt)} />
                {detailTask.closedAt && (
                  <InfoRow label="Ditutup pada" value={formatJakartaDateTime(detailTask.closedAt)} />
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-slate-700">Keterangan Saat Ini</p>
                <p className="rounded-xl border border-orange-200/60 bg-white p-2.5 text-xs leading-relaxed text-slate-700 break-words">
                  {detailTask.note || 'Belum ada keterangan.'}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-slate-700">Jejak Perubahan</p>
                {isLoadingHistory ? (
                  <p className="text-xs text-slate-500" role="status">
                    Memuat riwayat...
                  </p>
                ) : historyError ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {historyError}
                  </p>
                ) : history.length ? (
                  <ol className="space-y-1">
                    {history.map((item, index) => {
                      const isLast = index === history.length - 1;
                      return (
                        <li key={item.id} className="relative flex gap-3 rounded-xl px-1 py-2">
                          {!isLast && (
                            <span
                              className="absolute left-[15px] top-[34px] h-[calc(100%-22px)] w-px bg-slate-200"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                              item.action === 'closed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.action === 'created'
                                  ? 'bg-blue-100 text-[#014181]'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                            aria-hidden="true"
                          >
                            <Icon
                              name={
                                item.action === 'closed'
                                  ? 'check'
                                  : item.action === 'created'
                                    ? 'target'
                                    : 'edit'
                              }
                              size={14}
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-xs font-bold text-[#014181]">{item.actionLabel}</p>
                              {item.reportId && (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-[#014181]">
                                  Laporan Harian
                                </span>
                              )}
                              {item.statusAfter && (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                  {TASK_STATUS_LABEL[item.statusAfter]}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 break-words">
                              {item.note || '-'}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {item.userName} • {formatJakartaDateTime(item.createdAt)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Belum ada jejak perubahan tercatat.
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/90 p-3 px-4">
              <button
                type="button"
                onClick={() => setDetailTask(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="fixed bottom-4 right-4 left-4 z-60 rounded-xl border-l-4 border-[#FF7401] bg-[#014181] px-4 py-3 text-xs font-semibold text-white shadow-lg sm:left-auto sm:max-w-sm"
        >
          {notice}
        </div>
      )}

      {showProfile && onUpdateUser && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSave={async (changes) => {
            const updatedUser = await onUpdateUser(changes);
            setShowProfile(false);
            return updatedUser;
          }}
        />
      )}
    </main>
  );
}
