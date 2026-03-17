import { AFFILIATE_COMMISSION_PERCENT, POINTS_PER_BOLIS } from "@/lib/config";

export default function AfiliadosPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <h1 className="text-2xl font-bold text-white">Plan afiliados</h1>
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold text-amber-400">
          Gana comisión de por vida
        </h2>
        <p className="text-slate-300">
          Invita a amigos con tu enlace de referido. Obtendrás el{" "}
          <strong>{AFFILIATE_COMMISSION_PERCENT}%</strong> de los puntos que ganen
          con el faucet y en los juegos, de forma permanente.
        </p>
        <p className="text-slate-400 text-sm">
          Los puntos se convierten en BOLIS al retirar ({POINTS_PER_BOLIS.toLocaleString()} puntos = 1 BOLIS).
        </p>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-300">Tu enlace de referido</h2>
        <p className="mt-2 text-slate-400 text-sm">
          Inicia sesión y en &quot;Mi cuenta&quot; verás tu enlace único para compartir.
          Cada usuario que se registre con ese enlace quedará vinculado a ti y
          ganarás comisión sobre su actividad.
        </p>
      </div>
    </div>
  );
}
