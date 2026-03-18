"use client";

import { useState } from "react";

const POINTS_PER_BOLIS = 1000;

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
  };
}

export default function ProyeccionesPage() {
  const [params, setParams] = useState(DEFAULT);
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
    </div>
  );
}
