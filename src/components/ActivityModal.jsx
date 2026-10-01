import { useState, useMemo } from 'react';
import { formatActivityTime } from '../pages/auth/activityLog.js';

export default function ActivityModal({
  isOpen,
  onClose,
  activities = [],
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredActivities = useMemo(() => {
    if (!searchTerm.trim()) return activities;
    const query = searchTerm.toLowerCase();
    return activities.filter(
      (act) =>
        act.action?.toLowerCase().includes(query) ||
        act.detail?.toLowerCase().includes(query),
    );
  }, [activities, searchTerm]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getActionBadgeColor = (action = '') => {
    const act = action.toLowerCase();
    if (act.includes('login') || act.includes('masuk')) {
      return 'bg-emerald-500 shadow-emerald-500/30';
    }
    if (act.includes('logout') || act.includes('keluar')) {
      return 'bg-rose-500 shadow-rose-500/30';
    }
    if (act.includes('profil') || act.includes('password')) {
      return 'bg-[#FF7401] shadow-[#FF7401]/30';
    }
    return 'bg-[#014181] shadow-[#014181]/30';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] sm:max-h-[82vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#014181] via-[#0A5AA3] to-[#FF7401] shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[#FF7401]" />
              <p className="text-[10px] font-bold tracking-wider text-[#FF7401] uppercase">
                Log Sistem
              </p>
            </div>
            <h2
              id="activity-modal-title"
              className="text-base sm:text-lg font-bold text-[#014181] mt-0.5 flex items-center gap-2"
            >
              Riwayat Aktivitas
              <span className="text-[11px] font-semibold text-[#014181] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                {activities.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar seluruh aktivitas pengguna yang tercatat dalam aplikasi.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-[#014181] hover:bg-blue-50 border border-slate-200/80 rounded-full transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50"
                title="Segarkan Riwayat"
              >
                <span className={`inline-block ${isRefreshing ? 'animate-spin' : ''}`}>↻</span>
                <span className="hidden sm:inline text-[11px]">Segarkan</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all text-lg font-semibold active:scale-95"
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50/60 border-b border-slate-100 shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
              placeholder="Cari aktivitas, menu, atau catatan..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#014181]/20 focus:border-[#014181] transition-all text-slate-700 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modal Body - Activity List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 custom-scrollbar">
          {filteredActivities.length > 0 ? (
            filteredActivities.map((activity, idx) => (
              <div
                key={activity.id || idx}
                className="group flex items-start justify-between p-3 rounded-2xl bg-slate-50/80 border border-slate-100 hover:bg-blue-50/40 hover:border-blue-200/60 transition-all duration-200"
              >
                <div className="flex items-start gap-3 min-w-0 pr-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm ${getActionBadgeColor(
                      activity.action,
                    )}`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#014181] truncate">
                      {activity.action}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words line-clamp-2">
                      {activity.detail || '-'}
                    </p>
                  </div>
                </div>
                <time className="text-[10px] font-semibold text-[#014181] bg-white px-2.5 py-1 rounded-full border border-slate-200/80 shrink-0 shadow-2xs whitespace-nowrap mt-0.5">
                  {formatActivityTime(activity.timestamp)}
                </time>
              </div>
            ))
          ) : (
            <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-lg">
                📋
              </div>
              <p className="text-xs font-bold text-slate-500">
                {searchTerm ? 'Tidak ada hasil yang sesuai' : 'Belum ada aktivitas'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {searchTerm
                  ? 'Coba gunakan kata kunci pencarian yang lain.'
                  : 'Aktivitas yang Anda lakukan akan otomatis dicatat di sini.'}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 px-4 sm:px-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
            Menampilkan {filteredActivities.length} dari {activities.length} aktivitas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#014181] hover:bg-[#0A5AA3] rounded-xl transition-all active:scale-95 shadow-sm"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
