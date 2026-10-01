import { useState } from 'react';
import { recordActivity } from './activityLog.js';
import { authenticateUser } from './localAuth.js';

export default function Login({ initialEmail, initialMessage, onLogin, onRegister }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(initialMessage || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const user = await authenticateUser({ email, password });
      if (!user) {
        setMessage('Email atau kata sandi tidak sesuai.');
        return;
      }

      recordActivity(user, 'Login', `${user.name} berhasil masuk`);
      onLogin(user);
    } catch (error) {
      setMessage(error.message || 'Login gagal. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-heading">
        <p className="form-eyebrow">Selamat datang</p>
        <h2 className="form-title" id="form-title">Masuk ke akun</h2>
        <p className="form-description">
          Masukkan detail akun Anda untuk melanjutkan.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            className="form-input"
            id="login-email"
            name="email"
            type="email"
            placeholder="nama@email.com"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setMessage('');
            }}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">
            Kata sandi
          </label>
          <div className="input-container">
            <input
              className="form-input"
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setMessage('');
              }}
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </div>

        <div className="form-options">
          <label className="remember-option">
            <input type="checkbox" name="remember" />
            <span>Ingat saya</span>
          </label>
          <button
            className="forgot-password"
            type="button"
            onClick={() => setMessage('Fitur pemulihan kata sandi belum tersedia.')}
          >
            Lupa kata sandi?
          </button>
        </div>

        {message && <p className="form-message" role="status">{message}</p>}

        <button className="submit-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>

      <p className="form-footer">
        Belum memiliki akun?
        <button className="footer-link" type="button" onClick={onRegister}>
          Daftar sekarang
        </button>
      </p>
    </>
  );
}



