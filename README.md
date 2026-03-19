# FreeBoli

Web de juego con puntos internos y BOLIS (token Solana). Faucet con rachas, HI-LO, sistema de recompensas, afiliados con compartir social, depósitos y retiros en BOLIS. Panel admin con estadísticas, proyecciones y configuración en vivo.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Base de datos:** Supabase (PostgreSQL)
- **Blockchain:** Solana (SPL Token BOLIS)
- **Auth:** NextAuth.js (credentials + Google opcional)
- **Estilo:** Tailwind CSS (tema oscuro)
- **Deploy:** Vercel con cron jobs
- **Package manager:** pnpm

## Estructura principal

```
src/
├── app/
│   ├── admin/           # Panel admin (tabs: Resumen, Wallets, Depósitos, Retiros, Usuarios, Ranking, Estadísticas, Proyecciones, Alertas, Configuración, Seguridad)
│   ├── afiliados/       # Plan de afiliados (enlace, compartir, tabla referidos, bonus)
│   ├── api/             # API routes (faucet, hi-lo, rewards, affiliates, admin, auth, deposit, withdraw)
│   ├── auth/            # Login y registro
│   ├── cuenta/          # Mi cuenta (balance, depósitos, retiros)
│   ├── faucet/          # Faucet con streaks y CAPTCHA
│   ├── hi-lo/           # Juego HI-LO
│   └── recompensas/     # Logros y tablas de rachas
├── lib/
│   ├── config.ts        # Constantes del sistema (defaults, sobrescribibles desde admin)
│   ├── captcha.ts       # CAPTCHA matemático con HMAC
│   ├── streaks.ts       # Cálculo de rachas y multiplicadores
│   ├── site-settings.ts # Lector de site_settings (DB) con cache
│   ├── solana.ts        # Interacción Solana (treasury, balances, transfers)
│   ├── rate-limit.ts    # Rate limiter in-memory
│   ├── disposable-emails.ts # Lista de dominios de email desechables
│   └── ...
└── components/          # Componentes compartidos (Header, etc.)

supabase/migrations/     # Migraciones SQL (001 a 011)
```

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Crea proyecto en [Supabase](https://supabase.com) y ejecuta las migraciones en orden:
   - `001_initial.sql` → tablas base (profiles, balances, movements, referrals, reward_templates, etc.)
   - `002_deposit_code.sql` → códigos de depósito
   - `003_deposit_wallet_per_user.sql` → wallets de depósito por usuario
   - `004_rewards_streaks.sql` → streaks faucet, site_settings, seed reward_templates
   - `005_user_status.sql` → estados de usuario (normal/evaluar/suspendido/bloqueado)
   - `006_leaderboard_prizes.sql` → keys de premios ranking
   - `007_terms_and_limits.sql` → términos HI-LO y límites
   - `008_email_verification_and_public_id.sql` → email verification + public_id 6 cifras
   - `009_movement_type_enum_extend.sql` → tipos extra en movements
   - `010_security_settings.sql` → defaults de seguridad antibot en `site_settings`
   - `011_password_reset.sql` → tabla `password_resets` para reset por email
3. Rellena `.env.local` (ver sección de variables de entorno en `DEPLOY.md`).

## Equivalencia

- **1000 puntos = 1 BOLIS** (configurable desde admin o `NEXT_PUBLIC_POINTS_PER_BOLIS`).
- Retiro mínimo: 10,000 puntos por defecto.

## Desarrollo

```bash
pnpm install
pnpm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Ver `LOCAL.md` para configuración detallada.

## Sistemas principales

### Faucet con rachas
- Reclama puntos cada hora (configurable)
- Multiplicador por reclamos consecutivos: x1.0 → x3.0
- Bonus por días seguidos: +0% → +100%
- CAPTCHA matemático cada 4 reclamos (posición alterna arriba/abajo)
- Requisito de engagement: jugar HI-LO cada 10 reclamos
- Email verificado obligatorio para reclamar

### Recompensas (logros)
- Verificar correo, primera apuesta, 100/1K/10K apuestas, primer referido verificado
- Barras de progreso y botón reclamar en `/recompensas`
- Comisión para el referente sobre logros del referido (10% configurable)

### Afiliados
- Comisión permanente sobre actividad del referido (50% configurable)
- Bonus por referido verificado (10,000 pts promocional, requiere: email verificado + 20 apuestas + 3 días registrado)
- Página con enlace directo, botones de compartir (WhatsApp, X, Facebook, TikTok, Correo, Copiar), tabla de referidos
- Anti-granja: requisitos de actividad impiden ciclos de cuentas falsas

### Anti-bot / Seguridad
- CAPTCHA matemático periódico con HMAC (posición variable)
- Rate limiting en login, registro, retiros y `forgot-password`
- Honeypot en formulario de registro
- Validación de tiempo de envío (< 3s = bot)
- Bloqueo de emails desechables (~60 dominios)
- Tope de 5 registros por IP cada 24h
- Reset de contraseña por email (token + tabla `password_resets`)
- Email verificado obligatorio para faucet
- Engagement obligatorio (HI-LO) para seguir reclamando faucet
- MAX_SESSIONS_PER_IP para faucet
- Headers de seguridad HTTP

### Admin
- Pestañas: Resumen, Wallets, Depósitos, Retiros, Usuarios, Ranking, Estadísticas, Proyecciones, Alertas, Configuración, Seguridad
- **Estadísticas**: Balance P&L de la plataforma (ingresos vs costos), desglose por tipo, jugadas HI-LO
- **Proyecciones**: Simulador client-side de costos mensuales (faucet, afiliados, logros)
- **Configuración**: Editor en vivo de todos los parámetros del sistema (tabla `site_settings`)
- **Seguridad**: listado desplegable de todos los sistemas de seguridad y antibot existentes
- **Reward templates**: Editor de puntos por logro

## Despliegue

Despliega en Vercel. Cada push a `main` dispara deploy automático. Ver `DEPLOY.md` para detalles.
