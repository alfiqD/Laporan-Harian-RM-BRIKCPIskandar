export const DEFAULT_ROLE = 'Pegawai';

export const rolesData = [
  {
    value: 'Pegawai',
    label: 'Pegawai',
    description: 'Mengelola laporan dan aktivitas pekerjaan sendiri',
  },
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Mengelola laporan dan akun seluruh pegawai',
  },
];

export function isAdminRole(role) {
  return role?.toLowerCase() === 'admin';
}