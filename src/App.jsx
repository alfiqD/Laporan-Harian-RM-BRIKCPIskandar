import React, { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  touchAuthSession,
} from './pages/auth/localAuth.js';
import { isAdminRole } from './config/rolesConfig.jsx';
import { recordActivity } from './pages/auth/activityLog.js';

const Login = React.lazy(() => import('./pages/auth/login.jsx'));
const Registrasi = React.lazy(() => import('./pages/auth/registrasi.jsx'));
const Home = React.lazy(() => import('./pages/home.jsx'));
const ActivityHistoryPage = React.lazy(() => import('./pages/activity/ActivityHistoryPage.jsx'));
const EmployeeManagementPage = React.lazy(() => import('./pages/admin/EmployeeManagementPage.jsx'));
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout.jsx'));
const RMFT = React.lazy(() => import('./pages/RMFT/index.jsx'));
const RMKREDIT = React.lazy(() => import('./pages/RMKREDIT/index.jsx'));
const loadingFallback = (
  <div
    className="grid min-h-screen place-items-center text-sm text-slate-600"
    role="status"
  >
    Memuat halaman...
  </div>
);

const mascotImg = '/Img/maskot.png';
const briLogo = '/Img/bri-logo.png';

function AuthPage({
  isLogin,
  onLogin,
  onRegister,
  onShowLogin,
  onRegistered,
  registeredEmail,
  registrationNotice,
}) {
  return (
    <main className="auth-wrapper">
      <section className="glass-outer-card" aria-label="Autentikasi BRI">
        <div className="brand-panel">
          <img className="brand-logo" src={briLogo} alt="BRI" />
          <div className="brand-copy">
            <p className="brand-eyebrow">BRI DIGITAL</p>
            <h1>Lebih mudah, dalam satu akses.</h1>
            <p className="brand-description">
              Kelola kebutuhan perbankan Anda dengan pengalaman yang praktis
              dan nyaman.
            </p>
          </div>
          <img className="mascot-image" src={mascotImg} alt="Maskot BRI" />
          <span className="brand-caption">Melayani dengan setulus hati</span>
        </div>

        <section className="form-card" aria-labelledby="form-title">
          {isLogin ? (
            <Login
              initialEmail={registeredEmail}
              initialMessage={registrationNotice}
              onLogin={onLogin}
              onRegister={onRegister}
            />
          ) : (
            <Registrasi onLogin={onShowLogin} onRegistered={onRegistered} />
          )}
          <p className="security-note">Koneksi aman untuk kenyamanan Anda</p>
        </section>
      </section>
    </main>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [currentUser, setCurrentUser] = useState(loadAuthSession);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registrationNotice, setRegistrationNotice] = useState('');
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  const performLogout = () => {
    if (currentUser) {
      recordActivity(currentUser, 'Logout', `${currentUser.name} keluar dari aplikasi`);
    }
    clearAuthSession();
    setShowLogoutConfirmation(false);
    setCurrentUser(null);
    navigate('/login', { replace: true });
  };

  const requestLogout = () => {
    if (isAdminRole(currentUser?.role)) {
      setShowLogoutConfirmation(true);
      return;
    }
    performLogout();
  };

  useEffect(() => {
    if (!currentUser) return undefined;

    let lastTouchAt = 0;
    const touchSession = () => {
      const now = Date.now();
      if (now - lastTouchAt < 60_000) return;
      lastTouchAt = now;
      if (!touchAuthSession()) {
        setCurrentUser(null);
        navigate('/login', { replace: true });
      }
    };

    window.addEventListener('pointerdown', touchSession);
    window.addEventListener('keydown', touchSession);
    window.addEventListener('touchstart', touchSession);
    return () => {
      window.removeEventListener('pointerdown', touchSession);
      window.removeEventListener('keydown', touchSession);
      window.removeEventListener('touchstart', touchSession);
    };
  }, [currentUser, navigate]);

  const homePage = currentUser ? (
    <Home
      user={currentUser}
      onNavigate={(page) => navigate(`/${page}`)}
      onUpdateUser={(updatedUser) => {
        saveAuthSession(updatedUser);
        setCurrentUser(updatedUser);
        return updatedUser;
      }}
      onLogout={requestLogout}
    />
  ) : (
    <Navigate to="/login" replace />
  );

  const routes = (
    <Routes>
        <Route
          path="/"
          element={homePage}
        />
        <Route
          path="/activity"
          element={currentUser ? (
            <ActivityHistoryPage
              user={currentUser}
              onBack={() => navigate('/')}
              onLogout={requestLogout}
              onUpdateUser={(updatedUser) => {
                saveAuthSession(updatedUser);
                setCurrentUser(updatedUser);
                return updatedUser;
              }}
            />
          ) : (
            <Navigate to="/login" replace />
          )}
        />
        <Route
          path="/employees"
          element={currentUser ? (
            isAdminRole(currentUser.role) ? (
              <EmployeeManagementPage
                user={currentUser}
                onBack={() => navigate('/')}
                onLogout={requestLogout}
                onUpdateUser={(updatedUser) => {
                  saveAuthSession(updatedUser);
                  setCurrentUser(updatedUser);
                  return updatedUser;
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )}
        />
        <Route
          path="/login"
          element={currentUser ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage
              isLogin={isLogin}
              registeredEmail={registeredEmail}
              registrationNotice={registrationNotice}
              onLogin={(user) => {
                saveAuthSession(user);
                setCurrentUser(user);
                navigate('/', { replace: true });
              }}
              onRegister={() => {
                setRegistrationNotice('');
                setIsLogin(false);
              }}
              onShowLogin={() => setIsLogin(true)}
              onRegistered={(user) => {
                setRegisteredEmail(user.email);
                setRegistrationNotice('Registrasi berhasil. Silakan masuk dengan akun baru Anda.');
                setIsLogin(true);
              }}
            />
          )}
        />
        <Route
          path="/rmft"
          element={currentUser ? (
            <RMFT user={currentUser} onBack={() => navigate('/')} />
          ) : (
            <Navigate to="/login" replace />
          )}
        />
        <Route
          path="/rmkredit"
          element={currentUser ? (
            <RMKREDIT user={currentUser} onBack={() => navigate('/')} />
          ) : (
            <Navigate to="/login" replace />
          )}
        />
        <Route
          path="*"
          element={<Navigate to={currentUser ? '/' : '/login'} replace />}
        />
      </Routes>
  );

  return (
    <Suspense fallback={loadingFallback}>
      {currentUser && isAdminRole(currentUser.role) ? (
        <AdminLayout user={currentUser} onRequestLogout={requestLogout}>
          {routes}
        </AdminLayout>
      ) : routes}
      {showLogoutConfirmation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowLogoutConfirmation(false);
          }}
        >
          <section
            aria-labelledby="logout-confirmation-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            role="dialog"
          >
            <h2 id="logout-confirmation-title" className="text-base font-extrabold text-[#014181]">
              Konfirmasi Logout
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Apakah Anda yakin ingin keluar dari akun Admin?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmation(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={performLogout}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
              >
                Ya, Logout
              </button>
            </div>
          </section>
        </div>
      )}
    </Suspense>
  );
}