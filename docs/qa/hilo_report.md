# Informe de Verificación Técnica: Juego HI-LO

**Analista:** Antigravity (QA Engine)
**Fecha:** 24 de Marzo, 2026
**Estatus:** Finalizado - Hallazgos Pendientes de Revisión

## 1. Resumen Ejecutivo
Se ha realizado una auditoría lógica y técnica del juego HI-LO en la plataforma FreeBoli. El sistema utiliza un modelo *Provably Fair* basado en `server_seed`, `client_seed` y `nonce`. La implementación de las cuotas sigue un modelo de RTP del 98% en la mayoría del rango, pero presenta una degradación significativa en cuotas inferiores a 1.96 debido a restricciones de diseño en el cálculo de resultados ganadores (`k`). El modo **AUTO** está correctamente aislado mediante snapshots, garantizando que cambios accidentales en la UI no afecten sesiones en curso.

---

## 2. Inventario de Opciones y Combinaciones
| Categoría | Opciones | Observaciones |
| :--- | :--- | :--- |
| **Modo de Juego** | Manual, Auto | Manual espera acción; Auto es un bucle asíncrono. |
| **Elección Base** | HI, LO, Alternate | HI (roll alto), LO (roll bajo), Alternate (swapping). |
| **Estrategia (Win/Loss)** | Return to Base, Increase %, Change Odds | Mutuamente excluyentes la base vs % aumento. |
| **Siguiente Apuesta** | HI, LO, Contrary | Prioridad absoluta sobre la Elección Base. |
| **Stops** | Profit, Loss, Max Bet | Detienen el bucle Auto si se cumplen condiciones. |

---

## 3. Matriz de Resultados (Simulación Determinista)
Considerando `HILO_ROLL_MOD = 10000` y `RTP Target = 98%`.

| Caso (Cuota) | k (Win Outcomes) | HI Win (>=) | LO Win (<=) | RTP Observado | Estatus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.01** | 5000 | 5000 | 4999 | 50.50% | **RIESGO** |
| **2.00** | 4900 | 5100 | 4899 | 98.00% | OK |
| **10.00** | 980 | 9020 | 979 | 98.00% | OK |
| **200.00** | 49 | 9951 | 48 | 98.00% | OK |
| **4900.00** | 2 | 9998 | 1 | 98.00% | OK |

---

## 4. Hallazgos Prioritarios

### [CRÍTICO] Degradación de RTP en Cuotas Bajas
- **Descripción:** La función `hiLoWinningOutcomes` limita `k` a 5000. Para cuotas menores a 1.96, esto rompe la fórmula del 98% RTP.
- **Riesgo:** Un usuario apostando a cuota 1.01 pierde el 49.5% de su valor esperado en cada tiro.
- **Corrección:** Ajustar `HILO_ODDS_MIN` a 1.96 o permitir que `k` suba hasta 9703 (aunque HI/LO se solapen, la UI debe indicarlo).

### [MEDIO] Snapshots de Odds en Modo Auto
- **Descripción:** En `page.tsx`, `initialOdds` se captura al inicio, pero si existe una estrategia de "Change Odds", esta muta el estado `autoSessionRef.current.odds`.
- **Estatus:** **OK / COHERENTE**. El diseño permite la mutación controlada de la cuota dentro de la sesión, lo cual es deseable para estrategias tipo Martingala dinámica.

### [BAJO] Rate Limit Conceptual
- **Descripción:** El servidor limita a 5/s. El cliente pausa 250ms (4/s).
- **Riesgo:** Si la latencia de red es < 50ms, el cliente podría reintentar demasiado rápido.
- **Observación:** El uso de `await playOne` mitiga esto, ya que la pausa de 250ms ocurre *después* de recibir la respuesta.

---

## 5. Recomendaciones de Pruebas
1.  **Seguridad:** Intentar enviar `odds < 1.01` vía API. (Verificado: el servidor normaliza a 2.00).
2.  **Snapshot:** Iniciar AUTO, cambiar `autoBaseBet` en el input y verificar que la apuesta real no cambia.
3.  **Límite Diario:** Realizar múltiples apuestas automáticas ganadoras hasta alcanzar `MAX_DAILY_WIN_POINTS` y verificar el bloqueo por parte del servidor.

**Archivo revisado para lógica core:** `src/lib/hilo.ts`
**Archivo revisado para seguridad:** `src/app/api/hi-lo/play/route.ts`
