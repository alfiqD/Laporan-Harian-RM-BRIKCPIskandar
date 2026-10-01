import { useState } from 'react';

export default function Navbar({ user, onLogout, onOpenProfile }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full transition-all duration-300">
      {/* Garis Aksen Oranye BRI Paling Atas */}
      <div className="h-1 bg-[#FF7401] w-full" />

      {/* Container Header Menyatu Tanpa Bar Putih Kaku */}
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-3 flex items-center justify-between">
        
        {/* Logo Bank BRI Pill */}
        <div className="flex items-center justify-center h-12 sm:h-13 px-2 sm:px-3 rounded-full border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all">
          <img
            src="/Img/logo-bri.jpg"
            alt="Bank BRI"
            className="h-7 sm:h-9 w-auto object-contain mix-blend-multiply"
          />
        </div>

        {/* Profil Dropdown Pill */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center h-12 sm:h-13 gap-2 sm:gap-3 p-3 pr-5 rounded-full border border-slate-200/80 bg-white/70 hover:bg-white backdrop-blur-md transition-all shadow-sm active:scale-95"
             onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
          >
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#014181] text-white text-xs font-bold ring-2 ring-[#FF7401]/40 overflow-hidden shrink-0">
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt={user?.name || 'Foto Profil'}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                user?.name?.slice(0, 2).toUpperCase() || 'RM'
              )}
            </span>
            <div className="flex flex-col items-start text-left">
              <span className="text-xs font-bold text-[#014181] leading-tight max-w-[110px] sm:max-w-none truncate">
                {user?.name || 'Insan BRILiaN'}
              </span>
              <span className="text-[10px] font-semibold text-[#FF7401]">
                Insan BRILiaN
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180 text-[#FF7401]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Menu Dropdown Profil */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#014181] text-white text-xs font-bold ring-2 ring-[#FF7401]/40 overflow-hidden shrink-0">
                  {user?.photo ? (
                    <img
                      src={user.photo}
                      alt={user?.name || 'Foto'}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    user?.name?.slice(0, 2).toUpperCase() || 'RM'
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#014181] truncate">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.jobTitle || 'Relationship Manager'}</p>
                </div>
              </div>

              <button
                type="button"
                className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#014181] flex items-center gap-2"
                onClick={() => {
                  setProfileOpen(false);
                  onOpenProfile();
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF7401]" />
                Pengaturan Profil
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={onLogout}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Logout Aplikasi
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}