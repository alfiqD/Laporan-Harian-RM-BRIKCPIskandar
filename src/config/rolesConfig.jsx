import { FiUser, FiShoppingBag, FiBriefcase, FiPackage, FiZap } from 'react-icons/fi';

// Daftar Role yang bisa dipilih di aplikasi
export const rolesData = [
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Akses penuh ke semua fitur CRM & Pengaturan',
    icon: <FiUser className="text-xl" />,
  },
  {
    value: 'Kasir',
    label: 'Kasir',
    description: 'Manajemen transaksi, kas, & penjualan harian',
    icon: <FiShoppingBag className="text-xl" />,
  },
  {
    value: 'Owner',
    label: 'Owner',
    description: 'Melihat laporan pendapatan, laba, & laporan staf',
    icon: <FiBriefcase className="text-xl" />,
  },
  {
    value: 'Manager',
    label: 'Manager',
    description: 'Mengelola tim kasir & staf operasional',
    icon: <FiZap className="text-xl" />,
  },
  {
    value: 'Logistik',
    label: 'Logistik',
    description: 'Mengelola stok produk, inventaris, & gudang',
    icon: <FiPackage className="text-xl" />,
  },
];