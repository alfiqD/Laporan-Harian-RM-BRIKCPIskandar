# React + Vite

## Struktur aplikasi

- `src/App.jsx` mengatur autentikasi, sesi, dan rute.
- `src/pages/home.jsx` memilih dashboard berdasarkan role.
- `src/pages/dashboard/EmployeeDashboard.jsx` berisi beranda pegawai.
- `src/pages/admin/AdminLayout.jsx` menyediakan sidebar Admin tetap pada seluruh halaman Admin dan konfirmasi logout.
- `src/pages/dashboard/AdminDashboard.jsx` berisi kartu informasi dan grafik laporan.
- `src/pages/admin/EmployeeManagementPage.jsx` berisi halaman khusus pengelolaan akun dan role pegawai.
- `src/pages/activity/ActivityHistoryPage.jsx` berisi halaman riwayat aktivitas Admin/Pegawai.
- `src/components/TransactionForm.jsx` dipakai bersama oleh RMFT dan RM Kredit.
- `src/pages/auth/` berisi login, registrasi, dan pengelolaan sesi.

Registrasi baru memberikan role `Pegawai`. Admin dapat mengubah role dari dashboard Admin.
Sesi berakhir setelah empat hari tanpa aktivitas.

### Kebijakan akses Supabase

Jalankan `supabase/role-access.sql` melalui SQL Editor Supabase untuk menerapkan
Row Level Security pada tabel `profiles`, `laporan_rm`, dan `aktivitas_log`.
Pegawai dapat membaca semua laporan sesuai kebutuhan, tetapi hanya dapat mengubah
atau menghapus laporan miliknya. Role hanya dapat diubah oleh admin. Script ini
mengasumsikan tabel dan kolom yang sudah digunakan aplikasi telah dibuat, dan
mengganti seluruh policy RLS yang sudah ada pada ketiga tabel tersebut.

Untuk instalasi pertama, daftarkan akun admin lalu ubah rolenya sekali melalui
SQL Editor Supabase (ganti alamat email berikut dengan email akun admin):

```sql
update public.profiles
set role = 'Admin', updated_at = now()
where email = 'admin@contoh.co.id';
```

Setelah itu, admin dapat mengatur role akun lain melalui halaman **Pengelolaan Pegawai**
yang tersedia pada sidebar. Riwayat aktivitas juga tersedia sebagai halaman tersendiri;
dashboard Admin hanya menampilkan informasi ringkas dan grafik laporan.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
