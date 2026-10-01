import { useState } from 'react';
import { recordActivity } from '../pages/auth/activityLog.js';
import { updateUserProfile } from '../pages/auth/localAuth.js';

export default function ProfileModal({ user, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle || 'Relationship Manager');
  const [email, setEmail] = useState(user.email);
  const [photo, setPhoto] = useState(user.photo || '');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handlePhotoChange = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Pilih file gambar untuk foto profil.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Ukuran foto maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setMessage('');
    };
    reader.onerror = () => setMessage('Foto tidak dapat dibaca. Coba file lain.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const updatedUser = await updateUserProfile(user, {
        name,
        jobTitle,
        email,
        photo,
        newPassword,
      });
      recordActivity(
        updatedUser,
        'Perubahan profil',
        newPassword ? 'Memperbarui profil dan kata sandi' : 'Memperbarui informasi profil',
      );
      await onSave(updatedUser);
    } catch (error) {
      setMessage(error.message || 'Profil gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="profile-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <header className="profile-modal-header">
          <div>
            <p className="profile-modal-eyebrow">AKUN SAYA</p>
            <h2 id="profile-modal-title">Profil</h2>
          </div>
          <button
            className="profile-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Tutup profil"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="profile-modal-body">
            <aside className="profile-summary">
              <div className="profile-photo-frame">
                {photo ? (
                  <img src={photo} alt={`Foto profil ${name}`} />
                ) : (
                  <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              {isEditing && (
                <label className="photo-upload-button">
                  Pilih foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
              <div className="profile-role">
                <span>Role</span>
                <strong>{user.role || 'Admin'}</strong>
              </div>
            </aside>

            <div className="profile-fields">
              <label className="profile-field">
                <span>Nama</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  readOnly={!isEditing}
                  required
                />
              </label>
              <label className="profile-field">
                <span>Bidang kerja</span>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  readOnly={!isEditing}
                  required
                />
              </label>
              <label className="profile-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  readOnly={!isEditing}
                  required
                />
              </label>
              <label className="profile-field">
                <span>Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={isEditing ? 'Kosongkan jika tidak diubah' : '••••••••'}
                  autoComplete="new-password"
                  minLength={8}
                  readOnly={!isEditing}
                />
                {isEditing && (
                  <small>Password lama tidak ditampilkan. Isi hanya jika ingin menggantinya.</small>
                )}
              </label>
            </div>
          </div>

          {message && <p className="profile-modal-message" role="alert">{message}</p>}

          <footer className="profile-modal-actions">
            {isEditing ? (
              <>
                <button
                  className="profile-cancel-button"
                  type="button"
                  onClick={() => {
                    setName(user.name);
                    setJobTitle(user.jobTitle || 'Relationship Manager');
                    setEmail(user.email);
                    setPhoto(user.photo || '');
                    setNewPassword('');
                    setMessage('');
                    setIsEditing(false);
                  }}
                >
                  Batal
                </button>
                <button className="profile-save-button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Menyimpan...' : 'Simpan perubahan'}
                </button>
              </>
            ) : (
              <button
                className="profile-save-button"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Edit profil
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}