# Probar FreeBoli en local

En local la app puede usarse **sin login** (acceso libre). Un usuario fijo (albertonava@gmail.com) se usa para todo. Cuando subas al servidor, activas autorización con `REQUIRE_AUTH=true`.

## 1. Supabase (base de datos)

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto gratuito.
2. En el proyecto: **SQL Editor** → New query.
3. Ejecuta las migraciones **en orden**:
   - `supabase/migrations/001_initial.sql` → tablas base (profiles, balances, movements, referrals, reward_templates, user_rewards, etc.)
   - `supabase/migrations/002_deposit_code.sql` → códigos de depósito
   - `supabase/migrations/003_deposit_wallet_per_user.sql` → wallets de depósito por usuario
   - `supabase/migrations/004_rewards_streaks.sql` → streaks faucet, tabla site_settings, seed de reward_templates y configuración

Luego en **Settings → API** copia:
- **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** (key) → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Variables de entorno

Copia el ejemplo y rellena lo mínimo:

```bash
cp .env.example .env.local
```

Edita `.env.local` y pon al menos:

```
REQUIRE_AUTH=false
NEXT_PUBLIC_REQUIRE_AUTH=false
LOCAL_USER_EMAIL=albertonava@gmail.com
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (la clave anon)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (Settings → API → service_role; para el seed)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=una-cadena-larga-aleatoria-de-al-menos-32-caracteres
ADMIN_EMAILS=albertonava@gmail.com
```

## 3. Crear usuario admin (para modo local)

Ejecuta una vez para crear albertonava@gmail.com con clave `Hunberto@2001` y acceso admin:

```bash
npm run seed
```

## 4. Arrancar

Se recomienda usar **pnpm**. Instala **yarn** globalmente primero si es necesario (`npm install -g yarn`).

```bash
pnpm install
pnpm run dev
```

Abre **http://localhost:3000** en el navegador. O usa el script `iniciar-freeboli.bat` que limpia cache, libera el puerto 3000 y abre el navegador automáticamente.

## 5. Probar

- **Usuario en BD:** correo `albertonava@gmail.com`, clave `Hunberto@2001` (admin). Al crearse tiene **100 puntos** de bienvenida.
- **Verificar login (solo desarrollo):**
  `http://localhost:3000/api/test-login?email=albertonava@gmail.com&password=Hunberto@2001`
  Debe devolver `"ok": true`.
- Con **REQUIRE_AUTH=false** no hace falta entrar: abre la web y usa Faucet, HI-LO, Mi cuenta y Admin.
- **Nota:** Para probar el faucet en local, el usuario necesita tener `email_verified_at` seteado. Ejecuta en Supabase SQL Editor:
  ```sql
  UPDATE profiles SET email_verified_at = now() WHERE email = 'albertonava@gmail.com';
  ```

Depósitos/retiros en BOLIS necesitan `SOLANA_WALLET_PRIVATE_KEY_BASE58` y un **RPC válido** (Helius recomendado con `api-key` usando guion medio). Para solo probar juego y faucet no hace falta.

## 6. Páginas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Home |
| `/faucet` | Faucet con rachas, CAPTCHA y tablas de multiplicadores |
| `/hi-lo` | Juego HI-LO (apuestas) |
| `/recompensas` | Logros con progreso y botón reclamar |
| `/afiliados` | Plan de afiliados (enlace, compartir, tabla referidos, bonus) |
| `/cuenta` | Mi cuenta (balance, historial, depósitos, retiros) |
| `/cuenta/depositar` | Dirección de depósito BOLIS |
| `/admin` | Panel admin (8 pestañas) |
| `/admin/configuracion` | Editor de parámetros del sistema |
| `/admin/proyecciones` | Simulador de costos mensuales |

---

## Login con Google (opcional)

1. Entra en [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Crea un proyecto y en **APIs y servicios → Credenciales** crea **ID de cliente de OAuth 2.0**.
3. En **URIs de redirección autorizados** añade:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Producción: `https://tu-dominio.com/api/auth/callback/google`
4. En `.env.local` pon:
   ```
   AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=GOCSPX-xxx
   NEXT_PUBLIC_GOOGLE_ENABLED=true
   ```
5. Reinicia `pnpm run dev`.

---

## Sistema de recompensas (resumen técnico)

### Faucet con streaks
- **Racha horaria:** reclamos consecutivos multiplican puntos (x1.0 → x3.0)
- **Racha diaria:** días seguidos dan bonus (+0% → +100%)
- **Fórmula:** `base × multiplicador_hora × (1 + bonus_día)`
- Se rompe racha horaria si gap > 2× cooldown; se rompe racha diaria si falta 1 día
- CAPTCHA cada 4 reclamos, engagement (HI-LO) cada 10 reclamos

### Logros
- Definidos en tabla `reward_templates`, reclamables via `/api/rewards/claim`
- Progreso calculado en tiempo real (apuestas, email, referidos)
- Comisión al referente sobre logros del referido (10%)

### Afiliados
- Comisión permanente sobre faucet y juegos del referido (50%)
- Bonus por referido verificado requiere: email + 20 apuestas + 3 días
- Tipo de movimiento: `bonus_referido_verificado`

### Configuración en vivo
- Tabla `site_settings` (key-value JSONB)
- Editable desde `/admin/configuracion`
- La app lee valores con `getSetting()` de `src/lib/site-settings.ts` (cache 1 min)
- Fallback a constantes en `src/lib/config.ts`
