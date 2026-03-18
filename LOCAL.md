# Probar FreeBoli en local

En local la app puede usarse **sin login** (acceso libre). Un usuario fijo (albertonava@gmail.com) se usa para todo. Cuando subas al servidor, activas autorización con `REQUIRE_AUTH=true`.

## 1. Supabase (base de datos)

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto gratuito.
2. En el proyecto: **SQL Editor** → New query.
3. Copia y pega todo el contenido de `supabase/migrations/001_initial.sql` y ejecuta (Run).

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

Abre **http://localhost:3000** en el navegador.

## 5. Probar

- **Usuario en BD:** correo `albertonava@gmail.com`, clave `Hunberto@2001` (admin). Al crearse o al darle puntos de bienvenida, tiene **100 puntos** la primera vez.
- **Verificar login en BD (solo desarrollo):** con el servidor levantado, abre en el navegador:
  `http://localhost:3000/api/test-login?email=albertonava@gmail.com&password=Hunberto@2001`
  Debe devolver `"ok": true` y `"points": 100`. Si sale "Usuario no encontrado", ejecuta `npm run seed`.
- **Entrar en la web:** ve a **Entrar**, escribe ese correo y clave; deberías entrar y ver Faucet, Mi cuenta, Admin y los 100 puntos.
- Con **REQUIRE_AUTH=false** no hace falta entrar: abre la web y usa Faucet, HI-LO, Mi cuenta y Admin (todo como albertonava@gmail.com).
- Si más adelante activas login: Registrarse con correo + contraseña también da **100 puntos de bienvenida** al nuevo usuario.

Depósitos/retiros en BOLIS necesitan `SOLANA_WALLET_PRIVATE_KEY_BASE58` y un **RPC válido** (Helius recomendado con `api-key` usando guion medio). Para solo probar juego y faucet no hace falta.

---

## Login con Google (opcional)

No está probado en vivo; para que funcione hay que configurar OAuth en Google:

1. Entra en [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Crea un proyecto (o elige uno) y en **APIs y servicios → Credenciales** crea **ID de cliente de OAuth 2.0**.
3. Tipo de aplicación: **Aplicación web**.
4. En **URIs de redirección autorizados** añade:
   - En local: `http://localhost:3000/api/auth/callback/google`
   - En producción: `https://tu-dominio.com/api/auth/callback/google`
5. Copia el **ID de cliente** y el **Secreto del cliente** y en `.env.local` pon:
   ```
   AUTH_GOOGLE_ID=xxx.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=GOCSPX-xxx
   NEXT_PUBLIC_GOOGLE_ENABLED=true
   ```
6. Reinicia `npm run dev`. Deberías ver el botón **Continuar con Google** en Entrar y Registrarse.

Si al hacer clic en Google sale error (p. ej. "redirect_uri_mismatch"), revisa que la URI en la consola de Google coincida exactamente con la que usa la app (localhost:3000 o tu dominio).

**En el servidor (VPS):** pon en el `.env` de producción `REQUIRE_AUTH=true` y `NEXT_PUBLIC_REQUIRE_AUTH=true` para que sea obligatorio entrar con correo/Google. El usuario albertonava@gmail.com con clave Hunberto@2001 seguirá pudiendo entrar y tendrá acceso Admin.
