import Link from "next/link";
import { POINTS_PER_BOLIS } from "@/lib/config";

export default function HomePage() {
  return (
    <div className="space-y-16 py-8">
      <section className="text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Gana puntos gratis cada hora
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-300">
          Juega al faucet, multiplica en HI-LO y retira en{" "}
          <span className="font-semibold text-green-400">BOLIS</span> de Solana.
          <br />
          <span className="text-amber-400">
            {POINTS_PER_BOLIS.toLocaleString()} puntos = 1 BOLIS
          </span>
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/auth/registro" className="btn-primary text-lg px-6 py-3">
            Jugar ahora
          </Link>
          <Link href="/auth/login" className="btn-secondary text-lg px-6 py-3">
            Entrar
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold text-amber-400">
            Faucet gratis
          </h2>
          <p className="text-slate-300">
            Reclama puntos cada hora sin invertir. Acumula y convierte en BOLIS.
          </p>
          <Link href="/faucet" className="mt-4 inline-block text-amber-400 hover:underline">
            Ir al faucet →
          </Link>
        </div>
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold text-amber-400">
            HI-LO
          </h2>
          <p className="text-slate-300">
            Apuesta puntos y multiplica. Juego provably fair con tus puntos.
          </p>
          <Link href="/hi-lo" className="mt-4 inline-block text-amber-400 hover:underline">
            Jugar HI-LO →
          </Link>
        </div>
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold text-amber-400">
            Afiliados
          </h2>
          <p className="text-slate-300">
            Invita amigos y gana comisión de por vida sobre sus puntos.
          </p>
          <Link href="/afiliados" className="mt-4 inline-block text-amber-400 hover:underline">
            Ver programa →
          </Link>
        </div>
      </section>

      <section className="card max-w-2xl mx-auto text-center">
        <h2 className="mb-2 text-2xl font-semibold text-white">
          Depósitos y retiros en BOLIS
        </h2>
        <p className="text-slate-300">
          Añade puntos enviando BOLIS a nuestra wallet. Cuando tengas suficientes
          puntos, retira BOLIS a tu wallet de Solana (Phantom, etc.).
        </p>
        <p className="mt-2 text-sm text-amber-400">
          Equivalencia: {POINTS_PER_BOLIS.toLocaleString()} puntos = 1 BOLIS (ajustable)
        </p>
      </section>
    </div>
  );
}
