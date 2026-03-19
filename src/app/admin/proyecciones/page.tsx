"use client";

import { useState } from "react";

const POINTS_PER_BOLIS = 1000;
/** HI-LO: probabilidad jugador 0.49, multiplicador 2 → casa retiene 2% de lo apostado */
const HILO_HOUSE_EDGE = 0.02;

/** Ganancia máxima por usuario con juego mínimo: faucet N veces/día (sin racha) + logros únicos. Sin referidos ni premios ranking. */
const USER_MIN_PLAY_DEFAULTS = {
  baseFaucet: 100,
  logroEmailVerified: 500,
  logroFirstBet: 200,
};
function calcUsuarioMinimo(reclamosPorDia: number) {
  const ptsPorMesFaucet = USER_MIN_PLAY_DEFAULTS.baseFaucet * reclamosPorDia * 30;
  const logrosUnicos = USER_MIN_PLAY_DEFAULTS.logroEmailVerified + USER_MIN_PLAY_DEFAULTS.logroFirstBet;
  return {
    logrosUnicos,
    ptsPorMesFaucet,
    mes1: logrosUnicos + ptsPorMesFaucet,
    ano1: logrosUnicos + ptsPorMesFaucet * 12,
    ano2: logrosUnicos + ptsPorMesFaucet * 24,
    ano5: logrosUnicos + ptsPorMesFaucet * 60,
    ptsPorAnoRecurrente: ptsPorMesFaucet * 12,
  };
}

const DEFAULT = {
  usuarios: 100,
  pctFaucet: 60,
  reclamosDia: 8,
  rachaHorasPromedio: 10,
  rachaDiasPromedio: 5,
  baseFaucet: 100,
  referidosPorUsuario: 2,
  pctVerificados: 50,
  bonusVerificado: 10000,
  comisionAfiliado: 50,
  comisionLogros: 10,
  logrosPromedioUsuario: 3,
  puntosPromedioLogro: 1000,
  premioDiario1: 500,
  premioDiario2: 300,
  premioDiario3: 100,
  premioSemanal1: 5000,
  premioSemanal2: 3000,
  premioSemanal3: 1000,
  premioMensual1: 25000,
  premioMensual2: 15000,
  premioMensual3: 5000,
  /** Saldo de tesorería en BOLIS para simular duración */
  saldoTesoreriaBolis: 10000,
  /** Puntos apostados en HI-LO por mes (total volumen); la casa gana ~2% */
  hiloApuestasPuntosMes: 500000,
};

function calc(p: typeof DEFAULT) {
  const hourlyMultAvg = (() => {
    if (p.rachaHorasPromedio <= 3) return 1.0;
    if (p.rachaHorasPromedio <= 6) return 1.5;
    if (p.rachaHorasPromedio <= 12) return 2.0;
    if (p.rachaHorasPromedio <= 24) return 2.5;
    return 3.0;
  })();

  const dailyBonusAvg = (() => {
    if (p.rachaDiasPromedio <= 1) return 0;
    if (p.rachaDiasPromedio <= 3) return 0.1;
    if (p.rachaDiasPromedio <= 7) return 0.25;
    if (p.rachaDiasPromedio <= 14) return 0.5;
    if (p.rachaDiasPromedio <= 30) return 0.75;
    return 1.0;
  })();

  const payoutPerClaim = Math.floor(p.baseFaucet * hourlyMultAvg * (1 + dailyBonusAvg));
  const usuariosFaucet = Math.floor(p.usuarios * p.pctFaucet / 100);
  const faucetDia = usuariosFaucet * p.reclamosDia * payoutPerClaim;

  const comisionFaucetDia = Math.floor(faucetDia * p.comisionAfiliado / 100 * (p.referidosPorUsuario > 0 ? 1 : 0));

  const totalReferidos = p.usuarios * p.referidosPorUsuario;
  const verificados = Math.floor(totalReferidos * p.pctVerificados / 100);
  const bonusVerificadoTotal = verificados * p.bonusVerificado;

  const logrosTotales = p.usuarios * p.logrosPromedioUsuario;
  const puntosLogros = logrosTotales * p.puntosPromedioLogro;
  const comisionLogrosTotal = Math.floor(puntosLogros * p.comisionLogros / 100);

  const premiosDia = p.premioDiario1 + p.premioDiario2 + p.premioDiario3;
  const premiosSemana = p.premioSemanal1 + p.premioSemanal2 + p.premioSemanal3;
  const premiosMes = p.premioMensual1 + p.premioMensual2 + p.premioMensual3;
  const premiosRankingMes = premiosDia * 30 + premiosSemana * 4 + premiosMes;

  const totalDia = faucetDia + comisionFaucetDia + premiosDia;
  const totalUnico = bonusVerificadoTotal + puntosLogros + comisionLogrosTotal;
  const totalMes = totalDia * 30 + totalUnico + premiosSemana * 4 + premiosMes;
  const bolisMes = totalMes / POINTS_PER_BOLIS;

  // Sostenibilidad: consumo neto y duración del saldo
  const hiloGananciaPuntosMes = Math.floor(p.hiloApuestasPuntosMes * HILO_HOUSE_EDGE);
  const consumoPuntosMes = totalMes;
  const netoPuntosMes = Math.max(0, consumoPuntosMes - hiloGananciaPuntosMes);
  const consumoBolisMes = netoPuntosMes / POINTS_PER_BOLIS;
  const hiloBolisMes = hiloGananciaPuntosMes / POINTS_PER_BOLIS;
  const saldoBolis = Math.max(0, p.saldoTesoreriaBolis);
  const mesesQueDura = consumoBolisMes > 0 ? saldoBolis / consumoBolisMes : Infinity;
  const equilibrioDepositosBolisMes = consumoBolisMes;

  return {
    payoutPerClaim,
    hourlyMultAvg,
    dailyBonusAvg,
    faucetDia,
    comisionFaucetDia,
    bonusVerificadoTotal,
    puntosLogros,
    comisionLogrosTotal,
    premiosRankingMes,
    totalDia,
    totalUnico,
    totalMes,
    bolisMes,
    hiloGananciaPuntosMes,
    hiloBolisMes,
    consumoBolisMes,
    mesesQueDura,
    equilibrioDepositosBolisMes,
  };
}

export default function ProyeccionesPage() {
  const [params, setParams] = useState(DEFAULT);
  const [reclamosPorDiaUsuario, setReclamosPorDiaUsuario] = useState(1);
  const [mesesHorizonte, setMesesHorizonte] = useState(12);
  const r = calc(params);

  function set(key: keyof typeof DEFAULT, val: string) {
    setParams((p) => ({ ...p, [key]: Number(val) || 0 }));
  }

  const inputs: { label: string; key: keyof typeof DEFAULT; suffix?: string }[] = [
    { label: "Usuarios activos", key: "usuarios" },
    { label: "% que usa faucet", key: "pctFaucet", suffix: "%" },
    { label: "Reclamos/día por usuario", key: "reclamosDia" },
    { label: "Racha horas promedio", key: "rachaHorasPromedio" },
    { label: "Racha días promedio", key: "rachaDiasPromedio" },
    { label: "Puntos base faucet", key: "baseFaucet" },
    { label: "Referidos por usuario", key: "referidosPorUsuario" },
    { label: "% referidos que verifican", key: "pctVerificados", suffix: "%" },
    { label: "Bonus por verificado", key: "bonusVerificado" },
    { label: "Comisión afiliado (%)", key: "comisionAfiliado", suffix: "%" },
    { label: "Comisión logros (%)", key: "comisionLogros", suffix: "%" },
    { label: "Logros promedio/usuario", key: "logrosPromedioUsuario" },
    { label: "Puntos promedio/logro", key: "puntosPromedioLogro" },
    { label: "Premio diario 1er", key: "premioDiario1" },
    { label: "Premio diario 2do", key: "premioDiario2" },
    { label: "Premio diario 3er", key: "premioDiario3" },
    { label: "Premio semanal 1er", key: "premioSemanal1" },
    { label: "Premio semanal 2do", key: "premioSemanal2" },
    { label: "Premio semanal 3er", key: "premioSemanal3" },
    { label: "Premio mensual 1er", key: "premioMensual1" },
    { label: "Premio mensual 2do", key: "premioMensual2" },
    { label: "Premio mensual 3er", key: "premioMensual3" },
    { label: "Saldo tesorería (BOLIS)", key: "saldoTesoreriaBolis" },
    { label: "Apuestas HI-LO (puntos/mes)", key: "hiloApuestasPuntosMes" },
  ];

  const results: { label: string; value: string; color?: string }[] = [
    { label: "Puntos por reclamo (con racha)", value: r.payoutPerClaim.toLocaleString() },
    { label: "Multiplicador hora promedio", value: `x${r.hourlyMultAvg}` },
    { label: "Bonus día promedio", value: `+${Math.round(r.dailyBonusAvg * 100)}%` },
    { label: "Faucet / día", value: r.faucetDia.toLocaleString(), color: "text-amber-400" },
    { label: "Comisiones afiliado / día", value: r.comisionFaucetDia.toLocaleString() },
    { label: "Bonus verificados (único)", value: r.bonusVerificadoTotal.toLocaleString(), color: "text-green-400" },
    { label: "Puntos logros (único)", value: r.puntosLogros.toLocaleString() },
    { label: "Comisión sobre logros (único)", value: r.comisionLogrosTotal.toLocaleString() },
    { label: "Premios ranking / mes", value: r.premiosRankingMes.toLocaleString(), color: "text-purple-400" },
    { label: "Total recurrente / día", value: r.totalDia.toLocaleString(), color: "text-amber-400" },
    { label: "Total único (verificación + logros)", value: r.totalUnico.toLocaleString(), color: "text-green-400" },
    { label: "Total estimado / mes", value: r.totalMes.toLocaleString(), color: "text-white text-lg font-bold" },
    { label: "Equivalente en BOLIS / mes", value: r.bolisMes.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: "text-amber-400 text-lg font-bold" },
  ];

  const sostenibilidad = [
    { label: "Ganancia HI-LO casa (puntos/mes)", value: r.hiloGananciaPuntosMes.toLocaleString(), color: "text-green-400" },
    { label: "Ganancia HI-LO (BOLIS/mes)", value: r.hiloBolisMes.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: "text-green-400" },
    { label: "Consumo neto (BOLIS/mes)", value: r.consumoBolisMes.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: "text-amber-400" },
    { label: "Meses que dura el saldo", value: r.mesesQueDura === Infinity ? "∞" : r.mesesQueDura.toFixed(1), color: "text-white font-bold" },
    { label: "Depósitos mínimos (BOLIS/mes) para equilibrio", value: r.equilibrioDepositosBolisMes.toLocaleString(undefined, { maximumFractionDigits: 2 }), color: "text-slate-300" },
  ];
  const recomendacion = r.consumoBolisMes <= 0
    ? "El volumen HI-LO cubre la repartición. Equilibrio sostenible."
    : r.mesesQueDura < 6
      ? "Saldo se agota en menos de 6 meses. Recomendación: reducir premios/faucet o aumentar depósitos/HI-LO."
      : r.mesesQueDura < 24
        ? "Sostenibilidad limitada. Valorar reducir premios o fomentar depósitos y juego HI-LO."
        : "Ritmo asumible. Se puede mantener o subir premios si entran depósitos o más volumen HI-LO.";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Simulador de proyecciones</h2>
      <p className="text-sm text-slate-400">
        Ajusta los parámetros para estimar el costo en puntos y BOLIS del sistema.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-300">Parámetros</h3>
          {inputs.map((inp) => (
            <div key={inp.key} className="flex items-center justify-between gap-2">
              <label className="text-sm text-slate-400 flex-1">{inp.label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={params[inp.key]}
                  onChange={(e) => set(inp.key, e.target.value)}
                  className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-right text-sm text-white"
                />
                {inp.suffix && <span className="text-xs text-slate-500 w-4">{inp.suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-300">Resultados estimados</h3>
          {results.map((res) => (
            <div key={res.label} className="flex items-center justify-between gap-2 border-b border-slate-700/50 pb-1">
              <span className="text-sm text-slate-400">{res.label}</span>
              <span className={`font-mono text-sm ${res.color ?? "text-slate-300"}`}>{res.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sostenibilidad */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-amber-400">Sostenibilidad (tesorería y equilibrio)</h3>
        <p className="text-sm text-slate-400">
          Con el saldo en BOLIS indicado y asumiendo que todo lo repartido (faucet, premios, recompensas) podría retirarse,
          la casa compensa con la ganancia de HI-LO (~2% del volumen apostado).
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Saldo tesorería (BOLIS): <span className="font-mono text-amber-400">{params.saldoTesoreriaBolis.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={params.saldoTesoreriaBolis}
              onChange={(e) => set("saldoTesoreriaBolis", e.target.value)}
              className="w-full h-2 rounded-lg appearance-none bg-slate-700 accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Horizonte / tiempo (meses): <span className="font-mono text-amber-400">{mesesHorizonte}</span>
            </label>
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={mesesHorizonte}
              onChange={(e) => setMesesHorizonte(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none bg-slate-700 accent-amber-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Saldo necesario para que dure {mesesHorizonte} meses:{" "}
              <span className="font-mono text-slate-300">
                {(r.consumoBolisMes * mesesHorizonte).toLocaleString(undefined, { maximumFractionDigits: 0 })} BOLIS
              </span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sostenibilidad.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
              <span className="text-sm text-slate-400">{s.label}</span>
              <span className={`font-mono text-sm ${s.color ?? "text-slate-300"}`}>{s.value}</span>
            </div>
          ))}
        </div>
        <div className={`rounded-lg border p-3 text-sm ${
          r.consumoBolisMes <= 0 ? "border-green-500/40 bg-green-500/10 text-green-300" :
          r.mesesQueDura < 6 ? "border-red-500/40 bg-red-500/10 text-red-300" :
          "border-amber-500/40 bg-amber-500/10 text-amber-200"
        }`}>
          <strong>Recomendación:</strong> {recomendacion}
        </div>
      </div>

      {/* Ganancia máxima por usuario (juego mínimo) */}
      {(() => {
        const u = calcUsuarioMinimo(reclamosPorDiaUsuario);
        return (
          <div className="card space-y-4">
            <h3 className="text-lg font-semibold text-amber-400">Ganancia máxima por usuario (juego mínimo)</h3>
            <p className="text-sm text-slate-400">
              Un solo usuario: reclamos de faucet al día (sin racha = {USER_MIN_PLAY_DEFAULTS.baseFaucet} pts/reclamo),
              verifica correo y hace 1 apuesta en HI-LO. Sin referidos ni premios de ranking. No hay tope: puede seguir sumando cada mes.
            </p>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Reclamos por día: <span className="font-mono text-amber-400">{reclamosPorDiaUsuario}</span>
              </label>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={reclamosPorDiaUsuario}
                onChange={(e) => setReclamosPorDiaUsuario(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-slate-700 accent-amber-500"
              />
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="p-2">Concepto</th>
                    <th className="p-2 text-right">Puntos</th>
                    <th className="p-2 text-right">BOLIS (equiv.)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-700/50"><td className="p-2">Logros únicos (email + 1ª apuesta)</td><td className="p-2 text-right font-mono">{u.logrosUnicos.toLocaleString()}</td><td className="p-2 text-right font-mono">{(u.logrosUnicos / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                  <tr className="border-b border-slate-700/50"><td className="p-2">Faucet recurrente / mes</td><td className="p-2 text-right font-mono">{u.ptsPorMesFaucet.toLocaleString()}</td><td className="p-2 text-right font-mono">{(u.ptsPorMesFaucet / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                  <tr className="border-b border-slate-700/50"><td className="p-2">Total mes 1</td><td className="p-2 text-right font-mono text-amber-400">{u.mes1.toLocaleString()}</td><td className="p-2 text-right font-mono text-amber-400">{(u.mes1 / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                  <tr className="border-b border-slate-700/50"><td className="p-2">Total año 1</td><td className="p-2 text-right font-mono text-white font-bold">{u.ano1.toLocaleString()}</td><td className="p-2 text-right font-mono text-white font-bold">{(u.ano1 / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                  <tr className="border-b border-slate-700/50"><td className="p-2">Total año 2</td><td className="p-2 text-right font-mono">{u.ano2.toLocaleString()}</td><td className="p-2 text-right font-mono">{(u.ano2 / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                  <tr className="border-b border-slate-700/50"><td className="p-2">Total año 5</td><td className="p-2 text-right font-mono">{u.ano5.toLocaleString()}</td><td className="p-2 text-right font-mono">{(u.ano5 / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                  <tr><td className="p-2">Cada año adicional (solo faucet)</td><td className="p-2 text-right font-mono text-slate-400">+{u.ptsPorAnoRecurrente.toLocaleString()}</td><td className="p-2 text-right font-mono text-slate-400">+{(u.ptsPorAnoRecurrente / POINTS_PER_BOLIS).toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Si reclamara cada hora (máx. permitido) con racha mínima, serían hasta 24 × 100 = 2.400 pts/día solo de faucet (~72.000 pts/mes). Con rachas altas el multiplicador sube (hasta ×3) y el total sería mayor.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
