import AdminProcessDeposits from "../AdminProcessDeposits";
import AdminGrantPoints from "../AdminGrantPoints";

export default function AdminDepositosPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Depósitos y puntos</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <AdminProcessDeposits />
        <AdminGrantPoints />
      </div>
    </div>
  );
}
