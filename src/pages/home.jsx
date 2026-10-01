import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import ProfileModal from '../components/ProfileModal.jsx';
import ActivityModal from '../components/ActivityModal.jsx';
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
  const [showActivityModal, setShowActivityModal] = useState(false);
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
    <main className="relative min-h-screen font-sans text-slate-800 pb-12 overflow-x-hidden bg-[#C9DCEF]">

      {/* ============================================================
          BACKGROUND LAYER — Biru Lebih Kuat, Nuansa BRI
          ============================================================ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">

        {/* 1. Base Gradient — Biru Lebih Pekat */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#C9DCEF] via-[#A9C6E5] to-[#C9DCEF]" />

        {/* 3. Dot Pattern — Biru Tegas & Oranye */}
        <div
          className="absolute top-20 right-10 w-64 h-64 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(1, 65, 129, 0.35) 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div
          className="absolute bottom-32 left-10 w-56 h-56 opacity-50"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255, 116, 1, 0.4) 1.5px, transparent 1.5px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* 4. Blob Gradient — Biru BRI Lebih Kuat */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#014181]/40 blur-[120px]" />
        <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full bg-[#0A5AA3]/35 blur-[100px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#014181]/25 blur-[140px]" />

        {/* 5. Blob Gradient — Oranye BRI */}
        <div className="absolute -top-20 right-0 w-[500px] h-[500px] rounded-full bg-[#FF7401]/25 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[450px] h-[450px] rounded-full bg-[#FF7401]/20 blur-[110px]" />

        {/* 6. Radial Glow Biru Tambahan — Tengah Bawah */}
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[500px] rounded-full bg-[#0A5AA3]/30 blur-[130px]" />

      
        {/* 8. Wave Ornamen Bawah — Oranye Lebih Tegas */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-40 opacity-[0.13]"
          viewBox="0 0 1440 320"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            fill="#FF7401"
            d="M0,224L60,208C120,192,240,160,360,165.3C480,171,600,213,720,218.7C840,224,960,192,1080,181.3C1200,171,1320,181,1380,186.7L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
        </svg>

        {/* 9. Diagonal Accent Stripes — Kanan Atas Oranye */}
        <div
          className="absolute top-0 right-0 w-72 h-72 opacity-[0.18]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              135deg,
              #FF7401,
              #FF7401 2px,
              transparent 2px,
              transparent 14px
            )`,
            maskImage: 'linear-gradient(225deg, black, transparent 70%)',
            WebkitMaskImage: 'linear-gradient(225deg, black, transparent 70%)',
          }}
        />

        {/* 10. Diagonal Accent Stripes — Kiri Bawah Biru */}
        <div
          className="absolute bottom-0 left-0 w-72 h-72 opacity-[0.15]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              #014181,
              #014181 2px,
              transparent 2px,
              transparent 14px
            )`,
            maskImage: 'linear-gradient(45deg, black, transparent 70%)',
            WebkitMaskImage: 'linear-gradient(45deg, black, transparent 70%)',
          }}
        />

        {/* 11. Concentric Circles — Kanan Tengah */}
        <svg
          className="absolute top-1/4 -right-20 w-96 h-96 opacity-[0.12]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="95" stroke="#014181" strokeWidth="1" />
          <circle cx="100" cy="100" r="75" stroke="#014181" strokeWidth="1" />
          <circle cx="100" cy="100" r="55" stroke="#FF7401" strokeWidth="1" />
          <circle cx="100" cy="100" r="35" stroke="#FF7401" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="15" fill="#FF7401" fillOpacity="0.4" />
        </svg>

        {/* 12. Concentric Circles — Kiri Bawah */}
        <svg
          className="absolute bottom-1/4 -left-24 w-80 h-80 opacity-[0.12]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="95" stroke="#FF7401" strokeWidth="1" />
          <circle cx="100" cy="100" r="70" stroke="#014181" strokeWidth="1" />
          <circle cx="100" cy="100" r="45" stroke="#014181" strokeWidth="1.5" />
        </svg>

        {/* 13. Decorative Plus Signs */}
        <div className="absolute top-32 left-20 text-[#014181]/25 text-4xl font-thin select-none">+</div>
        <div className="absolute top-2/3 right-24 text-[#FF7401]/30 text-5xl font-thin select-none">+</div>
        <div className="absolute bottom-20 left-1/3 text-[#014181]/25 text-3xl font-thin select-none">+</div>

        {/* 14. Noise Texture */}
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-multiply"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E")`,
          }}
        />

        {/* 15. Top Fade */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/50 to-transparent" />
      </div>

      {/* ============================================================
          KONTEN UTAMA
          ============================================================ */}
      <div className="relative z-10">

        <Navbar
          user={user}
          onLogout={handleLogout}
          onOpenProfile={() => {
            setShowProfile(true);
            recordActivity(user, 'Membuka profil', 'Melihat detail profil');
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-3.5 sm:px-6 pt-2 sm:pt-4 space-y-4 sm:space-y-6">

          {/* ============ EXECUTIVE BANNER ============ */}
          <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#014181] via-[#002D5B] to-[#001D3D] text-white p-5 sm:p-8 shadow-[0_20px_50px_-15px_rgba(1,65,129,0.5)] border border-blue-900/30">

            <div className="absolute -top-16 -right-16 w-56 h-56 sm:w-72 sm:h-72 bg-[#FF7401]/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF7401] via-[#FF9B3D] to-transparent" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF7401] text-white text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shadow-lg shadow-orange-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Portal Resmi BRILiaN
                </div>

                <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-snug">
                  Laporan Harian <br />
                  <span className="text-[#FF7401] drop-shadow-[0_0_15px_rgba(255,116,1,0.4)]">
                    Relationship Manager
                  </span>
                </h1>

                <p className="text-slate-200 text-xs sm:text-sm leading-relaxed opacity-90 max-w-lg">
                  Kelola, tinjau, dan verifikasi seluruh rekapitulasi data kunjungan nasabah harian Anda secara akurat dan efisien.
                </p>
              </div>

              <div className="flex sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t border-white/10 sm:border-0 sm:pl-6 sm:border-l sm:border-white/15">
                <div className="flex-1 sm:flex-none bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[120px] hover:bg-white/15 transition-colors">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-blue-200 block uppercase tracking-wider">
                    Status Harian
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    Aktif
                  </span>
                </div>
                <div className="flex-1 sm:flex-none bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[120px] hover:bg-white/15 transition-colors">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-blue-200 block uppercase tracking-wider">
                    Target
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#fe4e13] mt-1 block">
                    100% On Track
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ============ MENU UTAMA ============ */}
          <nav className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => selectMenu(item)}
                className="group relative bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-5 text-center sm:text-left border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-[#014181]/15 hover:border-[#FF7401] hover:-translate-y-1 transition-all duration-300 active:scale-95 flex flex-col items-center sm:items-start justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF7401]/0 to-[#FF7401]/0 group-hover:from-[#FF7401]/5 group-hover:to-[#014181]/5 transition-all duration-300 pointer-events-none" />

                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#014181]/5 border border-[#014181]/10 flex items-center justify-center p-2 mb-2 group-hover:bg-[#014181] group-hover:scale-110 group-hover:rotate-[-4deg] transition-all duration-300 shadow-sm">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="w-full h-full object-contain filter group-hover:brightness-200 transition-all duration-300"
                    />
                  ) : (
                    <span className="text-lg sm:text-xl" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                </div>

                <div className="relative w-full">
                  <span className="hidden sm:inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mb-1.5 group-hover:bg-[#FF7401] group-hover:text-white transition-colors duration-300">
                    {item.tag}
                  </span>
                  <h3 className="text-[11px] sm:text-sm font-extrabold text-[#014181] group-hover:text-[#FF7401] transition-colors duration-300 leading-tight">
                    {item.label}
                  </h3>
                </div>
              </button>
            ))}
          </nav>

          {/* ============ CHART AKTIVITAS BULANAN ============ */}
          <section className="relative bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 space-y-4 overflow-hidden">

            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#014181] via-[#0A5AA3] to-[#FF7401]" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-[#014181] flex items-center gap-2">
                  <span className="w-1 h-4 rounded-sm bg-[#FF7401]" />
                  Aktivitas Bulanan
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 pl-3">
                  Rekapitulasi kunjungan {selectedYear}
                </p>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setYearDropdownOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#014181] hover:text-white text-[#014181] text-[11px] sm:text-xs font-bold rounded-xl border border-slate-200/90 shadow-sm transition-all active:scale-95 cursor-pointer"
                  aria-haspopup="true"
                  aria-expanded={yearDropdownOpen}
                >
                  <span>{selectedYear}</span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${yearDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {yearDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-28 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100 py-1 z-30">
                    {availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setSelectedYear(yr);
                          setYearDropdownOpen(false);
                          setNotice(`Tahun ${yr} dipilih`);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors ${selectedYear === yr
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

            <div className="h-32 sm:h-44 flex items-end justify-between gap-1 sm:gap-2 pt-2">
              {currentChartValues.map((value, index) => (
                <div
                  key={`${selectedYear}-${index}-${value}`}
                  className="group relative flex-1 rounded-t-md sm:rounded-t-lg transition-all duration-300 cursor-pointer overflow-visible"
                  style={{
                    height: `${value}%`,
                    background:
                      index % 4 === 0
                        ? 'linear-gradient(180deg, #0A5AA3 0%, #014181 100%)'
                        : index % 4 === 1
                          ? 'linear-gradient(180deg, #FF9B3D 0%, #FF7401 100%)'
                          : index % 4 === 2
                            ? 'linear-gradient(180deg, #4A9FD8 0%, #0A5AA3 100%)'
                            : 'linear-gradient(180deg, #FFB066 0%, #FF7401 100%)',
                  }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#014181] text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 group-hover:-top-9 transition-all pointer-events-none z-10 shadow-lg whitespace-nowrap">
                    {value} visit
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#014181] rotate-45" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-[10px] sm:text-xs font-semibold text-slate-400 border-t border-slate-100 pt-2 px-0.5">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>Mei</span><span>Jun</span>
              <span>Jul</span><span>Agu</span><span>Sep</span><span>Okt</span><span>Nov</span><span>Des</span>
            </div>
          </section>

          {/* ============ RIWAYAT AKTIVITAS ============ */}
          <section className="relative bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 overflow-hidden">

            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#014181] to-[#FF7401]" />

            <div className="flex items-center justify-between mb-4 pt-1">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-[#014181] flex items-center gap-2">
                  <span className="w-1 h-4 rounded-sm bg-[#FF7401]" />
                  Riwayat Aktivitas
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 pl-3">
                  {activities.length > 0
                    ? `${activities.length} aktivitas tercatat`
                    : 'Aktivitas sistem terbaru'}
                </p>
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 text-[11px] font-bold text-[#014181] bg-white border border-[#014181]/30 rounded-full hover:bg-[#014181] hover:text-white transition-all active:scale-95 cursor-pointer shadow-xs flex items-center gap-1.5"
                onClick={() => setShowActivityModal(true)}
              >
                <span>Lihat Semua</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {activities.length > 0 ? (
              <div className="space-y-2.5 max-h-64 sm:max-h-72 overflow-y-auto pr-1.5 custom-scrollbar">
                {activities.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-[#FF7401]/5 hover:border-[#FF7401]/30 hover:translate-x-1 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-br from-[#FF7401] to-[#014181] shrink-0 shadow-[0_0_8px_rgba(255,116,1,0.5)]" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#014181] truncate">
                          {activity.action}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                          {activity.detail}
                        </p>
                      </div>
                    </div>
                    <time className="text-[9px] sm:text-[10px] font-semibold text-[#014181] bg-white px-2 py-1 rounded-full border border-slate-200 shrink-0">
                      {formatActivityTime(activity.timestamp)}
                    </time>
                  </div>
                ))}

                {activities.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowActivityModal(true)}
                    className="w-full py-2 text-center text-xs font-semibold text-[#014181] hover:text-[#FF7401] hover:bg-slate-50 rounded-xl transition-colors border border-dashed border-slate-200 mt-1 cursor-pointer"
                  >
                    + {activities.length - 5} aktivitas lainnya — Klik untuk lihat semua
                  </button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400">Belum ada aktivitas.</p>
              </div>
            )}
          </section>

        </div>
      </div>

      {notice && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-gradient-to-r from-[#014181] to-[#0A5AA3] text-white px-4 py-3 rounded-xl shadow-2xl shadow-[#014181]/30 text-xs font-semibold z-50 flex items-center gap-2.5 border-l-4 border-[#FF7401]">
          <span className="w-2 h-2 rounded-full bg-[#FF7401] animate-ping" />
          <span>{notice}</span>
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

      {showActivityModal && (
        <ActivityModal
          isOpen={showActivityModal}
          onClose={() => setShowActivityModal(false)}
          activities={activities}
          onRefresh={async () => {
            const acts = await fetchActivitiesFromSupabase(user);
            setActivities(acts);
            setNotice('Riwayat aktivitas diperbarui');
          }}
        />
      )}
    </main>
  );
}