import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar.jsx';
import ProfileModal from '../../components/ProfileModal.jsx';
import { recordActivity } from '../auth/activityLog.js';
import { isAdminRole } from '../../config/rolesConfig.jsx';
import { supabase } from '../../config/supabaseClient.js';
import { countActiveTasks } from '../../services/tindakLanjut.js';

export default function AdminDashboard({ user, onLogout, onUpdateUser }) {
  const [showProfile, setShowProfile] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [adminStats, setAdminStats] = useState({ rmft: 0, rmkredit: 0 });
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [yearlyChartData, setYearlyChartData] = useState({});

  useEffect(() => {
    if (!isAdminRole(user?.role)) return undefined;

    let isMounted = true;
    async function loadAdminData() {
      const reportPages = await (async () => {
        const reports = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase
            .from('laporan_rm')
            .select('form_type, created_at')
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error) return { data: null, error };
          reports.push(...(data || []));
          if (!data || data.length < pageSize) return { data: reports, error: null };
        }
      })();

      if (!isMounted) return;
      if (reportPages.error) {
        console.warn('Gagal memuat ringkasan laporan admin:', reportPages.error.message);
      } else {
        const reports = reportPages.data || [];
        const chartData = {};
        reports.forEach((report) => {
          const date = new Date(report.created_at);
          if (Number.isNaN(date.getTime())) return;
          const year = date.getFullYear();
          chartData[year] ||= Array(12).fill(0);
          chartData[year][date.getMonth()] += 1;
        });
        setYearlyChartData(chartData);
        setAdminStats((current) => ({
          ...current,
          rmft: reports.filter((report) => report.form_type === 'rmft').length,
          rmkredit: reports.filter((report) => report.form_type === 'rmkredit').length,
        }));
      }   
    }

    loadAdminData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Jumlah tugas tindak lanjut yang masih aktif (seluruh RM untuk admin).
  useEffect(() => {
    if (!isAdminRole(user?.role)) return undefined;
    let isMounted = true;

    countActiveTasks(user).then((count) => {
      if (isMounted) setActiveTaskCount(count);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const currentChartValues = yearlyChartData[selectedYear] || Array(12).fill(0);
  const availableYears = [
    ...new Set([new Date().getFullYear(), ...Object.keys(yearlyChartData).map(Number)]),
  ].sort((first, second) => second - first);
  const maxChartValue = Math.max(1, ...currentChartValues);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#C9DCEF] font-sans text-slate-800">
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#C9DCEF] via-[#A9C6E5] to-[#C9DCEF]"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <Navbar
          user={user}
          onLogout={onLogout}
          onOpenProfile={() => {
            setShowProfile(true);
            recordActivity(user, 'Membuka profil', 'Melihat detail profil');
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl space-y-4 px-3.5 pb-8 pt-3 sm:space-y-6 sm:px-6 sm:pt-5">

          {/* ============ EXECUTIVE BANNER ============ */}
          <section id="admin-overview" className="relative overflow-hidden rounded-2xl border border-blue-900/30 bg-gradient-to-br from-[#014181] via-[#002D5B] to-[#001D3D] p-5 text-white shadow-lg sm:rounded-3xl sm:p-7">

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF7401]">
                  <span className="h-2 w-2 rounded-full bg-orange-300" />
                  <span className="text-orange-300">Pusat kendali administrator</span>
                </div>

                <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  Dashboard Admin
                </h1>

                <p className="max-w-lg text-xs leading-relaxed text-blue-100 sm:text-sm">
                  Ringkasan informasi dan perkembangan laporan bulanan.
                </p>
              </div>

            </div>
          </section>

          <section aria-label="Ringkasan laporan" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {[
              { label: 'Total Laporan', value: adminStats.rmft + adminStats.rmkredit },
              { label: 'Laporan RMFT', value: adminStats.rmft },
              { label: 'Laporan RM Kredit', value: adminStats.rmkredit },
              { label: 'Tugas Tindak Lanjut Aktif', value: activeTaskCount, href: '/tindak-lanjut' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </span>
                <strong className="mt-1 block text-2xl font-extrabold text-[#014181]">
                  {item.value}
                </strong>
                {item.href && (
                  <Link
                    to={item.href}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#B34A02] hover:underline"
                  >
                    Pantau tugas
                  </Link>
                )}
              </div>
            ))}
          </section>

          {/* ============ LAPORAN BULANAN ============ */}
          <section id="admin-chart" className="scroll-mt-5 relative space-y-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:p-6">

            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#014181] via-[#0A5AA3] to-[#FF7401]" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-[#014181] flex items-center gap-2">
                  <span className="w-1 h-4 rounded-sm bg-[#FF7401]" />
                Laporan Bulanan
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 pl-3">
                Jumlah laporan tercatat per bulan pada {selectedYear}
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
                    height: `${value ? Math.max(8, (value / maxChartValue) * 100) : 2}%`,
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
                    {value} laporan
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

    </main>
  );
}