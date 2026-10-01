import { useEffect, useState } from 'react';
import {
  formatActivityTime,
  getUserActivities,
  recordActivity,
  subscribeToActivities,
} from '../auth/activityLog.js';
import heroImage from '../assets/hero.png';
import rmftImage from '../assets/rmft.png';
import reportImage from '../assets/tampilan-laporan.png';
import ProfileModal from './ProfileModal.jsx';
import './home.css';

const chartValues = [72, 58, 82, 48, 64, 38, 54, 28, 44, 66, 88, 72, 94, 78];
const menuItems = [
  { label: 'RMFT', image: rmftImage, page: 'rmft' },
  { label: 'RM KREDIT', icon: '▤', page: 'rmkredit' },
  { label: 'TAMPILAN LAPORAN', image: reportImage },
];

export default function Home({ user, onLogout, onUpdateUser, onNavigate }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notice, setNotice] = useState('');
  const [activities, setActivities] = useState(() => getUserActivities(user));

  useEffect(
    () => subscribeToActivities(() => setActivities(getUserActivities(user))),
    [user],
  );

  const selectMenu = (item) => {
    const { label, page } = item;
    recordActivity(user, 'Membuka menu', `Membuka menu ${label}`);
    setProfileOpen(false);
    if (page) {
      onNavigate(page);
      return;
    }

    setNotice(`${label} dipilih`);
  };

  const handleLogout = () => {
    recordActivity(user, 'Logout', `${user.name} keluar dari aplikasi`);
    onLogout();
  };

  return (
    <main className="home-page">
      <header className="home-header">
        <button
          className="home-back-button"
          type="button"
          onClick={handleLogout}
          aria-label="Kembali ke halaman login"
          title="Kembali ke login"
        >
          <span aria-hidden="true">←</span>
        </button>

        <div className="profile-menu-wrap">
          <button
            className="profile-trigger"
            type="button"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="profile-avatar" aria-hidden="true">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="profile-name">
              <strong>{user.name}</strong>
              <small>Admin</small>
            </span>
            <span className="profile-chevron" aria-hidden="true">⌄</span>
          </button>
          {profileOpen && (
            <div className="profile-dropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  setShowProfile(true);
                  recordActivity(user, 'Membuka profil', 'Melihat detail profil');
                }}
              >
                Profil
              </button>
              <button type="button" role="menuitem" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="home-content">
        <section className="welcome-panel" aria-labelledby="welcome-title">
          <img className="welcome-image" src={heroImage} alt="" />
          <div className="welcome-copy">
            <h1 id="welcome-title">
              Laporan Harian
              <br />
              Relationship Manager
              <br />
              Kunjungan ke Nasabah
            </h1>
            <p>
              Selamat datang, rekan insan BRILiaN! Kelola, tinjau, dan verifikasi
              seluruh rekapitulasi data kunjungan nasabah harian Anda secara
              akurat dan efisien di sini.
            </p>
          </div>
        </section>

        <section className="overview-chart" aria-label="Ringkasan aktivitas bulanan">
          <div className="chart-heading">
            <span>Aktivitas bulanan</span>
            <strong>2025</strong>
          </div>
          <div className="chart-plot" aria-hidden="true">
            <div className="chart-grid-lines" />
            <div className="chart-bars">
              {chartValues.map((value, index) => (
                <span
                  className="chart-bar"
                  key={`${value}-${index}`}
                  style={{ height: `${value}%` }}
                />
              ))}
            </div>
          </div>
          <div className="chart-months" aria-hidden="true">
            <span>Jan</span><span>Mar</span><span>Mei</span><span>Jul</span><span>Sep</span><span>Nov</span>
          </div>
        </section>

        <nav className="dashboard-menu" aria-label="Menu utama">
          {menuItems.map((item) => (
            <button
              className="dashboard-menu-item"
              key={item.label}
              type="button"
              onClick={() => selectMenu(item)}
            >
              <span className="menu-visual" aria-hidden="true">
                {item.image ? <img src={item.image} alt="" /> : item.icon}
              </span>
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {notice && (
          <p className="dashboard-notice" role="status">
            {notice}
          </p>
        )}

        <section className="activity-panel" aria-labelledby="activity-title">
          <div className="activity-heading">
            <h2 id="activity-title">Riwayat Aktivitas</h2>
            <button
              type="button"
              onClick={() => {
                setNotice('Riwayat aktivitas terbaru ditampilkan');
                recordActivity(user, 'Melihat riwayat', 'Melihat daftar riwayat aktivitas');
              }}
            >
              Lihat semua
            </button>
          </div>
          <ul className="activity-list">
            {activities.slice(0, 8).map((activity) => (
              <li className="activity-row" key={activity.id}>
                <span className="activity-marker" aria-hidden="true" />
                <span className="activity-description">
                  <strong>{activity.action}</strong>
                  <small>{activity.detail}</small>
                </span>
                <time dateTime={activity.timestamp}>{formatActivityTime(activity.timestamp)}</time>
              </li>
            ))}
          </ul>
          {activities.length === 0 && (
            <p className="activity-empty">Aktivitas Anda akan muncul di sini.</p>
          )}
        </section>
      </div>
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