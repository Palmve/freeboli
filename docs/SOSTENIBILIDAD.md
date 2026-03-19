# Sostenibilidad de FreeBoli

Este documento resume el modelo de simulación para estimar la sostenibilidad de [freeboli.win](https://freeboli.win/) (repartición de recompensas, premios y duración del saldo en BOLIS).

## Dónde se simula

En **Admin → Proyecciones** tienes:

1. **Parámetros**: usuarios activos, % faucet, reclamos/día, rachas, premios ranking, **saldo tesorería (BOLIS)** y **apuestas HI-LO (puntos/mes)**.
2. **Resultados estimados**: puntos y BOLIS repartidos al mes (faucet, comisiones, logros, premios).
3. **Sostenibilidad**:
   - **Ganancia HI-LO (casa)**: ~2% del volumen apostado (prob. jugador 0,49 × 2 = 0,98; casa retiene 2%).
   - **Consumo neto (BOLIS/mes)**: repartición en BOLIS menos lo que recupera la casa por HI-LO.
   - **Meses que dura el saldo**: con el saldo de tesorería indicado (ej. 10.000 BOLIS), cuántos meses aguanta a ese ritmo.
   - **Depósitos mínimos (BOLIS/mes) para equilibrio**: entrada mínima por depósitos para que no se vacíe la tesorería (si no hay suficiente volumen HI-LO).

Además:
- **Ganancia máxima por usuario (juego mínimo)** ahora tiene un selector de **reclamos por día** (1 a 24) para simular cuánto puede acumular un usuario manteniendo el mínimo de juego.
- En “Sostenibilidad” hay barras para ajustar en vivo **saldo tesorería (BOLIS)** y un **horizonte (meses)** para ver cuánto BOLIS se requeriría para que dure ese tiempo.

## Ejemplo: 10.000 BOLIS de saldo

- Con **parámetros por defecto** (100 usuarios, 60% faucet, 8 reclamos/día, premios actuales, 500k puntos/mes en HI-LO):
  - Consumo neto ≈ X BOLIS/mes (según el simulador).
  - **Meses que dura** = 10.000 / (consumo neto).
- Si quieres que el saldo dure **más tiempo**:
  - **Reducir** premios (diario/semanal/mensual), base faucet o bonus de referidos.
  - **Aumentar** volumen de apuestas HI-LO (más jugadas = más 2% para la casa).
  - **Aumentar** depósitos (usuarios que compran/depositan BOLIS).

## Equilibrio

- **Equilibrio** = entradas ≥ salidas.
- **Entradas**: depósitos (BOLIS que envían usuarios) + ganancia HI-LO (puntos que la casa retiene).
- **Salidas**: retiros (BOLIS que pagamos cuando usuarios convierten puntos a BOLIS).

Si no hay suficientes depósitos ni volumen HI-LO, la tesorería se agota. El simulador te da el **depósito mínimo mensual en BOLIS** necesario para que, con el resto de premios y faucet igual, la tesorería no baje.

## Cuántas jugadas / usuarios para mantener repartición

- **Más usuarios activos** → más faucet y más premios repartidos → más consumo.
- **Más volumen HI-LO** → más ganancia para la casa → menos consumo neto.
- Para **mantener la repartición actual** sin vaciar la tesorería necesitas, o bien:
  - que **depósitos (BOLIS/mes)** ≥ consumo neto (BOLIS/mes), o
  - que **apuestas HI-LO (puntos/mes)** sean tan altas que la ganancia de la casa (2%) compense la repartición (consumo neto ≤ 0).

En Admin → Proyecciones puedes probar distintos valores de “Usuarios activos” y “Apuestas HI-LO (puntos/mes)” y ver cómo cambian “Consumo neto” y “Meses que dura el saldo”.

## ¿Disminuir o incrementar premios?

- Si **los meses que dura el saldo** son pocos (< 6 meses con 10k BOLIS): **disminuir** premios (o base faucet) o subir requisitos mejora la sostenibilidad.
- Si el consumo neto es bajo y la tesorería aguanta mucho: se puede **mantener o incrementar** premios siempre que entradas (depósitos + HI-LO) sigan cubriendo.

Los valores de premios y faucet se cambian en **Admin → Configuración** (y en `site_settings` en base de datos).
