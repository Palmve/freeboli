import AdminWalletBalance from "../AdminWalletBalance";
import AdminUserWallets from "../AdminUserWallets";

export default function AdminWalletsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Wallets y Solana</h2>
      <AdminWalletBalance />
      <AdminUserWallets />
    </div>
  );
}
