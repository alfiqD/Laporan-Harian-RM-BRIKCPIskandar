import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx'; // Sesuaikan path lokasi Navbar.jsx
import ProfileModal from '../components/ProfileModal.jsx';
import {
  fetchActivitiesFromSupabase,
  formatActivityTime,
  getUserActivities,
  recordActivity,
  subscribeToActivities,
} from './auth/activityLog.js';

const rmftImage = '/Img/rmft.png';
const reportImage = '/Img/tampilan-laporan.png';

const yearlyChartData = {
  2026: [65, 58, 82, 70, 85, 90, 75, 88, 92, 80, 95, 89],
  2025: [65, 52, 80, 45, 60, 35, 50, 68, 85, 70, 92, 78],
  2024: [50, 42, 65, 55, 48, 62, 70, 60, 75, 68, 74, 80],
  2023: [40, 35, 50, 48, 55, 42, 45, 52, 60, 58, 65, 70],
};
const availableYears = [2026, 2025, 2024, 2023];

const menuItems = [
  { label: 'RMFT', image: rmftImage, page: 'rmft', tag: 'Funding' },
  { label: 'RM KREDIT', icon: '📊', page: 'rmkredit', tag: 'Lending' },
  { label: 'LAPORAN', image: reportImage, tag: 'Summary' },
];

export default function Home({ user, onLogout, onUpdateUser, onNavigate }) {
  const [showProfile, setShowProfile] = useState(false);
  const [notice, setNotice] = useState('');
  const [activities, setActivities] = useState(() => getUserActivities(user));
  const [selectedYear, setSelectedYear] = useState(2026);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  useEffect(() => {
    fetchActivitiesFromSupabase(user).then((acts) => {
      if (acts && acts.length > 0) setActivities(acts);
    });

    return subscribeToActivities(user, async () => {
      const acts = await fetchActivitiesFromSupabase(user);
      setActivities(acts);
    });
  }, [user]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const selectMenu = (item) => {
    const { label, page } = item;
    recordActivity(user, 'Membuka menu', `Membuka menu ${label}`);
    if (page) {
      onNavigate(page);
      return;
    }
    setNotice(`Menu ${label} dipilih`);
  };

  const handleLogout = () => {
    recordActivity(user, 'Logout', `${user.name} keluar dari aplikasi`);
    onLogout();
  };

  const currentChartValues = yearlyChartData[selectedYear] || yearlyChartData[2026];

  return (
    /* Background Utama: Gradasi Soft Slate Blue dengan Ambient Glow BRI */
    <main className="relative min-h-screen bg-gradient-to-b from-[#EEF2F6] via-[#E6EEF5] to-[#EEF2F6] font-sans text-slate-800 pb-12 overflow-x-hidden">
      
      {/* Pendaran Ambient Glow Latar Belakang (Samar & Menyatu) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#014181]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[#FF7401]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Komponen Terpisah */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenProfile={() => {
          setShowProfile(true);
          recordActivity(user, 'Membuka profil', 'Melihat detail profil');
        }}
      />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 sm:pt-4 space-y-4 sm:space-y-6">

        {/* Executive Banner Widget */}
        <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#014181] via-[#002D5B] to-[#001D3D] text-white p-5 sm:p-8 shadow-md border border-blue-900/20">
          <div className="absolute -top-12 -right-12 w-48 h-48 sm:w-64 sm:h-64 bg-[#FF7401]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF7401] text-white text-[10px] sm:text-[11px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Portal Resmi BRILiaN
              </div>

              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-snug">
                Laporan Harian <br />
                <span className="text-[#FF7401]">Relationship Manager</span>
              </h1>

              <p className="text-slate-200 text-xs sm:text-sm leading-relaxed opacity-90 max-w-lg">
                Kelola, tinjau, dan verifikasi seluruh rekapitulasi data kunjungan nasabah harian Anda secara akurat dan efisien.
              </p>
            </div>

            {/* Metrics Badge */}
            <div className="flex sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t border-white/10 sm:border-0">
              <div className="flex-1 sm:flex-none bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-2.5 sm:p-3 min-w-[110px]">
                <span className="text-[9px] sm:text-[10px] font-medium text-blue-200 block uppercase">Status Harian</span>
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Aktif
                </span>
              </div>
              <div className="flex-1 sm:flex-none bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-2.5 sm:p-3 min-w-[110px]">
                <span className="text-[9px] sm:text-[10px] font-medium text-blue-200 block uppercase">Target</span>
                <span className="text-xs sm:text-sm font-bold text-[#FF7401] mt-0.5 block">100% On Track</span>
              </div>
            </div>
          </div>
        </section>

        {/* Menu Utama (3 Kolom Sejajar) */}
        <nav className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => selectMenu(item)}
              className="group bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-5 text-center sm:text-left border border-slate-200/70 shadow-sm hover:shadow-md hover:border-[#014181] hover:bg-white transition-all active:scale-95 flex flex-col items-center sm:items-start justify-between"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#014181]/5 border border-[#014181]/10 flex items-center justify-center p-2 mb-2 group-hover:bg-[#014181] group-hover:text-white transition-colors">
                {item.image ? (
                  <img src={item.image} alt="" className="w-full h-full object-contain filter group-hover:brightness-200 transition-all" />
                ) : (
                  <span className="text-lg sm:text-xl" aria-hidden="true">{item.icon}</span>
                )}
              </div>

              <div className="w-full">
                <span className="hidden sm:inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mb-1 group-hover:bg-[#FF7401] group-hover:text-white transition-colors">
                  {item.tag}
                </span>
                <h3 className="text-[11px] sm:text-xs font-extrabold text-[#014181] group-hover:text-[#FF7401] transition-colors leading-tight">
                  {item.label}
                </h3>
              </div>
            </button>
          ))}
        </nav>

        {/* Grafik Aktivitas Bulanan */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/70 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#014181] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FF7401]" />
                Aktivitas Bulanan
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Rekapitulasi kunjungan {selectedYear}
              </p>
            </div>

            {/* Pemilih Tahun Interaktif */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setYearDropdownOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-[#014181] text-[11px] sm:text-xs font-bold rounded-xl border border-slate-200/90 shadow-sm transition-all active:scale-95 cursor-pointer"
                aria-haspopup="true"
                aria-expanded={yearDropdownOpen}
              >
                <span>{selectedYear}</span>
                <svg
                  className={`w-3.5 h-3.5 text-[#014181] transition-transform duration-200 ${yearDropdownOpen ? 'rotate-180 text-[#FF7401]' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {yearDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-28 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-slate-100 py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                  {availableYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setSelectedYear(yr);
                        setYearDropdownOpen(false);
                        setNotice(`Tahun ${yr} dipilih`);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors ${
                        selectedYear === yr
                          ? 'bg-[#014181]/10 text-[#014181]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-[#014181]'
                      }`}
                    >
                      <span>{yr}</span>
                      {selectedYear === yr && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF7401]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="h-32 sm:h-40 flex items-end justify-between gap-1 sm:gap-2 pt-2">
            {currentChartValues.map((value, index) => (
              <div
                key={`${selectedYear}-${index}-${value}`}
                className="w-full bg-[#014181]/15 hover:bg-[#FF7401] rounded-t-md sm:rounded-t-lg transition-all duration-300 relative group cursor-pointer"
                style={{ height: `${value}%` }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#014181] text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-sm">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[10px] sm:text-xs font-semibold text-slate-400 border-t border-slate-100 pt-2 px-0.5">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>Mei</span><span>Jun</span>
            <span>Jul</span><span>Agu</span><span>Sep</span><span>Okt</span><span>Nov</span><span>Des</span>
          </div>
        </section>

        {/* Riwayat Aktivitas - Scrollable */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#014181]">Riwayat Aktivitas</h2>
              <p className="text-[10px] sm:text-xs text-slate-400">
                {activities.length > 0 ? `${activities.length} aktivitas tercatat` : 'Aktivitas sistem terbaru'}
              </p>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 text-[11px] font-bold text-[#014181] bg-slate-50 border border-slate-200 rounded-lg hover:bg-[#014181] hover:text-white transition-all active:scale-95 cursor-pointer"
              onClick={async () => {
                setNotice('Memperbarui riwayat...');
                const acts = await fetchActivitiesFromSupabase(user);
                setActivities(acts);
                setNotice('Riwayat diperbarui');
                recordActivity(user, 'Refresh riwayat', 'Memperbarui daftar aktivitas');
              }}
            >
              Refresh
            </button>
          </div>

          {activities.length > 0 ? (
            <div className="space-y-2.5 max-h-64 sm:max-h-72 overflow-y-auto pr-1.5 custom-scrollbar">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF7401] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#014181] truncate">{activity.action}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 truncate">{activity.detail}</p>
                    </div>
                  </div>
                  <time className="text-[9px] sm:text-[10px] font-semibold text-slate-400 bg-white/90 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    {formatActivityTime(activity.timestamp)}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400">Belum ada aktivitas.</p>
            </div>
          )}
        </section>

      </div>

      {/* Floating Toast Notification */}
      {notice && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto bg-[#014181] text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold z-50 flex items-center gap-2 border-l-4 border-[#FF7401]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF7401] animate-ping" />
          <span>{notice}</span>
        </div>
      )}

      {/* Profile Modal */}
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