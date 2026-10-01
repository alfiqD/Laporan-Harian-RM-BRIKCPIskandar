import { useState } from 'react';
import { recordActivity } from './activityLog.js';
import { registerUser } from './localAuth.js';

export default function Registrasi({ onLogin, onRegistered }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Konfirmasi kata sandi belum cocok.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const user = await registerUser({ name: username, email, password });
      recordActivity(user, 'Registrasi', 'Akun berhasil dibuat');
      onRegistered(user);
    } catch (error) {
      setMessage(error.message || 'Registrasi gagal. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-heading">
        <p className="form-eyebrow">Selamat datang</p>
        <h2 className="form-title" id="form-title">Buat akun baru</h2>
        <p className="form-description">
          Lengkapi data berikut untuk mulai menggunakan layanan.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="register-name">Nama lengkap</label>
          <input
            className="form-input"
            id="register-name"
            name="username"
            type="text"
            placeholder="Masukkan nama lengkap"
            autoComplete="name"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-email">Email</label>
          <input
            className="form-input"
            id="register-email"
            name="email"
            type="email"
            placeholder="nama@email.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="register-password">
            Kata sandi
          </label>
          <div className="input-container">
            <input
              className="form-input"
              id="register-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Masukkan kata sandi"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

        <div className="form-group">
          <label className="form-label" htmlFor="register-confirm-password">
            Konfirmasi kata sandi
          </label>
          <div className="input-container">
            <input
              className="form-input"
              id="register-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Ulangi kata sandi"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'}
            >
              {showConfirmPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </div>

        {message && <p className="form-message" role="alert">{message}</p>}

        <button className="submit-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Daftar'}
        </button>
      </form>

      <p className="form-footer">
        Sudah memiliki akun?
        <button className="footer-link" type="button" onClick={onLogin}>
          Masuk
        </button>
      </p>
    </>
  );
}