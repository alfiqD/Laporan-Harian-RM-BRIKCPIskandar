import { useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar.jsx';
import ProfileModal from '../../components/ProfileModal.jsx';
import Icon from '../../components/Icon.jsx';
import { isAdminRole } from '../../config/rolesConfig.jsx';
import { recordActivity } from '../auth/activityLog.js';
import { supabase } from '../../config/supabaseClient.js';

export default function EmployeeManagementPage({ user, onBack, onLogout, onUpdateUser }) {
  const [showProfile, setShowProfile] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatingProfileId, setUpdatingProfileId] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadProfiles() {
      try {
        const pageSize = 1000;
        const allProfiles = [];
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name, email, role')
            .order('name')
            .order('id')
            .range(offset, offset + pageSize - 1);
          if (error) throw error;
          allProfiles.push(...(data || []));
          if (!data || data.length < pageSize) break;
        }
        if (isMounted) {
          setProfiles(allProfiles);
          setLoadError('');
        }
      } catch (error) {
        console.error('Gagal memuat daftar pegawai:', error);
        if (isMounted) {
          setLoadError('Daftar pegawai belum dapat dimuat. Periksa koneksi dan coba muat ulang.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfiles();
    return () => {
      isMounted = false;
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) =>
      `${profile.name || ''} ${profile.email || ''} ${profile.role || ''}`.toLowerCase().includes(query),
    );
  }, [profiles, search]);

  const updateEmployeeRole = async (profile, role) => {
    if (!isAdminRole(user?.role) || profile.id === user.id || profile.role === role) return;

    setUpdatingProfileId(profile.id);
    setLoadError('');
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (error) {
      console.error('Gagal mengubah role pegawai:', error);
      setLoadError(`Role ${profile.name || profile.email} gagal diperbarui. ${error.message}`);
    } else {
      setProfiles((current) => current.map((item) => (
        item.id === profile.id ? { ...item, role } : item
      )));
      setNotice(`Role ${profile.name || profile.email} berhasil diperbarui.`);
      recordActivity(user, 'Mengubah role pegawai', `${profile.name || profile.email}: ${role}`);
    }
    setUpdatingProfileId('');
  };

  const handleLogout = () => {
    onLogout();
  };

  if (!isAdminRole(user?.role)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#C9DCEF] p-5">
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#014181]">Akses khusus Admin</h1>
          <p className="mt-2 text-sm text-slate-600">Halaman pengelolaan pegawai hanya dapat dibuka oleh Admin.</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 rounded-xl bg-[#014181] px-4 py-2 text-sm font-bold text-white"
          >
            Kembali
          </button>
        </section>
      </main>
    );
  }

  const employeeCount = profiles.filter((profile) => !isAdminRole(profile.role)).length;
  const adminCount = profiles.length - employeeCount;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#C9DCEF] font-sans text-slate-800">
      <div
        className="fixed inset-0 pointer-events-none bg-linear-to-b from-[#C9DCEF] via-[#A9C6E5] to-[#C9DCEF]"
        aria-hidden="true"
      />
      <div className="relative z-10">
        <Navbar
          user={user}
          onLogout={handleLogout}
          onOpenProfile={() => setShowProfile(true)}
        />

        <div className="mx-auto max-w-6xl space-y-5 px-3.5 pb-10 pt-4 sm:px-6 sm:pt-6">
          <section className="flex flex-col gap-4 rounded-2xl border border-blue-900/30 bg-linear-to-br from-[#014181] via-[#002D5B] to-[#001D3D] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">Administrasi</p>
              <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">Pengelolaan Pegawai</h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-blue-100 sm:text-sm">
                Lihat akun terdaftar dan atur hak akses Admin atau Pegawai.
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

          <section aria-label="Ringkasan akun" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Semua Akun', value: profiles.length },
              { label: 'Pegawai', value: employeeCount },
              { label: 'Admin', value: adminCount },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <strong className="mt-1 block text-2xl font-extrabold text-[#014181]">{item.value}</strong>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm sm:rounded-3xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-sm font-bold text-[#014181]">Daftar Akun</h2>
                <p className="mt-1 text-xs text-slate-500">Akun Anda sendiri tidak dapat diubah dari halaman ini.</p>
              </div>
              <label className="sr-only" htmlFor="employee-search">Cari pegawai</label>
              <input
                id="employee-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:max-w-xs"
              />
            </div>

            {loadError && (
              <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" role="alert">
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true);
                    setRefreshCount((count) => count + 1);
                  }}
                  className="rounded-lg border border-amber-300 px-3 py-1.5 font-bold hover:bg-amber-100"
                >
                  Muat ulang
                </button>
              </div>
            )}

            {isLoading ? (
              <p className="p-8 text-center text-xs text-slate-500" role="status">Memuat daftar akun...</p>
            ) : filteredProfiles.length ? (
              <div className="divide-y divide-slate-100">
                {filteredProfiles.map((profile) => (
                  <article
                    key={profile.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                        isAdminRole(profile.role) ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-[#014181]'
                      }`}>
                        <Icon name="user" size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {profile.name || 'Tanpa nama'}{profile.id === user.id ? ' (Anda)' : ''}
                        </p>
                        <p className="truncate text-xs text-slate-500">{profile.email || 'Email tidak tersedia'}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span>Role</span>
                      <select
                        aria-label={`Role untuk ${profile.name || profile.email}`}
                        value={isAdminRole(profile.role) ? 'Admin' : 'Pegawai'}
                        disabled={profile.id === user.id || updatingProfileId === profile.id}
                        onChange={(event) => updateEmployeeRole(profile, event.target.value)}
                        className="min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#014181] disabled:opacity-60"
                      >
                        <option value="Pegawai">Pegawai</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-xs text-slate-500">
                {profiles.length ? 'Tidak ada akun yang cocok dengan pencarian.' : 'Belum ada akun terdaftar.'}
              </p>
            )}
          </section>
        </div>
      </div>

      {notice && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border-l-4 border-[#FF7401] bg-[#014181] px-4 py-3 text-xs font-semibold text-white shadow-lg" role="status">
          {notice}
        </div>
      )}

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
