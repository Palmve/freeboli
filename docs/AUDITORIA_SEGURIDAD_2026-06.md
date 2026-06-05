# Auditoría de Seguridad y Monitoreo — FreeBoli (Junio 2026)

> Campaña de hardening de seguridad + monitoreo. Todo verificado contra datos
> reales de producción y desplegado. Cierre de sesión: 2026-06-05.

---

## 0. Contexto / hallazgo inicial

Auditoría disparada por evaluación antifraude. Al revisar el backup real
(`freeboli_backup_2026-03-23.json`) + queries en vivo se confirmó que **el
proyecto YA había sido farmeado**: un clúster de ~40 cuentas referidas (emails de
teclazo + desechables `@sharebot.net`) cobró ~400-978 BOLIS on-chain, y las
tablas `security_events` / `withdrawal_anomalies` / `rate_limit_log` estaban
**vacías** (monitoreo ciego). Puntuación antifraude inicial: **2/10**.

Infraestructura: **Vercel + Supabase** (proyecto `tiyjxmyknpgefjslkkrc`), **sin
Cloudflare/WAF** delante.

---

## 1. Releases desplegadas

| Versión | Frente | Qué cerró |
|---|---|---|
| **1.143.0** | Perímetro de identidad | Typo que anulaba el ban anti-Sybil (`["suspended","blocked"]` → `["suspendido","bloqueado"]`); captcha que filtraba la respuesta en el token (ahora HMAC, sin respuesta); bypass de registro vía Google OAuth (ahora aplica desechables + ban IP); cierre de la race de doble-claim del faucet (rate-limit persistente); normalización de email anti-alias Gmail (`email_canonical`); IP de confianza (`x-vercel-forwarded-for`); gating de auto-retiro para cuentas nuevas. Migraciones `032_registration_ip`, `033_email_canonical`. |
| **1.144.0** | Auth admin / depósitos | Cookie de "dispositivo de confianza" firmada con HMAC (`lib/device-trust.ts`) — antes era el literal `"true"`, falsificable por cookie-shadowing; depósitos exigen commitment `finalized` + descartan `meta.err`. |
| **1.145.0** | Acuñación de puntos | `rewards/claim` ahora atómico (insert-guard por constraint + `atomic_add_points`) — antes hacía read-then-write absoluto, permitía **borrar débitos** (retiros/apuestas) cronometrando un claim concurrente. |
| **1.146.0** | Fondos on-chain | La **clave privada de la wallet maestra/treasury** se escribía en texto plano en `bot_wallets.private_key` cada ciclo del bot. Ahora se firma con la env var y se guarda placeholder `__ENV__`. |
| **1.147.0** | IDOR / fugas | Leaderboard: caché (TTL 30s) + rate-limit (evita escaneo de 50k filas por request en endpoint público) + dejó de exponer UUIDs de perfiles ajenos; `support/ticket`: el email de la sesión manda (anti-spoofing). |
| **1.148.0** | Fondos on-chain | Claves de las wallets de trading del bot cifradas (AES-256-GCM) al generarse; `admin/bot/status` dejó de devolverlas al navegador. |
| **1.149.0** | Niveles | Premio de subida de nivel (hasta 25k pts) ahora **exactly-once** (guard atómico condicional) — antes re-acreditaba por race y por fallo de email. |
| **1.150.0** | Monitoreo | Resumen diario de Telegram **que ahora sí se dispara** (estaba en tierra de nadie por la hora del cron); enriquecido con conexiones + casa/jugadores por juego; **pulso cada 6h**; **latido / dead-man's-switch** si 24h sin actividad. |
| **1.151.0** | Monitoreo | Resumen diario como vía primaria por el cron de Vercel (00:00 UTC), idempotente, con el tick horario de GitHub como respaldo (01:15 UTC). |

### Áreas verificadas como SÓLIDAS (sin cambios necesarios)
- `test-login` / `seed-admin`: muertos en producción (404 si no es development).
- PIN admin (`device-auth/verify`): hash SHA256, rate-limit 5/15min, anti-replay.
- 32/32 rutas admin con guardia de auth; `grant-points` / `process-withdrawal` con permiso + atomicidad + auditoría.
- Cifrado de wallets de depósito (AES-256-GCM, IV aleatorio, auth tag).
- Verificación de depósitos: monto desde la cadena, mint correcto, idempotencia por `tx_signature`.
- Predicciones (bet): odds server-side, cutoff anti-last-second, atómico, máx 5 apuestas/ronda.
- Reset de contraseña: token firmado, sin enumeración, sin toma de cuentas.
- Streaks del faucet: server-side, acotados, time-gated.

---

## 2. Arquitectura de crons / monitoreo

| Disparador | Frecuencia | Qué corre |
|---|---|---|
| **Vercel cron** (`/api/cron/master`) | Diario 00:00 UTC | premios, barrido de depósitos, resolución de predicciones, **resumen diario** (primario) |
| **GitHub Actions** (`/api/bot/tick`) | Cada hora (:15) | bot; **pulso** 06/12/18 UTC; resumen diario 01:15 UTC (respaldo idempotente) |

> Nota: en **Vercel Hobby** los crons solo corren 1×/día; por eso lo sub-diario
> (bot + pulso) vive en GitHub Actions. Todo depende de `CRON_SECRET` coincidente
> en Vercel **y** GitHub. El monitoreo de Telegram se apaga si se deshabilita el
> workflow de GitHub (se auto-deshabilita tras 60 días sin commits).

Alertas Telegram en tiempo real ya existentes: nuevo usuario, retiro
solicitado/completado, depósito, gran ganancia HI-LO, límite diario, sospechoso,
bloqueo, multi-IP, error de sistema, ticket de soporte.

---

## 3. Configuración manual realizada (lado del usuario)

- ✅ **`CRON_SECRET`** configurado en Vercel **y** GitHub (mismo valor). Verificado: `/api/bot/tick` pasó de 503 → 401, y el workflow corre en verde.
- ✅ **Wallet maestra rotada**: `8VuFeXxagD8aBL81vAeFPqve45VZBbx8gTMVHkW9mymU` (vieja, expuesta en plano/backups) → **`5q1gi5nad9kfyMwDMEkwvjEafH6K2zSHe1kQQHJoRxgN`** (nueva). Fondeada: ~0.021 SOL + 1000 BOLIS. `SOLANA_WALLET_PRIVATE_KEY_BASE58` actualizada en Vercel.
- ✅ **Turnstile activado**: `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel. Verificado: el registro exige el desafío anti-bot.
- ✅ **Scrubs en `bot_wallets`**: clave maestra → `__ENV__`; wallet de trading vacía → `__SCRUBBED__`. No quedan claves en texto plano.
- ↔️ **Sin tocar** (correcto): `DEPOSIT_WALLET_ENCRYPTION_KEY` y `SOLANA_RPC_URL` (Helius). Cambiar la primera rompería el descifrado de las wallets de depósito existentes.

---

## 4. Pendientes

- ⏳ **Rotar `DEPOSIT_WALLET_ENCRYPTION_KEY`** (baja entropía) — opcional, NO urgente. Requiere migración de re-cifrado (descifrar con la vieja, re-cifrar con la nueva). NO cambiarla a lo loco.
- ⏳ **Auditoría matemática/estadística de los juegos** (Predicción y HI-LO) — siguiente sesión. Ver `docs/PROMPT_AUDITORIA_JUEGOS.md`.
- ℹ️ La fila "Master" en `bot_wallets` mostrará el pubkey nuevo cuando el bot se active y corra un ciclo (hoy sigue el viejo porque el bot está en pausa).
- ℹ️ Mantener actividad en el repo (o re-habilitar el workflow) para que GitHub Actions no se auto-deshabilite y el monitoreo siga vivo.

---

## 5. Resultado

Puntuación antifraude: **2/10 → ~7/10**. Cerrados todos los vectores de drenaje
de alto valor identificados; el monitoreo pasó de ciego a tener resumen diario,
pulso 6h y alerta de caída. Lo que falta es operativo (fondear, rotar la
encryption key) y la auditoría de la matemática de los juegos.
