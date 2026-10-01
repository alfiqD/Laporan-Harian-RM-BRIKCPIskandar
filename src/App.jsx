import { useState } from 'react';
import './Auth.css';

import mascotImg from './assets/maskot.png';
import briLogo from './assets/bri-logo.png';
import Login from './auth/login.jsx';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './auth/localAuth.js';
import Registrasi from './auth/registrasi.jsx';
import Home from './pages/home.jsx';
import RMFT from './pages/RMFT/index.jsx';
import RMKREDIT from './pages/RMKREDIT/index.jsx';

export default function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [currentUser, setCurrentUser] = useState(loadAuthSession);
  const [activePage, setActivePage] = useState('home');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registrationNotice, setRegistrationNotice] = useState('');

  if (currentUser) {
    const pageProps = {
      user: currentUser,
      onBack: () => setActivePage('home'),
    };

    if (activePage === 'rmft') return <RMFT {...pageProps} />;
    if (activePage === 'rmkredit') return <RMKREDIT {...pageProps} />;

    return (
      <Home
        user={currentUser}
        onNavigate={setActivePage}
        onUpdateUser={(updatedUser) => {
          saveAuthSession(updatedUser);
          setCurrentUser(updatedUser);
        }}
        onLogout={() => {
          clearAuthSession();
          setCurrentUser(null);
          setActivePage('home');
        }}
      />
    );
  }

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
              onLogin={(user) => {
                saveAuthSession(user);
                setCurrentUser(user);
                setActivePage('home');
              }}
              onRegister={() => {
                setRegistrationNotice('');
                setIsLogin(false);
              }}
            />
          ) : (
            <Registrasi
              onLogin={() => setIsLogin(true)}
              onRegistered={(user) => {
                setRegisteredEmail(user.email);
                setRegistrationNotice('Registrasi berhasil. Silakan masuk dengan akun baru Anda.');
                setIsLogin(true);
              }}
            />
          )}
          <p className="security-note">Koneksi aman untuk kenyamanan Anda</p>
        </section>
      </section>
    </main>
  );
}