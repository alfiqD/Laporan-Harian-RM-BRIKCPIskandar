import { useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar.jsx';
import ProfileModal from '../../components/ProfileModal.jsx';
import Icon from '../../components/Icon.jsx';
import { formatActivityTime } from '../auth/activityLog.js';
import { isAdminRole } from '../../config/rolesConfig.jsx';
import { supabase } from '../../config/supabaseClient.js';

function getActivityCategory(activity) {
  const text = `${activity.action || ''} ${activity.detail || ''}`;
  if (/\brm\s*kredit\b|\brmkredit\b|\bkredit\b/i.test(text)) return 'rmkredit';
  if (/\brmft\b|funding|transaksi/i.test(text)) return 'rmft';
  return 'system';
}

export default function ActivityHistoryPage({ user, onBack, onLogout, onUpdateUser }) {
  const isAdmin = isAdminRole(user?.role);
  const [showProfile, setShowProfile] = useState(false);
  const [activities, setActivities] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      setIsLoading(true);
      setLoadError('');

      try {
        const pageSize = 1000;
        const allActivities = [];
        for (let offset = 0; ; offset += pageSize) {
          let query = supabase
            .from('aktivitas_log')
            .select('id, user_id, user_name, action, detail, created_at')
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (!isAdmin) query = query.eq('user_id', user.id);

          const { data, error } = await query;
          if (error) throw error;
          allActivities.push(...(data || []));
          if (!data || data.length < pageSize) break;
        }

        let roles = {};
        if (isAdmin) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, role')
            .order('id');
          if (error) throw error;
          roles = Object.fromEntries((data || []).map((profile) => [profile.id, profile.role]));
        } else {
          roles[user.id] = user.role;
        }

        if (isMounted) {
          setActivities(allActivities.map((activity) => ({
            id: activity.id,
            userId: activity.user_id,
            userName: activity.user_name || 'Pengguna',
            userRole: roles[activity.user_id] || 'Tidak diketahui',
            action: activity.action || 'Aktivitas',
            detail: activity.detail || '',
            timestamp: activity.created_at,
            category: getActivityCategory(activity),
          })));
        }
      } catch (error) {
        console.error('Gagal memuat halaman riwayat aktivitas:', error);
        if (isMounted) setLoadError('Riwayat aktivitas belum dapat dimuat dari server. Periksa koneksi dan coba lagi.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isAdmin, user]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activities.filter((activity) => {
      const matchesRole = roleFilter === 'all'
        || (roleFilter === 'admin'
          ? isAdminRole(activity.userRole)
          : activity.userRole.toLowerCase() === 'pegawai');
      const matchesCategory = categoryFilter === 'all' || activity.category === categoryFilter;
      const matchesSearch = !query
        || `${activity.userName} ${activity.action} ${activity.detail}`.toLowerCase().includes(query);
      return matchesRole && matchesCategory && matchesSearch;
    });
  }, [activities, roleFilter, categoryFilter, search]);

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
          <section className="flex flex-col gap-4 rounded-2xl border border-blue-900/30 bg-linear-to-br from-[#014181] via-[#002D5B] to-[#001D3D] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
                {isAdmin ? 'Pemantauan Sistem' : 'Aktivitas Akun'}
              </p>
              <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">
                {isAdmin ? 'Riwayat Aktivitas Pengguna' : 'Riwayat Aktivitas Saya'}
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-blue-100 sm:text-sm">
                {isAdmin
                  ? 'Telusuri aktivitas Admin dan Pegawai, serta bedakan kegiatan RMFT dan RM Kredit.'
                  : 'Lihat aktivitas akun Anda dan pilah berdasarkan jenis layanan.'}
              </p>
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

          <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'sm:grid-cols-2' : ''}`}>
              {isAdmin && (
                <label className="space-y-1.5 text-xs font-bold text-slate-600">
                  Peran pengguna
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#014181]"
                  >
                    <option value="all">Semua peran</option>
                    <option value="admin">Admin</option>
                    <option value="employee">Pegawai</option>
                  </select>
                </label>
              )}
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Jenis aktivitas
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#014181]"
                >
                  <option value="all">Semua aktivitas</option>
                  <option value="rmft">RMFT</option>
                  <option value="rmkredit">RM Kredit</option>
                  <option value="system">Aktivitas akun/sistem</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5 text-xs font-bold text-slate-600">
              Pencarian
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama pengguna, aktivitas, atau keterangan..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 placeholder:text-slate-400"
              />
            </label>
            <p className="text-xs text-slate-500">
              Menampilkan <strong className="text-[#014181]">{filteredActivities.length}</strong> dari{' '}
              <strong className="text-[#014181]">{activities.length}</strong> aktivitas.
            </p>
          </section>

          {loadError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="alert">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-amber-300 px-3 py-1.5 font-bold hover:bg-amber-100"
              >
                Muat ulang
              </button>
            </div>
          )}

          <section aria-label="Daftar riwayat aktivitas" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm sm:rounded-3xl">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-bold text-[#014181]">Daftar Aktivitas</h2>
            </div>
            {isLoading ? (
              <p className="p-8 text-center text-xs text-slate-500" role="status">Memuat riwayat aktivitas...</p>
            ) : filteredActivities.length ? (
              <div className="divide-y divide-slate-100">
                {filteredActivities.map((activity) => (
                  <article key={activity.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="flex min-w-0 gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF7401]" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-bold text-[#014181]">{activity.action}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isAdminRole(activity.userRole)
                              ? 'bg-violet-50 text-violet-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {activity.userRole}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            activity.category === 'rmft'
                              ? 'bg-emerald-50 text-emerald-700'
                              : activity.category === 'rmkredit'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {activity.category === 'rmft'
                              ? 'RMFT'
                              : activity.category === 'rmkredit'
                                ? 'RM Kredit'
                                : 'Sistem'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          {activity.userName}
                        </p>
                        {activity.detail && (
                          <p className="mt-1 wrap-break-word text-xs leading-relaxed text-slate-500">
                            {activity.detail}
                          </p>
                        )}
                      </div>
                    </div>
                    <time className="shrink-0 pl-5 text-[10px] font-medium text-slate-400 sm:pl-0">
                      {formatActivityTime(activity.timestamp)}
                    </time>
                  </article>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-xs text-slate-500">
                {activities.length ? 'Tidak ada aktivitas yang cocok dengan filter.' : 'Belum ada riwayat aktivitas.'}
              </p>
            )}
          </section>
        </div>
      </div>

      {showProfile && (
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
