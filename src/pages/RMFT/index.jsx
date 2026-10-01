import TransactionForm from '../../components/TransactionForm.jsx';

export default function RMFT({ user, onBack }) {
  return (
    <TransactionForm
      user={user}
      onBack={onBack}
      formType="rmft"
      title="Relationship Manager Funding & Transaksi (RMFT)"
      transactionLabel="Jenis Transaksi"
      transactionOptions={[
        'Pembukaan rekening',
        'Setoran',
        'Tarikan',
        'Transfer',
        'Aktivasi layanan',
        'Lainnya',
      ]}
    />
  );
}