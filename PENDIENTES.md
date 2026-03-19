# Pendientes – FreeBoli

Este archivo lista tareas completadas y pendientes. Revisar cuando pregunten "qué hay pendiente" o "qué falta".

---

## Completado

### Infraestructura / DevOps
- **Cron job para depósitos BOLIS** — `vercel.json`, cada 12h (`0 */12 * * *`). Botón manual en admin.
- **Wallets de depósito por usuario** — Migración `003`, encriptación con `DEPOSIT_WALLET_ENCRYPTION_KEY`.
- **RPC Solana (Helius)** — Usar `api-key` (guion medio).
- **Sweep de wallets** — Treasury paga gas. Panel admin → Wallets.
- **Panel admin reorganizado** — 11 pestañas: Resumen, Wallets, Depósitos, Retiros, Usuarios, Ranking, Estadísticas, Proyecciones, Alertas, Configuración, Seguridad.

### Seguridad
- **Rate limiting** — Login (5/15min), registro (3/15min + 5/día por IP), retiros (5/h) y forgot-password (5/15min + 20/24h por IP).
- **Reset de contraseña por email** — Endpoint + páginas `/auth/forgot-password` y `/auth/reset-password` usando tabla `password_resets`.
- **Admin → Seguridad** — Pestaña Seguridad y parámetros editables de antibot desde `/admin/configuracion` (grupo Seguridad).
- **Contraseña mínima** — 8 caracteres.
- **Headers HTTP** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Endpoint test-login** — Solo en desarrollo.
- **Bloqueo emails desechables** — ~60 dominios (guerrillamail, tempmail, yopmail, etc.).
- **Honeypot en registro** — Campo oculto que solo bots llenan.
- **Validación de tiempo de registro** — Rechaza envíos < 3 segundos.
- **Tope diario de registros por IP** — Máx 5 cuentas/24h.
- **Email verificado obligatorio** — Sin verificar no se puede usar el faucet.
- **CAPTCHA matemático** — Cada 4 reclamos del faucet, posición alterna, firmado con HMAC.
- **Engagement obligatorio** — Cada 10 reclamos del faucet se exige haber jugado HI-LO en 24h.

### Sistema de recompensas (Migración 004)
- **Faucet con rachas** — Multiplicador por horas (x1-x3) y bonus por días (+0% a +100%).
- **Logros** — 6 achievements con progreso y reclamar (email, apuestas 1/100/1K/10K, referido).
- **Tabla site_settings** — Configuración del sistema editable desde admin sin redesplegar.
- **Admin: Proyecciones** — Simulador client-side de costos mensuales.
- **Admin: Configuración** — Editor de todos los parámetros (faucet, afiliados, streaks, logros).

### Afiliados mejorado
- **Página renovada** — Enlace directo visible, botones compartir (WhatsApp, X, Facebook, TikTok, Correo, Copiar).
- **Tabla de referidos** — Email, fecha, verificado, jugadas, comisión, estado bonus.
- **Bonus por referido verificado** — 10,000 pts (promocional), requiere: email verificado + 20 apuestas + 3 días.
- **Comisión sobre logros** — 10% de los logros que reclame el referido.
- **Anti-granja** — Requisitos de actividad impiden ciclos de cuentas falsas.

### Estadísticas admin corregidas
- Depósitos de usuarios ya NO cuentan como "ganancia" de la plataforma.
- Desglose: ingresos (apuestas HI-LO) vs costos (faucet, premios, comisiones, logros, bonus referidos).
- Incluye todos los tipos de movimiento nuevos.

---

## Pendiente / Opcional

- **Monetización: banner de publicidad de criptomonedas en el footer** — Añadir espacio en el footer para un banner de publicidad (afiliados cripto, exchanges, etc.).
- **(Opcional) Aceptar SOL y convertir a BOLIS** — Depósitos en SOL via DEX (Jupiter).
- **(Opcional) Sonidos en HI-LO** — Opción "Habilitar sonidos".
- **(Opcional) Dashboard de usuario** — Gráficas de ganancias, historial de rachas.
- **(Opcional) Más juegos** — Ruleta, dados, slots, etc.

---

## Configuración producción

- Usar `REQUIRE_AUTH=true` y `NEXT_PUBLIC_REQUIRE_AUTH=true`.
- No commitear `.env.local`.
- Variables requeridas en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_EMAILS`, `SOLANA_WALLET_PRIVATE_KEY_BASE58`, `SOLANA_RPC_URL`, `DEPOSIT_WALLET_ENCRYPTION_KEY`, `CRON_SECRET`.
- Variables también necesarias para emails: `RESEND_API_KEY` (y opcional `RESEND_FROM`).

---

*Última actualización: marzo 2026 — Reset contraseña + icono/copia wallet + pestaña Admin Seguridad + parámetros editables (grupo Seguridad). Pendiente: banner publicidad cripto en footer.*
