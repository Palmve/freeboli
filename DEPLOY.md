# FreeBoli – Despliegue y flujo para agentes

Este archivo describe dónde está la web en producción, la base de datos, el repositorio y cómo subir cambios. Útil para agentes de IA o desarrolladores que retomen el proyecto.

---

## URLs y servicios

| Qué | Dónde |
|-----|--------|
| **Web en producción** | https://freeboli.vercel.app/ |
| **Panel Vercel (dominios y proyecto)** | https://vercel.com/albertonava-2595s-projects/freeboli/settings/domains |
| **Código fuente (GitHub)** | https://github.com/Palmve/freeboli |
| **Base de datos** | Supabase (URL y claves en variables de entorno; no están en el repo). El proyecto usa `NEXT_PUBLIC_SUPABASE_URL` y las migraciones están en `supabase/migrations/`. |

---

## Flujo de despliegue

1. **Desarrollo local**  
   - Carpeta del proyecto: `e:\2026 Desarrollo Web\freeboli` (Windows) o la ruta donde esté clonado el repo.  
   - Variables en `.env.local` (nunca subir este archivo a Git).  
   - Comandos: `pnpm install`, `pnpm run dev`. Abre http://localhost:3000 (o el puerto que indique Next.js).

2. **Subir cambios a GitHub**  
   - Repositorio: **Palmve/freeboli**. Rama principal: **main**.  
   - Desde la carpeta del proyecto:
     ```bash
     git add .
     git commit -m "Descripción del cambio"
     git push origin main
     ```
   - No hacer push de `.env.local`, claves privadas ni tokens.

3. **Producción (Vercel)**  
   - El proyecto **freeboli** está vinculado al repo **Palmve/freeboli** en la cuenta de Vercel **albertonava-2595's projects**.  
   - Cada push a `main` dispara un deploy automático.  
   - La web pública queda en: **https://freeboli.vercel.app/**  
   - Dominios y configuración: **Vercel → Project freeboli → Settings → Domains** (enlace arriba).

4. **Base de datos**  
   - Es un proyecto **Supabase**. La URL y las claves se configuran solo en:
     - Local: `.env.local`
     - Producción: **Vercel → Project freeboli → Settings → Environment Variables**
   - Migraciones: ejecutar en el SQL Editor de Supabase en orden: `001_initial.sql`, `002_deposit_code.sql`, `003_deposit_wallet_per_user.sql` (y las que se añadan después).

---

## Variables de entorno (recordatorio para producción)

En Vercel deben estar configuradas (no en el código):

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- NextAuth: `NEXTAUTH_URL` (en producción: `https://freeboli.vercel.app`), `NEXTAUTH_SECRET`, `ADMIN_EMAILS`
- **Auth en producción:** `REQUIRE_AUTH=true` y `NEXT_PUBLIC_REQUIRE_AUTH=true` para que la web pida login real, no muestre "Modo local" y el botón **Salir** cierre sesión. Si no se ponen, la app usa modo local (usuario implícito, sin Salir real).
- Solana: `SOLANA_WALLET_PRIVATE_KEY_BASE58`, `SOLANA_RPC_URL` (URL completa con `?api-key=...`).
  - **CRÍTICO:** Asegúrate de usar el guion medio en `api-key`. Helius rechaza `api_key` con error 401.
- Depósitos por usuario: `DEPOSIT_WALLET_ENCRYPTION_KEY`
- Opcional cron: `CRON_SECRET` para `POST /api/deposit/process-incoming`

Nunca subir claves privadas ni API keys al repositorio.

---

## Login, registro y "Modo local"

- **Crear usuarios:** Sí. Los usuarios se registran en **Registrarse** (`/auth/registro`) y se crean en Supabase (perfil, saldo, movimientos). El login es por correo/contraseña o Google (si está configurado).
- **"Modo local" en el header:** Aparece cuando `NEXT_PUBLIC_REQUIRE_AUTH` no es `"true"`. En ese modo la app usa un usuario local (variable `LOCAL_USER_EMAIL`) y no exige login.
- **Para producción:** Configurar `REQUIRE_AUTH=true` y `NEXT_PUBLIC_REQUIRE_AUTH=true` en Vercel para que haya login real, desaparezca "Modo local" y **Salir** cierre la sesión.

---

## Resumen para un agente de IA

- **Web pública:** https://freeboli.vercel.app/  
- **Código:** https://github.com/Palmve/freeboli (rama `main`)  
- **Hosting:** Vercel, proyecto **freeboli** (albertonava-2595's projects).  
- **Base de datos:** Supabase; credenciales solo en env (local `.env.local`, producción en Vercel).  
- **Subir cambios:** `git add . && git commit -m "..." && git push origin main` → Vercel despliega solo.
