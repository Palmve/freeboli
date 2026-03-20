"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_BET_POINTS, MAX_WIN_POINTS, MAX_DAILY_WIN_POINTS, POINTS_PER_BOLIS } from "@/lib/config";
import Link from "next/link";

export default function TerminosPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch("/api/terms/accept", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAccepted(true);
      } else {
        setError(data.error || "Error al aceptar");
      }
    } catch {
      setError("Error de conexion");
    } finally {
      setAccepting(false);
    }
  }

  const maxBetBolis = (MAX_BET_POINTS / POINTS_PER_BOLIS).toLocaleString();
  const maxWinBolis = (MAX_WIN_POINTS / POINTS_PER_BOLIS).toLocaleString();
  const maxDailyBolis = (MAX_DAILY_WIN_POINTS / POINTS_PER_BOLIS).toLocaleString();

  return (
    <div className="relative mx-auto max-w-3xl space-y-6 py-8 px-4">
      {/* Botón de cierre superior */}
      <button 
        onClick={() => router.back()}
        className="absolute right-4 top-8 rounded-full bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
        title="Cerrar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-white pr-10">Terminos y Condiciones de Juego</h1>
        <p className="text-sm text-slate-400">Ultima actualizacion: Marzo 2026</p>
      </div>

      <div className="card space-y-4 text-sm text-slate-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-amber-400">1. Naturaleza del servicio</h2>
        <p>
          FreeBoli es una plataforma de entretenimiento basada en puntos virtuales. Los puntos no tienen valor monetario
          intrinseco. Los BOLIS (token SPL en Solana) pueden depositarse y retirarse segun la equivalencia vigente
          ({String(POINTS_PER_BOLIS)} puntos = 1 BOLIS). El usuario acepta que juega bajo su propia responsabilidad.
        </p>

        <h2 className="text-lg font-semibold text-amber-400">2. Limites de juego</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Apuesta maxima por jugada: <span className="text-white font-mono">{MAX_BET_POINTS.toLocaleString()} puntos</span> ({maxBetBolis} BOLIS)</li>
          <li>Ganancia maxima por jugada: <span className="text-white font-mono">{MAX_WIN_POINTS.toLocaleString()} puntos</span> ({maxWinBolis} BOLIS)</li>
          <li>Ganancia maxima diaria: <span className="text-white font-mono">{MAX_DAILY_WIN_POINTS.toLocaleString()} puntos</span> ({maxDailyBolis} BOLIS)</li>
          <li>Los limites pueden ser ajustados por la administracion en cualquier momento</li>
        </ul>

        <h2 className="text-lg font-semibold text-amber-400">3. Juego justo (Provably Fair)</h2>
        <p>
          El juego HI-LO utiliza un sistema provably fair verificable. Cada tirada genera un server_seed, client_seed y
          nonce que el usuario puede verificar de forma independiente. La casa tiene una ventaja del 2% (49% jugador / 51% casa
          en cuota x2).
        </p>

        <h2 className="text-lg font-semibold text-amber-400">4. Conducta prohibida</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Uso de bots, scripts automatizados o software de terceros para manipular el juego</li>
          <li>Creacion de multiples cuentas para evadir limites o abusar del sistema de referidos</li>
          <li>Explotacion de errores, bugs o vulnerabilidades del sistema</li>
          <li>Intentos de acceso no autorizado a cuentas de otros usuarios</li>
          <li>Lavado de puntos entre cuentas</li>
          <li>Manipulacion o interferencia con el generador de numeros aleatorios</li>
          <li>Uso de VPN o proxies para evadir restricciones de IP</li>
          <li>Cualquier actividad que la administracion considere fraudulenta o abusiva</li>
        </ul>

        <h2 className="text-lg font-semibold text-amber-400">5. Sanciones</h2>
        <p>
          La administracion se reserva el derecho de suspender o bloquear permanentemente cualquier cuenta que viole estos
          terminos, sin previo aviso y sin obligacion de devolucion de puntos o BOLIS. Las cuentas marcadas como "A Evaluar",
          "Suspendido" o "Bloqueado" tendran restricciones parciales o totales en el uso de la plataforma.
        </p>

        <h2 className="text-lg font-semibold text-amber-400">6. Depositos y retiros</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Los depositos se procesan automaticamente al verificar la transaccion en Solana</li>
          <li>Los retiros estan sujetos a revision y pueden demorar hasta 24 horas</li>
          <li>Se aplica un minimo de retiro configurable por la administracion</li>
          <li>La plataforma no es responsable por transacciones enviadas a direcciones incorrectas</li>
          <li>En caso de error tecnico, la administracion puede revertir operaciones</li>
        </ul>

        <h2 className="text-lg font-semibold text-amber-400">7. Faucet y recompensas</h2>
        <p>
          El faucet y los sistemas de recompensas son beneficios opcionales que la plataforma ofrece a discrecion.
          Los montos, frecuencias y condiciones pueden cambiar sin previo aviso. El abuso sistematico del faucet
          (farming con bots, cuentas multiples) resultara en suspension inmediata.
        </p>

        <h2 className="text-lg font-semibold text-amber-400">8. Programa de afiliados</h2>
        <p>
          Las comisiones de afiliados se calculan automaticamente. La plataforma se reserva el derecho de revocar
          comisiones obtenidas mediante referidos fraudulentos o auto-referidos. Los bonos por referidos verificados
          requieren que el referido cumpla requisitos minimos de actividad.
        </p>

        <h2 className="text-lg font-semibold text-amber-400">9. Responsabilidad limitada</h2>
        <p>
          FreeBoli no garantiza disponibilidad ininterrumpida del servicio. No somos responsables por perdidas
          causadas por fallos tecnicos, de red, o de la blockchain de Solana. El usuario acepta que juega con
          fondos que puede permitirse perder.
        </p>

        <h2 className="text-lg font-semibold text-amber-400">10. Modificaciones</h2>
        <p>
          Estos terminos pueden ser modificados en cualquier momento. El uso continuado de la plataforma despues
          de una modificacion implica la aceptacion de los nuevos terminos. Se notificara a los usuarios de
          cambios significativos.
        </p>

        <h2 className="text-lg font-semibold text-amber-400">11. Edad minima</h2>
        <p>
          El usuario declara ser mayor de 18 anos (o la edad legal en su jurisdiccion) y asume la responsabilidad
          de verificar que el uso de esta plataforma es legal en su pais de residencia.
        </p>
      </div>

      {session?.user && !accepted && (
        <div className="card text-center space-y-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <p className="text-slate-300">
            Al hacer clic en "Acepto", confirmas que has leido y aceptas todos los terminos y condiciones.
          </p>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="btn-primary w-full max-w-xs mx-auto disabled:opacity-50"
          >
            {accepting ? "Procesando..." : "Acepto los Terminos y Condiciones"}
          </button>
        </div>
      )}

      {accepted && (
        <div className="card text-center space-y-4">
          <p className="text-green-400 font-semibold">Terminos aceptados correctamente. Ya puedes jugar.</p>
          <Link href="/hi-lo" className="btn-primary inline-block">
            Volver al Juego
          </Link>
        </div>
      )}

      {!accepted && (
        <div className="text-center pb-8">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-300 transition text-sm">
            ← Volver anterior
          </button>
        </div>
      )}
    </div>
  );
}
