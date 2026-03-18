# FreeBoli – Despliegue y flujo para agentes

Este archivo describe dónde está la web en producción, la base de datos, el repositorio y cómo subir cambios. Útil para agentes de IA o desarrolladores que retomen el proyecto.

---

## URLs y servicios

| Qué | Dónde |
|-----|--------|
| **Web en producción** | https://freeboli.vercel.app/ |
| **Panel Vercel** | https://vercel.com/albertonava-2595s-projects/freeboli/settings/domains |
| **Código fuente (GitHub)** | https://github.com/Palmve/freeboli |
| **Base de datos** | Supabase (credenciales en variables de entorno, nunca en el repo) |

---

## Flujo de despliegue

1. **Desarrollo local**
   - Carpeta: `e:\2026 Desarrollo Web\freeboli` (Windows).
   - Variables en `.env.local` (nunca subir a Git).
   - Comandos: `pnpm install`, `pnpm run dev`. Abre http://localhost:3000.
   - Ver `LOCAL.md` para configuración detallada.

2. **Subir cambios a GitHub**
   - Repositorio: **Palmve/freeboli**. Rama principal: **main**.
   ```bash
   git add .
   git commit -m "Descripción del cambio"
   git push origin main
   ```
   - No hacer push de `.env.local`, claves privadas ni tokens.

3. **Producción (Vercel)**
   - El proyecto **freeboli** está vinculado al repo **Palmve/freeboli** en Vercel.
   - Cada push a `main` dispara un deploy automático.
   - Web: **https://freeboli.vercel.app/**

4. **Base de datos (Supabase)**
   - Migraciones en `supabase/migrations/`, ejecutar en orden en el SQL Editor:
     - `001_initial.sql` → tablas base
     - `002_deposit_code.sql` → códigos de depósito
     - `003_deposit_wallet_per_user.sql` → wallets de depósito por usuario
     - `004_rewards_streaks.sql` → streaks faucet, site_settings, reward_templates
   - Credenciales solo en env (local `.env.local`, producción en Vercel).

---

## Variables de entorno (producción en Vercel)

### Requeridas
- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Clave anon de Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Clave service_role (para operaciones admin)
- `NEXTAUTH_URL` — `https://freeboli.vercel.app`
- `NEXTAUTH_SECRET` — String aleatorio largo (mín 32 chars)
- `ADMIN_EMAILS` — Emails de admin separados por coma
- `REQUIRE_AUTH=true` — Activa login obligatorio
- `NEXT_PUBLIC_REQUIRE_AUTH=true` — Activa login en el frontend
- `SOLANA_WALLET_PRIVATE_KEY_BASE58` — Clave privada del treasury wallet
- `SOLANA_RPC_URL` — URL RPC de Solana (Helius recomendado, usar `api-key` con guion medio)
- `DEPOSIT_WALLET_ENCRYPTION_KEY` — Clave para encriptar wallets de depósito
- `CRON_SECRET` — Para autorizar el cron job de depósitos

### Opcionales
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_GOOGLE_ENABLED=true` — Login con Google
- `CAPTCHA_SECRET` — Clave para CAPTCHA (usa NEXTAUTH_SECRET si no se define)
- Parámetros del sistema (puntos faucet, comisiones, etc.) se configuran desde `/admin/configuracion` en vez de env vars

---

## Arquitectura de datos (tipos de movimiento)

| Tipo | Descripción | Perspectiva plataforma |
|------|-------------|----------------------|
| `faucet` | Puntos reclamados del faucet | Costo |
| `apuesta_hi_lo` | Apuesta en HI-LO (puntos apostados) | Ingreso |
| `premio_hi_lo` | Premio por ganar HI-LO | Costo |
| `comision_afiliado` | Comisión al referente por actividad del referido | Costo |
| `logro` | Puntos por reclamar un logro/achievement | Costo |
| `recompensa` | Bienvenida / promo | Costo |
| `bonus_referido_verificado` | Bonus por referido que cumple requisitos | Costo |
| `deposito_bolis` | Depósito de BOLIS del usuario | Neutral |
| `retiro_bolis` | Retiro de BOLIS del usuario | Neutral |

---

## Tabla site_settings (configuración en vivo)

Parametros editables desde `/admin/configuracion` sin redesplegar:

| Key | Default | Descripción |
|-----|---------|-------------|
| `FAUCET_POINTS` | 100 | Puntos base del faucet |
| `FAUCET_COOLDOWN_HOURS` | 1 | Horas entre reclamos |
| `CAPTCHA_INTERVAL` | 4 | Reclamos entre CAPTCHAs |
| `FAUCET_ENGAGEMENT_EVERY` | 10 | Reclamos entre checks de engagement |
| `AFFILIATE_COMMISSION_PERCENT` | 50 | % comisión sobre actividad |
| `AFFILIATE_ACHIEVEMENT_PERCENT` | 10 | % comisión sobre logros |
| `REFERRAL_VERIFIED_BONUS` | 10000 | Bonus por referido verificado |
| `REFERRAL_MIN_BETS` | 20 | Mín apuestas para bonus referido |
| `REFERRAL_MIN_DAYS` | 3 | Mín días registrado para bonus |
| `HOURLY_STREAK_TIERS` | JSON | Tiers multiplicador por horas |
| `DAILY_STREAK_TIERS` | JSON | Tiers bonus por días |

---

## Resumen para un agente de IA

- **Web pública:** https://freeboli.vercel.app/
- **Código:** https://github.com/Palmve/freeboli (rama `main`)
- **Hosting:** Vercel, proyecto **freeboli**.
- **Base de datos:** Supabase; credenciales solo en env.
- **Subir cambios:** `git add . && git commit -m "..." && git push origin main` → Vercel despliega solo.
- **Migraciones:** 4 archivos SQL en `supabase/migrations/`, ejecutar en orden en Supabase SQL Editor.
- **Config en vivo:** Tabla `site_settings` editable desde `/admin/configuracion`.

---

## Redeploy en Vercel no actualiza

Si tras hacer push o redeploy la web no refleja los cambios:

1. **Limpiar caché de build:** En Vercel → Proyecto → Deployments → menú (⋯) del último deploy → **Redeploy** → marcar **"Clear build cache"**.
2. **Variables de entorno:** Asegúrate de que `ADMIN_EMAILS=albertonava@gmail.com` esté en Vercel (Settings → Environment Variables).
3. **Probar en incógnito** para descartar caché del navegador.
4. **Forzar sin caché (solo si persiste):** Añade temporalmente `VERCEL_FORCE_NO_BUILD_CACHE=1` en env de Vercel, redeploy, y luego quítala (ralentiza los builds).
- **Anti-bot:** CAPTCHA, honeypot, timing, emails desechables, rate limiting, engagement, email verificado.
