import React, { Suspense, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './pages/auth/localAuth.js';

const Login = React.lazy(() => import('./pages/auth/login.jsx'));
const Registrasi = React.lazy(() => import('./pages/auth/registrasi.jsx'));
const Home = React.lazy(() => import('./pages/home.jsx'));
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

  const homePage = currentUser ? (
    <Home
      user={currentUser}
      onNavigate={(page) => navigate(`/${page}`)}
      onUpdateUser={(updatedUser) => {
        saveAuthSession(updatedUser);
        setCurrentUser(updatedUser);
      }}
      onLogout={() => {
        clearAuthSession();
        setCurrentUser(null);
        navigate('/login', { replace: true });
      }}
    />
  ) : (
    <Navigate to="/login" replace />
  );

  return (
    <Suspense fallback={loadingFallback}>
      <Routes>
        <Route
          path="/"
          element={homePage}
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
    </Suspense>
  );
}