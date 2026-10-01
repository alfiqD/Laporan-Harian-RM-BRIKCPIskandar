import TransactionForm from '../../components/TransactionForm.jsx';

export default function RMKREDIT({ user, onBack }) {
  return (
    <TransactionForm
      user={user}
      onBack={onBack}
      formType="rmkredit"
      title="Relationship Manager Kredit"
      transactionLabel="Jenis Layanan Kredit"
      transactionOptions={[
        'Konsultasi kredit',
        'Pengajuan kredit',
        'Follow up pengajuan',
        'Pembayaran angsuran',
        'Restrukturisasi kredit',
        'Lainnya',
      ]}
    />
  );
}