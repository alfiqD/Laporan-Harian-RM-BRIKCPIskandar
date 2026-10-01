import { useState } from 'react';
import { recordActivity } from '../auth/activityLog.js';
import './transaction-form.css';

const MAX_PHOTO_SIZE = 256 * 1024;
const MAX_SAVED_RECORDS = 5;

function getStorageKey(user, formType) {
  return `bri-app-records-${formType}-${user.id}`;
}

function readSavedRecords(user, formType) {
  try {
    const records = JSON.parse(localStorage.getItem(getStorageKey(user, formType)) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

const blankForm = {
  fullName: '',
  customerType: '',
  identityNumber: '',
  phone: '',
  address: '',
  transactionType: '',
  followUp: '',
  photo: '',
  photoName: '',
};

export default function TransactionForm({
  user,
  onBack,
  formType,
  title,
  transactionLabel,
  transactionOptions,
}) {
  const [form, setForm] = useState(blankForm);
  const [records, setRecords] = useState(() => readSavedRecords(user, formType));
  const [showReport, setShowReport] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage('');
  };

  const handlePhotoChange = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('File yang diunggah harus berupa gambar.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setMessage('Ukuran foto maksimal 256 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        photo: String(reader.result),
        photoName: file.name,
      }));
      setMessage('');
    };
    reader.onerror = () => setMessage('Foto tidak dapat dibaca. Coba file lain.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');

    const record = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    try {
      const nextRecords = [record, ...readSavedRecords(user, formType)]
        .slice(0, MAX_SAVED_RECORDS);
      localStorage.setItem(getStorageKey(user, formType), JSON.stringify(nextRecords));
      setRecords(nextRecords);
      recordActivity(user, `Simpan ${formType.toUpperCase()}`, `Menyimpan data ${title}`);
      setForm(blankForm);
      setMessage('Data berhasil disimpan.');
    } catch {
      setMessage('Data tidak dapat disimpan. Coba kurangi ukuran foto atau hapus sebagian data lama.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="transaction-page">
      <header className="transaction-header">
        <button className="transaction-back" type="button" onClick={onBack} aria-label="Kembali ke Home">
          <span aria-hidden="true">←</span>
        </button>
        <div className="transaction-user">
          <span className="transaction-user-avatar">
            {user.photo ? <img src={user.photo} alt="" /> : user.name.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.role || 'Admin'}</small>
          </span>
        </div>
      </header>

      <div className="transaction-content">
        <h1 className="transaction-title">{title}</h1>

        <form className="transaction-form" onSubmit={handleSubmit}>
          <label className="transaction-field">
            <span>Nama Lengkap</span>
            <input name="fullName" value={form.fullName} onChange={updateField} required />
          </label>

          <label className="transaction-field">
            <span>Nasabah / Non-Nasabah</span>
            <select name="customerType" value={form.customerType} onChange={updateField} required>
              <option value="" disabled>Pilih status nasabah</option>
              <option value="Nasabah">Nasabah</option>
              <option value="Non-Nasabah">Non-Nasabah</option>
            </select>
          </label>

          <label className="transaction-field">
            <span>{form.customerType === 'Non-Nasabah' ? 'No. NIK' : 'No. Rekening / No. NIK'}</span>
            <input
              name="identityNumber"
              value={form.identityNumber}
              onChange={updateField}
              inputMode="numeric"
              required
            />
          </label>

          <label className="transaction-field">
            <span>No. Hp</span>
            <input name="phone" type="tel" value={form.phone} onChange={updateField} required />
          </label>

          <label className="transaction-field">
            <span>Alamat</span>
            <input name="address" value={form.address} onChange={updateField} required />
          </label>

          <label className="transaction-field">
            <span>{transactionLabel}</span>
            <select name="transactionType" value={form.transactionType} onChange={updateField} required>
              <option value="" disabled>Pilih {transactionLabel.toLowerCase()}</option>
              {transactionOptions.map((option) => (
                <option value={option} key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="transaction-field">
            <span>Tindak Lanjut</span>
            <input name="followUp" value={form.followUp} onChange={updateField} required />
          </label>

          <label className="transaction-field">
            <span>Upload Foto</span>
            <span className="transaction-upload">
              {form.photo ? (
                <>
                  <img src={form.photo} alt="Pratinjau foto transaksi" />
                  <span>{form.photoName}</span>
                </>
              ) : (
                <span>Pilih foto dokumentasi</span>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </span>
          </label>

          {message && (
            <p className="transaction-message" role={message.startsWith('Data berhasil') ? 'status' : 'alert'}>
              {message}
            </p>
          )}

          <div className="transaction-actions">
            <button className="transaction-submit" type="submit" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Submit'}
            </button>
            <button className="transaction-report-button" type="button" onClick={() => setShowReport(true)}>
              Lihat Laporan
            </button>
          </div>
        </form>
      </div>

      {showReport && (
        <div
          className="transaction-report-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowReport(false);
          }}
        >
          <section className="transaction-report" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <header>
              <div>
                <p>RIWAYAT TERSIMPAN</p>
                <h2 id="report-title">Laporan {formType.toUpperCase()}</h2>
              </div>
              <button type="button" onClick={() => setShowReport(false)} aria-label="Tutup laporan">×</button>
            </header>
            {records.length === 0 ? (
              <p className="transaction-empty-report">Belum ada data yang disimpan.</p>
            ) : (
              <ul className="transaction-record-list">
                {records.map((savedRecord) => (
                  <li key={savedRecord.id}>
                    <div>
                      <strong>{savedRecord.fullName}</strong>
                      <span>{savedRecord.transactionType} · {savedRecord.customerType}</span>
                      <time dateTime={savedRecord.createdAt}>
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                          .format(new Date(savedRecord.createdAt))}
                      </time>
                    </div>
                    {savedRecord.photo && <img src={savedRecord.photo} alt="Dokumentasi transaksi" />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}