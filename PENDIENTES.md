# Pendientes – FreeBoli

Este archivo lista tareas pendientes para que el agente (o un desarrollador) sepa qué falta por hacer. Revisar cuando pregunten "qué hay pendiente" o "qué falta".

---

## Infraestructura / DevOps

- **Cron job para procesar depósitos BOLIS [COMPLETADO ✅]**
  - Configurado en `vercel.json` con Vercel Cron: cada 12 horas (`0 */12 * * *`) llama `GET /api/deposit/process-incoming`.
  - La ruta acepta GET (cron) y POST (botón admin). Se autoriza con `CRON_SECRET`.
  - **Requisito:** Definir `CRON_SECRET` en Vercel → Settings → Environment Variables.
  - El botón manual "Procesar depósitos ahora" sigue disponible en la pestaña Depósitos del panel admin.

- **Variable de entorno para depósitos por usuario [COMPLETADO ✅]**
  - `DEPOSIT_WALLET_ENCRYPTION_KEY` configurada.
  - Migración `003_deposit_wallet_per_user.sql` ejecutada.

- **RPC de Solana (Helius) [COMPLETADO ✅]**
  - Configurado. Lección: usar `api-key` (guion medio), no `api_key`.

- **Sweep de wallets de depósito [COMPLETADO ✅]**
  - `sweepBolisToTreasury()` corregido: el treasury paga el gas.
  - Panel admin → pestaña Wallets: muestra wallets de usuarios con saldo on-chain y botón "Sweep al Treasury".

- **Panel admin reorganizado [COMPLETADO ✅]**
  - Pestañas responsive: Resumen, Wallets, Depósitos, Retiros, Usuarios, Estadísticas.

---

## Seguridad [COMPLETADO ✅]

- **Rate limiting (anti brute-force)**
  - Login: 5 intentos por email cada 15 minutos.
  - Registro: 3 intentos por IP cada 15 minutos.
  - Retiros: 5 solicitudes por usuario por hora.
  - Implementado con rate limiter in-memory (`src/lib/rate-limit.ts`).

- **Contraseña mínima**
  - Registro requiere contraseña de al menos 8 caracteres.

- **Cabeceras de seguridad HTTP** (en `next.config.mjs`)
  - `X-Frame-Options: DENY` (previene clickjacking)
  - `X-Content-Type-Options: nosniff` (previene MIME sniffing)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

- **Endpoint test-login protegido**
  - Solo disponible en desarrollo y cuando `REQUIRE_AUTH` no es `true`.
  - En producción devuelve 404.

- **Hashing de contraseñas:** scrypt con salt aleatorio + comparación timing-safe (ya existía).
- **Sesiones JWT** con expiración de 30 días (ya existía).
- **Anti-fraude faucet:** Límite de sesiones por IP (`MAX_SESSIONS_PER_IP`, ya existía).

---

## Funcionalidad / Producto

- **(Opcional) Aceptar SOL y convertir a BOLIS**  
  Depósitos en SOL que se conviertan automáticamente a BOLIS (vía Jupiter u otro DEX) y luego a puntos.

- **(Opcional) Sonidos en HI-LO**  
  Opción "Habilitar sonidos" en el juego.

---

## Configuración producción

- Usar `REQUIRE_AUTH=true` y `NEXT_PUBLIC_REQUIRE_AUTH=true`.
- No commitear `.env.local` (ya en `.gitignore`).
- Variables requeridas en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_EMAILS`, `SOLANA_WALLET_PRIVATE_KEY_BASE58`, `SOLANA_RPC_URL`, `DEPOSIT_WALLET_ENCRYPTION_KEY`, `CRON_SECRET`.

---

*Última actualización: 18 marzo 2026 - Cron 2x/día, seguridad reforzada (rate limiting, headers, password strength).*
