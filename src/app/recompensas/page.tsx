export default function RecompensasPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-bold text-white">Plan de recompensas</h1>
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-amber-400">
          Gana puntos extra
        </h2>
        <p className="text-slate-300">
          Además del faucet y los juegos, puedes ganar puntos con logros y misiones:
        </p>
        <ul className="list-inside list-disc space-y-1 text-slate-400">
          <li>Verificar correo electrónico</li>
          <li>Conectar wallet de Solana</li>
          <li>Primera apuesta en HI-LO</li>
          <li>Invitar a tu primer referido</li>
          <li>Reclamar el faucet X días seguidos</li>
        </ul>
        <p className="text-slate-500 text-sm">
          Las recompensas se irán activando en próximas actualizaciones.
        </p>
      </div>
    </div>
  );
}
