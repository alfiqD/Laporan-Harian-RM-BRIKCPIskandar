# Panduan Sistem — Aplikasi Laporan Harian RM BRI KC Iskandar

> Aplikasi web untuk pengelolaan **laporan harian Relationship Manager (RM)** di lingkungan BRI,
> mencakup laporan **RMFT** (Funding & Transaksi) dan **RMKredit** (Layanan Kredit),
> dengan sistem role (Pegawai/Admin), log aktivitas, dan sinkronisasi cloud Supabase.

---

## 1. Teknologi yang Digunakan

| Teknologi | Fungsi | Versi |
|---|---|---|
| **React** | Library UI utama | 19.2 |
| **Vite** | Build tool & dev server | 8.3 |
| **React Router DOM** | Routing & navigasi halaman | 7.18 |
| **Tailwind CSS 4** | Styling (utilitas + custom CSS) | 4.3 |
| **Supabase** | Database, Auth, Realtime | supabase-js 2.117 |

Perintah penting:

```bash
npm run dev      # jalankan mode pengembangan
npm run build    # build produksi ke folder dist/
npm run preview  # pratinjau hasil build
npm run lint     # cek eslint
```

---

## 2. Struktur Folder

```
Laporan-Harian-RM-BRIKCPIskandar/
├── public/Img/                    # Aset gambar (logo BRI, maskot, background)
├── src/
│   ├── main.jsx                   # Entry point React + BrowserRouter
│   ├── App.jsx                    # Root: routing, guard auth, sync profil, logout
│   ├── index.css / App.css        # Gaya global (auth page, modal, dll)
│   ├── assets/tailwind.css        # Import Tailwind
│   ├── config/
│   │   ├── supabaseClient.js      # Inisialisasi koneksi Supabase
│   │   └── rolesConfig.jsx        # Definisi role (Pegawai/Admin) + isAdminRole()
│   ├── components/
│   │   ├── TransactionForm.jsx    # Komponen inti: form + daftar laporan (CRUD)
│   │   ├── Navbar.jsx             # Header + dropdown profil
│   │   ├── ProfileModal.jsx       # Modal lihat/edit profil & ganti password
│   │   ├── ActivityModal.jsx      # Modal riwayat aktivitas dengan pencarian
│   │   └── Icon.jsx               # Kumpulan ikon SVG inline
│   ├── layouts/                   # (Tidak dipakai — dead code, lihat catatan §9)
│   └── pages/
│       ├── home.jsx               # Router peran: AdminDashboard vs EmployeeDashboard
│       ├── auth/
│       │   ├── login.jsx          # Form login
│       │   ├── registrasi.jsx     # Form daftar akun baru
│       │   ├── localAuth.js       # Logika auth (Supabase + fallback lokal)
│       │   └── activityLog.js     # Pencatatan & pengambilan aktivitas
│       ├── dashboard/
│       │   ├── EmployeeDashboard.jsx  # Dashboard pegawai
│       │   └── AdminDashboard.jsx     # Dashboard admin (statistik + grafik)
│       ├── admin/
│       │   ├── AdminLayout.jsx            # Sidebar console admin
│       │   └── EmployeeManagementPage.jsx # Kelola role pegawai
│       ├── activity/ActivityHistoryPage.jsx # Halaman riwayat aktivitas
│       ├── RMFT/index.jsx         # Pembungkus TransactionForm (formType=rmft)
│       └── RMKREDIT/index.jsx     # Pembungkus TransactionForm (formType=rmkredit)
├── supabase/role-access.sql       # Skema keamanan database (RLS + trigger)
└── .env                           # VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
```

---

## 3. Sistem Peran (Role & Hak Akses)

| Hak Akses | Pegawai | Admin |
|---|:---:|:---:|
| Membuat laporan RMFT / RMKredit sendiri | ✅ | ✅ |
| Melihat laporan sendiri | ✅ | ✅ |
| Melihat **semua** laporan pegawai (`?scope=all`) | ❌ | ✅ |
| Edit/Hapus laporan | Hanya miliknya | Semua laporan |
| Dashboard statistik bulanan | ❌ | ✅ |
| Mengelola role pegawai (`/employees`) | ❌ | ✅ |
| Melihat log aktivitas semua user | Hanya miliknya | Semua |
| Logout dengan konfirmasi | Langsung | Ada modal konfirmasi |

- Role default saat mendaftar: **Pegawai** (`DEFAULT_ROLE` di `rolesConfig.jsx`).
- Perubahan role **hanya** bisa dilakukan Admin, baik di UI maupun di database
  (trigger `protect_profile_role` mencegah user menaikkan role sendiri).

---

## 4. Fitur Utama

### 4.1 Autentikasi (Login / Registrasi)
- Registrasi → `supabase.auth.signUp` + upsert baris `profiles`.
- Login → `supabase.auth.signInWithPassword` + pengambilan profil (nama, role, jabatan, foto).
- **Fallback offline**: jika server Supabase tidak terjangkau (network error),
  sistem memakai daftar user di `localStorage` dengan verifikasi password
  **PBKDF2-SHA256, 120.000 iterasi, salt acak 16 byte** (WebCrypto API).
- Sesi disimpan di `localStorage` (`bri-app-session-v1`) dengan **timeout 4 hari
  tanpa aktivitas**; setiap interaksi (klik/keyboard) memperbarui waktu aktif.

### 4.2 Laporan Harian RM (RMFT & RMKredit)
Komponen `TransactionForm.jsx` melayani dua jenis laporan via props:

| | RMFT | RMKREDIT |
|---|---|---|
| Isi | Pembukaan rekening, Setoran, Tarikan, Transfer, Aktivasi layanan, Lainnya | Konsultasi kredit, Pengajuan kredit, Follow up, Pembayaran angsuran, Restrukturisasi, Lainnya |

Fitur pada halaman laporan:
- **Input data nasabah**: nama, tipe nasabah, nomor identitas (NPWP/KTP), telepon, alamat, jenis transaksi, catatan follow-up, foto pendukung.
- **Upload foto**: dikompres otomatis via `<canvas>` sebelum disimpan (base64).
- **View mode**: `?view=reports` menampilkan kartu laporan, mode biasa menampilkan form.
- **Pencarian & filter**: berdasarkan nama/kata kunci, status, dan jenis laporan.
- **Detail, Edit, Hapus** per laporan (dengan validasi kepemilikan `canManageRecord`).
- **Gabungan admin**: `?scope=all` memuat semua laporan RMFT + RMKredit (paginasi 1000/baris).
- Data selalu **tersinkron dua arah**: Supabase `laporan_rm` ↔ cache `localStorage`.

### 4.3 Dashboard
- **Pegawai**: kartu menu RMFT/RMKredit (buat/lihat laporan) + feed aktivitas terbaru (realtime).
- **Admin**: banner pusat kendali, statistik total laporan RMFT & RMKredit,
  **grafik batang laporan per bulan** dengan pemilih tahun.

### 4.4 Pengelolaan Pegawai (Admin)
- Daftar seluruh profil dari tabel `profiles` (paginasi).
- Pencarian nama/email/role.
- Perubahan role Pegawai ⇄ Admin langsung dari tabel → update `profiles.role` di Supabase.

### 4.5 Riwayat Aktivitas
- Setiap aksi dicatat: Login, Logout, Registrasi, Buka menu, Upload/Edit/Hapus laporan,
  Ubah profil, Ubah role.
- Disimpan **lokal + cloud** (`aktivitas_log`), dimuat realtime via Supabase Realtime
  dan event `storage` antar-tab.
- Halaman `/activity`: filter role, kategori (rmft/rmkredit/system), dan pencarian.

---

## 5. Alur Sistem (Flow)

### 5.1 Alur Login
```
User isi email+password
        │
        ▼
authenticateUser() ──► supabase.auth.signInWithPassword
        │
   ┌────┴─────────────────┐
   │ sukses               │ error jaringan (Failed to fetch)
   ▼                      ▼
Ambil profil `profiles`  Cari user di localStorage
   │                      │ hash password PBKDF2 & cocokkan
   ▼                      ▼
saveAuthSession()        saveAuthSession() (mode offline)
   └──────┬───────────────┘
          ▼
   recordActivity('Login') → App set currentUser → redirect '/'
          ▼
   home.jsx cek role → AdminDashboard / EmployeeDashboard
```

### 5.2 Alur Membuat Laporan
```
Isi form (data nasabah + foto) → Submit
   │
   ├─► INSERT ke supabase: laporan_rm (user_id, form_type, data, photo_url)
   ├─► Jika gagal → simpan lokal saja (localStorage), tetap muncul di UI
   ├─► Cache hasil ke localStorage (maks 50 record terakhir)
   └─► recordActivity('Upload RMFT/RMKREDIT')
```

### 5.3 Alur Sinkronisasi Profil/Role (Realtime)
```
App.jsx useEffect (saat user login):
  1. getSession() → pastikan sesi Supabase aktif
  2. syncProfile() → SELECT profiles WHERE id = user.id
  3. Subscribe realtime: postgres_changes UPDATE on profiles (filter id)
  4. Fallback polling setiap 15 detik
  → Jika admin mengubah role, UI user terkait berubah otomatis
```

### 5.4 Alur Admin Melihat Semua Laporan
```
Sidebar Admin → "Semua laporan" → /rmft?view=reports&scope=all
  → TransactionForm (isAllReports=true)
  → Paginasi SELECT laporan_rm WHERE form_type IN (rmft, rmkredit)
  → Kartu laporan semua pegawai; admin berhak edit/hapus record siapa pun
```

---

## 6. Struktur Database (Supabase)

| Tabel | Kolom Utama | Kegunaan |
|---|---|---|
| `profiles` | `id (=auth.uid)`, name, email, **role**, job_title, photo_url, updated_at | Data tambahan user + penentu role |
| `laporan_rm` | id, user_id, user_name, form_type, full_name, customer_type, identity_number, phone, address, transaction_type, follow_up, photo_url, created_at | Isi laporan harian RMFT/RMKredit |
| `aktivitas_log` | id, user_id, user_name, action, detail, created_at | Log aktivitas seluruh fitur |

### Kebijakan RLS (dari `supabase/role-access.sql`)
- **profiles**: SELECT/UPDATE milik sendiri atau Admin; INSERT hanya diri sendiri.
- **laporan_rm**: INSERT harus `user_id = auth.uid()`; UPDATE/DELETE milik sendiri atau Admin.
- **aktivitas_log**: SELECT milik sendiri atau Admin; INSERT hanya untuk diri sendiri.
- **Trigger `protect_profile_role`**: non-admin tidak bisa mengubah `role` sendiri
  (INSERT dipaksa `Pegawai`, UPDATE role ditolak diam-diam).
- Fungsi `current_user_is_admin()` (SECURITY DEFINER) dipakai semua policy.

> ⚠️ Catatan: policy `laporan_rm for select using (true)` — semua user ter-autentikasi
> bisa membaca seluruh laporan lewat API langsung (di UI disembunyikan).
> Disarankan diperketat menjadi `user_id = auth.uid() or current_user_is_admin()`.

---

## 7. Pemetaan Rute (Routing)

| Rute | Halaman | Akses |
|---|---|---|
| `/` | Home → Dashboard sesuai role | Login |
| `/login` | AuthPage (Login/Registrasi) | Hanya tanpa sesi |
| `/rmft` | Form & laporan RMFT | Login |
| `/rmkredit` | Form & laporan RMKredit | Login |
| `/rmft?view=reports` | Mode daftar laporan | Login |
| `/rmft?view=reports&scope=all` | Laporan gabungan semua pegawai | **Admin** |
| `/employees` | Pengelolaan pegawai | **Admin** (nege ke `/` jika bukan) |
| `/activity` | Riwayat aktivitas | Login |
| `*` | Redirect → `/` atau `/login` | — |

Semua rute di-*lazy load*; selama menunggu ditampilkan fallback "Memuat halaman...".

---

## 8. Penyimpanan Lokal (localStorage Keys)

| Key | Isi |
|---|---|
| `bri-app-session-v1` | Sesi aktif: `{ user, lastActiveAt }` (timeout 4 hari) |
| `bri-app-users-v1` | Daftar user (untuk fallback offline auth, hash PBKDF2) |
| `bri-app-activity-v1` | Cache log aktivitas (maks 300 record) |
| `bri-app-records-{formType}-{userId}` | Cache laporan per user & jenis form (maks 50) |

---

## 9. Catatan & Known Issue

1. **Folder `src/layouts/` tidak terpakai.** `MainLayout.jsx` mengimpor
   `components/Sidebar` dan `components/Header` yang **tidak ada** → akan error
   jika dipakai. Aman dihapus.
2. **Foto disimpan base64 di kolom `photo_url`** — sederhana, tapi membuat tabel
   cepat besar. Alternatif lebih baik: **Supabase Storage** (bucket + URL publik).
3. **User yang terdaftar saat offline** hanya hidup di localStorage; saat Supabase
   kembali online, akun tersebut tidak ada di cloud. Perlu mekanisme re-sync.
4. Anon key ter-hardcode sebagai fallback di `supabaseClient.js` — sebaiknya
   penuh mengandalkan `.env`.
5. `fetchReports` di `TransactionForm` bergantung pada objek `user` (bukan `user.id`),
   bisa memicu refetch berlebih saat profil tersinkron.

---

## 10. Cara Pengembangan Singkat

1. Salin `.env.example` → isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
2. Jalankan `supabase/role-access.sql` di SQL Editor proyek Supabase Anda.
3. Buat tabel `profiles`, `laporan_rm`, `aktivitas_log` sesuai §6.
4. `npm install` lalu `npm run dev`.
5. Daftar lewat UI → role default `Pegawai`; jadikan salah satu `Admin` lewat
   SQL/console untuk membuka fitur admin (atau lewat halaman `/employees`
   jika sudah ada admin lain).
