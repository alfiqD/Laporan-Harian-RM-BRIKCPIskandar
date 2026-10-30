import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar.jsx';
import ProfileModal from '../../components/ProfileModal.jsx';
import Icon from '../../components/Icon.jsx';
import {
  fetchActivitiesFromSupabase,
  formatActivityTime,
  getUserActivities,
  recordActivity,
  subscribeToActivities,
} from '../auth/activityLog.js';
import { countActiveTasks } from '../../services/tindakLanjut.js';

const menuItems = [
  {
    label: 'RMFT',
    description: 'Buat dan kelola laporan Funding & Transaksi.',
    icon: 'creditCard',
    page: 'rmft',
    reportPage: 'rmft?view=reports',
  },
  {
    label: 'RM Kredit',
    description: 'Buat dan kelola laporan layanan kredit.',
    icon: 'chart',
    page: 'rmkredit',
    reportPage: 'rmkredit?view=reports',
  },
];

export default function EmployeeDashboard({ user, onLogout, onUpdateUser, onNavigate }) {
  const [showProfile, setShowProfile] = useState(false);
  const [activities, setActivities] = useState(() => getUserActivities(user));
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    countActiveTasks(user).then((count) => {
      if (isMounted) setActiveTaskCount(count);
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    fetchActivitiesFromSupabase(user).then((items) => {
      if (isMounted && items) setActivities(items);
    });
    const unsubscribe = subscribeToActivities(user, async () => {
      const items = await fetchActivitiesFromSupabase(user);
      if (isMounted) setActivities(items);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const navigateTo = (page, label) => {
    recordActivity(user, 'Membuka menu', `Membuka menu ${label}`);
    onNavigate(page);
  };

  const handleLogout = () => {
    recordActivity(user, 'Logout', `${user.name} keluar dari aplikasi`);
    onLogout();
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#C9DCEF] pb-12 font-sans text-slate-800">
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#C9DCEF] via-[#A9C6E5] to-[#C9DCEF]" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar
          user={user}
          onLogout={handleLogout}
          onOpenProfile={() => {
            setShowProfile(true);
            recordActivity(user, 'Membuka profil', 'Melihat detail profil');
          }}
        />

        <div className="mx-auto max-w-4xl space-y-5 px-3.5 pt-4 sm:px-6 sm:pt-6">
          <section className="relative overflow-hidden rounded-2xl border border-blue-900/30 bg-gradient-to-br from-[#014181] via-[#002D5B] to-[#001D3D] p-5 text-white shadow-lg sm:rounded-3xl sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#FF7401]/25 blur-3xl" />
            <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">Dashboard Pegawai</p>
            <h1 className="relative mt-2 text-xl font-extrabold sm:text-3xl">
              Halo, {user?.name || 'Pegawai'}
            </h1>
            <p className="relative mt-2 max-w-xl text-xs leading-relaxed text-blue-100 sm:text-sm">
              Pilih layanan untuk membuat laporan atau meninjau laporan yang sudah tersimpan.
            </p>
          </section>

          <section aria-label="Menu laporan dan tindak lanjut" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {menuItems.map((item) => (
              <article
                key={item.page}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:rounded-3xl sm:p-5"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#014181]/5 text-[#014181]" aria-hidden="true">
                      <Icon name={item.icon} size={22} />
                    </span>
                    <div>
                      <h2 className="text-sm font-extrabold text-[#014181]">{item.label}</h2>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigateTo(item.page, item.label)}
                    className="rounded-xl bg-[#014181] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#0A5AA3]"
                  >
                    Buat Laporan
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo(item.reportPage, `Laporan ${item.label}`)}
                    className="rounded-xl border border-[#014181]/25 bg-blue-50 px-3 py-2.5 text-xs font-bold text-[#014181] transition hover:bg-blue-100"
                  >
                    Lihat Laporan
                  </button>
                </div>
              </article>
            ))}

            {/* KARTU MENU KHUSUS TINDAK LANJUT */}
            <article className="flex flex-col justify-between rounded-2xl border border-orange-200/80 bg-gradient-to-br from-white via-orange-50/30 to-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-[#FF7401]" aria-hidden="true">
                    <Icon name="target" size={22} />
                  </span>
                  {activeTaskCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold text-[#B34A02]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF7401]" />
                      {activeTaskCount} aktif
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-sm font-extrabold text-[#014181]">Tindak Lanjut</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Pantau dan kelola pekerjaan nasabah yang masih perlu ditindaklanjuti hingga tuntas.
                </p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => navigateTo('tindak-lanjut', 'Tindak Lanjut')}
                  className="w-full rounded-xl bg-[#FF7401] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#E56801] shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon name="target" size={15} />
                  <span>Buka Tindak Lanjut</span>
                  {activeTaskCount > 0 && (
                    <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-extrabold">
                      {activeTaskCount}
                    </span>
                  )}
                </button>
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#014181]">Riwayat Aktivitas Saya</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {activities.length} aktivitas tercatat untuk akun Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('activity', 'Riwayat Aktivitas Saya')}
                className="shrink-0 rounded-full border border-[#014181]/25 px-3 py-2 text-xs font-bold text-[#014181] transition hover:bg-blue-50"
              >
                Lihat Semua
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#014181]">{activity.action}</p>
                    <p className="truncate text-[11px] text-slate-500">{activity.detail}</p>
                  </div>
                  <time className="shrink-0 text-[10px] text-slate-500">
                    {formatActivityTime(activity.timestamp)}
                  </time>
                </div>
              ))}
              {!activities.length && (
                <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                  Belum ada aktivitas.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {notice && (
        <div role="status" className="fixed bottom-4 right-4 z-50 rounded-xl border-l-4 border-[#FF7401] bg-[#014181] px-4 py-3 text-xs font-semibold text-white shadow-lg">
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
            setNotice('Profil berhasil diperbarui.');
            return updatedUser;
          }}
        />
      )}
    </main>
  );
}
