import { Link, useLocation } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { recordActivity } from '../auth/activityLog.js';

const navigationItems = [
  { label: 'Dashboard', href: '/', icon: 'chart' },
  { label: 'Semua laporan', href: '/rmft?view=reports&scope=all', icon: 'clipboard' },
  { label: 'Pengelolaan pegawai', href: '/employees', icon: 'user' },
  { label: 'Aktivitas pengguna', href: '/activity', icon: 'activity' },
];

function isNavigationItemActive(item, pathname, search) {
  if (item.href === '/') return pathname === '/';
  if (item.href.startsWith('/rmft')) {
    return (pathname === '/rmft' || pathname === '/rmkredit')
      && new URLSearchParams(search).get('view') === 'reports';
  }
  return pathname === item.href;
}

export default function AdminLayout({ user, onRequestLogout, children }) {
  const location = useLocation();

  const navigateTo = (item) => {
    recordActivity(user, 'Membuka menu', `Membuka menu ${item.label}`);
  };

  return (
    <div className="min-h-screen bg-[#C9DCEF] lg:flex">
      <aside className="sticky top-0 z-40 bg-linear-to-b from-[#014181] via-[#002D5B] to-[#001D3D] text-white shadow-lg lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <Link
          to="/"
          onClick={() => navigateTo(navigationItems[0])}
          className="flex items-center gap-3 border-b border-white/10 px-4 py-3 lg:px-6 lg:py-6"
        >
          <img
            src="/Img/bri-logo.png"
            alt="BRI"
            className="h-9 w-auto rounded bg-white px-2 py-1 object-contain"
          />
          <span>
            <span className="block text-sm font-extrabold tracking-wide">BRI RELATIONSHIP</span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">
              Admin Console
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navigasi admin"
          className="flex gap-2 overflow-x-auto px-3 py-2.5 lg:flex-1 lg:flex-col lg:gap-1 lg:px-4 lg:py-6"
        >
          <p className="hidden px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300 lg:block">
            Workspace
          </p>
          {navigationItems.map((item) => {
            const isActive = isNavigationItemActive(item, location.pathname, location.search);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => navigateTo(item)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition lg:gap-3 lg:py-3 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon name={item.icon} size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5 lg:block lg:px-5 lg:py-4">
          <div className="hidden min-w-0 lg:mb-4 lg:block">
            <p className="truncate text-xs font-bold">{user?.name || 'Administrator'}</p>
            <p className="mt-1 text-[10px] text-blue-200">{user?.email || 'Administrator sistem'}</p>
          </div>
          <span className="min-w-0 truncate text-[11px] font-semibold text-blue-100 lg:hidden">
            {user?.name || 'Administrator'}
          </span>
          <button
            type="button"
            onClick={onRequestLogout}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-600 lg:w-full lg:py-2.5"
          >
            <Icon name="logout" size={16} />
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
